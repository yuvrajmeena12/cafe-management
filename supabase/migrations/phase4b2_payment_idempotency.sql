-- ============================================================
-- Saffron & Sage — Phase 4B-2 Razorpay Webhook Idempotency & Payment Integrity
-- Migration: Webhook event tracking table with strict uniqueness,
-- razorpay_order_id partial uniqueness, database-level payment downgrade prevention,
-- and atomic webhook processing RPC (process_razorpay_webhook_event).
-- ============================================================

-- Ensure required cryptographic extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- ============================================================
-- 1. PAYMENT WEBHOOK EVENTS TABLE (IDEMPOTENCY & AUDIT TRAIL)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.payment_webhook_events (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id text UNIQUE NOT NULL,
  event_type text NOT NULL,
  razorpay_order_id text,
  payment_id text,
  internal_order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  amount_paise bigint,
  status text NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'processed', 'ignored', 'failed')),
  error_message text,
  payload_hash text,
  created_at timestamptz DEFAULT now()
);

-- Ensure check constraint covers 'processing'
ALTER TABLE public.payment_webhook_events DROP CONSTRAINT IF EXISTS payment_webhook_events_status_check;
ALTER TABLE public.payment_webhook_events ADD CONSTRAINT payment_webhook_events_status_check
  CHECK (status IN ('processing', 'processed', 'ignored', 'failed'));

-- Performance & deduplication indexes
CREATE INDEX IF NOT EXISTS idx_payment_webhook_events_order_id
ON public.payment_webhook_events (internal_order_id);

CREATE INDEX IF NOT EXISTS idx_payment_webhook_events_rzp_order_id
ON public.payment_webhook_events (razorpay_order_id);

CREATE INDEX IF NOT EXISTS idx_payment_webhook_events_payment_id
ON public.payment_webhook_events (payment_id);

CREATE INDEX IF NOT EXISTS idx_payment_webhook_events_created_at
ON public.payment_webhook_events (created_at DESC);


-- ============================================================
-- 2. ROW LEVEL SECURITY ON WEBHOOK EVENTS
-- ============================================================

ALTER TABLE public.payment_webhook_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payment_webhook_events_admin_select" ON public.payment_webhook_events;
CREATE POLICY "payment_webhook_events_admin_select" ON public.payment_webhook_events
FOR SELECT USING (public.is_admin());

-- No direct client INSERT, UPDATE, or DELETE policy.
-- The Edge Function uses service_role key to record webhook deliveries securely.


-- ============================================================
-- 3. ORDERS RAZORPAY_ORDER_ID PARTIAL UNIQUE INDEX
-- ============================================================

-- Enforces that no two orders can ever claim the same Razorpay order ID.
-- Partial index allows multiple rows with NULL razorpay_order_id (e.g. COD or pending initialization).
CREATE UNIQUE INDEX IF NOT EXISTS uq_orders_razorpay_order_id
ON public.orders (razorpay_order_id)
WHERE razorpay_order_id IS NOT NULL;


-- ============================================================
-- 4. DATABASE PAYMENT DOWNGRADE PREVENTION TRIGGER
-- ============================================================

-- Strictly prevents ANY process (including admin or service role)
-- from downgrading an order whose payment_status is 'paid' back to 'failed' or 'pending'.
CREATE OR REPLACE FUNCTION public.protect_order_payment_downgrade()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF OLD.payment_status = 'paid' AND NEW.payment_status IN ('failed', 'pending') THEN
    RAISE EXCEPTION 'Invalid payment state transition: cannot downgrade paid order to %', NEW.payment_status
      USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.protect_order_payment_downgrade() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_protect_order_payment_downgrade ON public.orders;
CREATE TRIGGER trg_protect_order_payment_downgrade
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_order_payment_downgrade();


-- ============================================================
-- 5. ATOMIC RAZORPAY WEBHOOK PROCESSING RPC (SEC-P0-ATOMICITY)
-- ============================================================

