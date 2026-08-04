-- ============================================================
-- Migration: server-side aggregate stats (so the homepage doesn't
-- download every review/order just to count them), plus a couple
-- of scaling notes below.
-- Run this once in the SQL Editor on your existing project.
-- ============================================================

create or replace function public.get_site_stats()
returns table(avg_rating numeric, menu_item_count bigint, happy_customers bigint)
language sql
security definer
set search_path = public
as $$
  select
    (select round(avg(rating)::numeric, 1) from reviews),
    (select count(*) from menu_items where is_available = true),
    (select count(distinct customer_email) from orders where payment_status = 'paid');
$$;

grant execute on function public.get_site_stats() to anon, authenticated;

-- ============================================================
-- SCALING NOTES (for handling 5,000–10,000+ users)
-- ============================================================
-- 1. Indexes were already added in add-advanced-features.sql —
--    confirm that migration has been run if you haven't already.
-- 2. This function above is the pattern to follow for any other
--    "count/average across many rows" feature: let Postgres do the
--    counting and only send 1 row over the wire, instead of pulling
--    thousands of rows into the browser to count client-side.
-- 3. Supabase's connection pooler (PgBouncer) is already enabled by
--    default on hosted projects — no action needed there.
-- 4. As real traffic grows, consider upgrading your Supabase plan
--    (compute size) before you hit the free tier's request/connection
--    ceiling — this is an infrastructure decision, not a code fix.
