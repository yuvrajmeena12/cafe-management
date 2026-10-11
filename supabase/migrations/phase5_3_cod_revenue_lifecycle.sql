-- ============================================================
-- Saffron & Sage — Phase 5.3 COD Order Lifecycle & Revenue Calculation
-- Migration: Updates get_admin_dashboard_stats RPC to count COD
-- revenue only upon completed delivery and confirmed cash collection,
-- and online revenue based on verified successful payments.
-- ============================================================

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

-- Restrict RPC execution: revoke from anon, grant to authenticated and service_role
REVOKE EXECUTE ON FUNCTION public.get_admin_dashboard_stats(timestamptz, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_dashboard_stats(timestamptz, timestamptz) TO authenticated, service_role;