-- Transactionally couples event claiming, order lookup, amount verification,
-- idempotency checks, and order payment state transitions inside a single PostgreSQL transaction.
-- Guarantees that an event cannot be marked processed if order mutation fails,
-- and allows retries of incomplete/failed events.
CREATE OR REPLACE FUNCTION public.process_razorpay_webhook_event(
  p_event_id text,
  p_event_type text,
  p_razorpay_order_id text,
  p_payment_id text,
  p_amount_paise bigint,
  p_currency text,
  p_payload_hash text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_existing_event record;
  v_order record;
  v_expected_paise bigint;
  v_event_record_id uuid;
BEGIN
  -- 1. Validate required input parameters
  IF pg_catalog.coalesce(pg_catalog.trim(p_event_id), '') = '' THEN
    RAISE EXCEPTION 'Event ID is required' USING ERRCODE = '22023';
  END IF;
  IF pg_catalog.coalesce(pg_catalog.trim(p_event_type), '') = '' THEN
    RAISE EXCEPTION 'Event type is required' USING ERRCODE = '22023';
  END IF;
  IF pg_catalog.coalesce(pg_catalog.trim(p_razorpay_order_id), '') = '' THEN
    RAISE EXCEPTION 'Razorpay order ID is required' USING ERRCODE = '22023';
  END IF;
  IF pg_catalog.coalesce(pg_catalog.trim(p_payment_id), '') = '' THEN
    RAISE EXCEPTION 'Payment ID is required' USING ERRCODE = '22023';
  END IF;

  -- 2. Check for existing event delivery record with row-level lock
  SELECT * INTO v_existing_event
  FROM public.payment_webhook_events
  WHERE event_id = p_event_id
  FOR UPDATE;

  IF FOUND THEN
    -- If event has already been successfully processed, return idempotent NO-OP
    IF v_existing_event.status = 'processed' THEN
      RETURN pg_catalog.jsonb_build_object(
        'status', 'duplicate_event_ignored',
        'should_send_email', false
      );
    END IF;

    -- If event was previously ignored (e.g. out-of-order failed event), return ignored
    IF v_existing_event.status = 'ignored' THEN
      RETURN pg_catalog.jsonb_build_object(
        'status', 'ignored_event_noop',
        'should_send_email', false
      );
    END IF;

    -- If event was previously marked failed or processing, reuse the existing record for retry
    v_event_record_id := v_existing_event.id;
  ELSE
    -- Atomically claim event delivery in 'processing' state
    INSERT INTO public.payment_webhook_events (
      event_id,
      event_type,
      razorpay_order_id,
      payment_id,
      amount_paise,
      payload_hash,
      status
    ) VALUES (
      p_event_id,
      p_event_type,
      p_razorpay_order_id,
      p_payment_id,
      p_amount_paise,
      p_payload_hash,
      'processing'
    )
    RETURNING id INTO v_event_record_id;
  END IF;

  -- 3. Lookup target order with row-level lock
  SELECT * INTO v_order
  FROM public.orders
  WHERE razorpay_order_id = p_razorpay_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    UPDATE public.payment_webhook_events
    SET status = 'failed',
        error_message = 'Order not found for razorpay_order_id'
    WHERE id = v_event_record_id;

    RETURN pg_catalog.jsonb_build_object(
      'status', 'order_not_found',
      'should_send_email', false,
      'error', 'Order not found for razorpay_order_id'
    );
  END IF;

  -- Associate internal order ID with webhook event record
  UPDATE public.payment_webhook_events
  SET internal_order_id = v_order.id
  WHERE id = v_event_record_id;

  -- 4. Process payment.captured
  IF p_event_type = 'payment.captured' THEN
    -- Amount & Currency integrity check
    v_expected_paise := pg_catalog.round(v_order.total * 100);
    IF p_currency <> 'INR' OR p_amount_paise <> v_expected_paise THEN
      UPDATE public.payment_webhook_events
      SET status = 'failed',
          error_message = pg_catalog.format('Amount mismatch: expected %s INR paise, got %s %s', v_expected_paise, p_amount_paise, p_currency)
      WHERE id = v_event_record_id;

      RETURN pg_catalog.jsonb_build_object(
        'status', 'amount_mismatch',
        'should_send_email', false,
        'error', 'Payment amount or currency mismatch'
      );
    END IF;

    -- Already paid check (Idempotent NO-OP)
    IF v_order.payment_status = 'paid' THEN
      UPDATE public.payment_webhook_events
      SET status = 'processed',
          error_message = 'Order was already marked paid'
      WHERE id = v_event_record_id;

      RETURN pg_catalog.jsonb_build_object(
        'status', 'already_paid_noop',
        'should_send_email', false
      );
    END IF;

    -- Transition order to paid
    UPDATE public.orders
    SET payment_status = 'paid',
        payment_id = p_payment_id
    WHERE id = v_order.id;

    -- Mark webhook event as processed
    UPDATE public.payment_webhook_events
    SET status = 'processed',
        error_message = NULL
    WHERE id = v_event_record_id;

    RETURN pg_catalog.jsonb_build_object(
      'status', 'payment_captured',
      'should_send_email', true,
      'order_id', v_order.id,
      'order_data', pg_catalog.jsonb_build_object(
        'id', v_order.id,
        'customer_name', v_order.customer_name,
        'customer_email', v_order.customer_email,
        'customer_phone', v_order.customer_phone,
        'total', v_order.total,
        'subtotal', v_order.subtotal,
        'tax', v_order.tax,
        'delivery_charge', v_order.delivery_charge,
        'discount_amount', v_order.discount_amount,
        'order_type', v_order.order_type
      )
    );
  END IF;

  -- 5. Process payment.failed
  IF p_event_type = 'payment.failed' THEN
    -- Payment downgrade protection: NEVER downgrade already paid order
    IF v_order.payment_status = 'paid' THEN
      UPDATE public.payment_webhook_events
      SET status = 'ignored',
          error_message = 'Payment downgrade prevented: order is already paid'
      WHERE id = v_event_record_id;

      RETURN pg_catalog.jsonb_build_object(
        'status', 'ignored_downgrade_prevented',
        'should_send_email', false
      );
    END IF;

    -- Transition pending order to failed
    IF v_order.payment_status = 'pending' THEN
      UPDATE public.orders
      SET payment_status = 'failed'
      WHERE id = v_order.id;
    END IF;

    UPDATE public.payment_webhook_events
    SET status = 'processed',
        error_message = 'Payment failed recorded'
    WHERE id = v_event_record_id;

    RETURN pg_catalog.jsonb_build_object(
      'status', 'payment_failed_recorded',
      'should_send_email', false
    );
  END IF;

  -- 6. Unhandled events
  UPDATE public.payment_webhook_events
  SET status = 'ignored',
      error_message = pg_catalog.format('Unhandled event type: %s', p_event_type)
  WHERE id = v_event_record_id;

  RETURN pg_catalog.jsonb_build_object(
    'status', 'unhandled_event_ignored',
    'should_send_email', false
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.process_razorpay_webhook_event(text, text, text, text, bigint, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.process_razorpay_webhook_event(text, text, text, text, bigint, text, text) TO service_role;
