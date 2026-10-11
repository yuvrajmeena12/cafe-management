-- ============================================================
-- Saffron & Sage — Phase 3 Database Optimization Migration
-- Migration: Performance indexes, RLS volatility optimization,
-- and secure server-side Admin Dashboard aggregation RPC.
-- ============================================================

-- 1. Index for Razorpay webhook order matching
-- Resolves full sequential scan on orders when payment webhooks arrive.
CREATE INDEX IF NOT EXISTS idx_orders_razorpay_order_id
  ON public.orders(razorpay_order_id);

-- 2. Composite index for paid order financial queries and analytics
-- Optimizes Dashboard revenue sums, voice assistant analytics, and AI scoring.
CREATE INDEX IF NOT EXISTS idx_orders_payment_status_placed_at
  ON public.orders(payment_status, placed_at DESC);

-- 3. Index for chronological customer and admin review ordering
-- Eliminates in-memory sorting for reviews pagination and moderation.
CREATE INDEX IF NOT EXISTS idx_reviews_created_at
  ON public.reviews(created_at DESC);

-- 4. Index for customer review status lookup
-- Accelerates "find which delivered orders this customer reviewed".
CREATE INDEX IF NOT EXISTS idx_reviews_customer_id
  ON public.reviews(customer_id);

-- 5. Index for chronological expense ordering
-- Accelerates sorting on the Admin Expenses ledger.
CREATE INDEX IF NOT EXISTS idx_expenses_date
  ON public.expenses(date DESC);

-- 6. Optimize RLS helper function volatility
-- Marking helper functions STABLE prevents per-row re-evaluation during bulk queries.
ALTER FUNCTION public.is_admin() STABLE;
ALTER FUNCTION public.is_delivery() STABLE;

-- 7. Server-side Admin Dashboard Aggregation RPC
-- Replaces client-side downloading and summing of all historical orders and expenses.
-- Uses half-open interval [v_start, v_end) for microsecond-precise date boundary queries.
-- Protected: Verifies caller is an admin using public.is_admin().
CREATE OR REPLACE FUNCTION public.get_admin_dashboard_stats(
  today_start timestamptz DEFAULT NULL,
  today_end timestamptz DEFAULT NULL
)
RETURNS TABLE (
  revenue numeric,
  expenses numeric,
  total_orders bigint,
  pending_orders bigint,
  todays_orders bigint,
  low_stock bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_start timestamptz := COALESCE(today_start, date_trunc('day', now()));
  v_end timestamptz := COALESCE(today_end, v_start + interval '1 day');
BEGIN
  -- Strict administrative authorization check
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied: Administrator privileges required.'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    COALESCE((
      SELECT SUM(o.total)
      FROM public.orders o
      WHERE (o.payment_method = 'online' AND o.payment_status = 'paid')
         OR (o.payment_method = 'cod' AND o.status = 'delivered' AND o.payment_status = 'paid')
    ), 0)::numeric AS revenue,
    COALESCE((SELECT SUM(e.amount) FROM public.expenses e), 0)::numeric AS expenses,
    COALESCE((SELECT COUNT(*) FROM public.orders), 0)::bigint AS total_orders,
    COALESCE((SELECT COUNT(*) FROM public.orders o WHERE o.status NOT IN ('delivered', 'cancelled')), 0)::bigint AS pending_orders,
    COALESCE((SELECT COUNT(*) FROM public.orders o WHERE o.placed_at >= v_start AND o.placed_at < v_end), 0)::bigint AS todays_orders,
    COALESCE((SELECT COUNT(*) FROM public.inventory_items i WHERE i.quantity < i.min_level), 0)::bigint AS low_stock;
END;
$$;

-- Restrict RPC execution: revoke from anon, grant only to authenticated and service_role
REVOKE EXECUTE ON FUNCTION public.get_admin_dashboard_stats(timestamptz, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_dashboard_stats(timestamptz, timestamptz) TO authenticated, service_role;
