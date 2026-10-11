-- ============================================================
-- Saffron & Sage — Phase 5.2 Razorpay payment_id Integrity
-- Migration: Enforces partial unique constraint on orders.payment_id.
-- Checks for existing duplicate non-null payment_ids before indexing.
-- Non-destructive and idempotent.
-- ============================================================

DO $$
DECLARE
  v_dup_count integer;
BEGIN
  -- 1. Check for duplicate non-null payment_id records in orders table
  SELECT COUNT(*) INTO v_dup_count
  FROM (
    SELECT payment_id
    FROM public.orders
    WHERE payment_id IS NOT NULL
    GROUP BY payment_id
    HAVING COUNT(*) > 1
  ) dups;

  IF v_dup_count > 0 THEN
    RAISE EXCEPTION 'Cannot create unique index: % duplicate non-null payment_id value(s) detected in public.orders. Resolve duplicates before applying migration.', v_dup_count
      USING ERRCODE = '23505';
  END IF;
END $$;

-- 2. Create partial unique index on orders(payment_id)
CREATE UNIQUE INDEX IF NOT EXISTS uq_orders_payment_id
ON public.orders (payment_id)
WHERE payment_id IS NOT NULL;
