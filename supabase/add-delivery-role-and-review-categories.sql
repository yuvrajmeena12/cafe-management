-- ============================================================
-- Migration: adds delivery-staff role support and review
-- categorization (for the AI Review Analysis breakdown).
-- Run this once in the SQL Editor on your existing project.
-- ============================================================

-- Allow 'delivery' as a valid profile role
alter table profiles drop constraint if exists profiles_role_check;
alter table profiles add constraint profiles_role_check check (role in ('customer','staff','admin','delivery'));

-- Track which delivery person picked up each order
alter table orders add column if not exists assigned_delivery_id uuid references profiles(id);

-- Let reviews carry a category, so complaints can be tallied automatically
alter table reviews add column if not exists category text
  check (category in ('Late Delivery','Cold Food','Packaging Issue','Taste','Other'));

-- Helper: is the current user a delivery staff member (or admin)?
create or replace function is_delivery() returns boolean as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role in ('delivery','admin')
  );
$$ language sql security definer;

-- Delivery staff need to see + update orders that are ready for pickup/delivery
drop policy if exists "orders_admin_update" on orders;
create policy "orders_admin_update" on orders for update
  using (is_admin() or customer_id = auth.uid() or is_delivery());

drop policy if exists "orders_select_own_or_admin" on orders;
create policy "orders_select_own_or_admin" on orders for select
  using (customer_id = auth.uid() or is_admin() or is_delivery());

drop policy if exists "order_items_select" on order_items;
create policy "order_items_select" on order_items for select using (
  exists (select 1 from orders o where o.id = order_id and (o.customer_id = auth.uid() or is_admin() or is_delivery()))
);
