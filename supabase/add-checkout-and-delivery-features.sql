-- ============================================================
-- Migration: contact phone on orders, Cash-on-Delivery support,
-- distance-based delivery charges, and rider ratings.
-- Run this once in the SQL Editor on your existing project.
-- ============================================================

alter table orders add column if not exists customer_phone text;
alter table orders add column if not exists payment_method text check (payment_method in ('online','cod')) default 'online';
alter table orders add column if not exists delivery_charge numeric default 0;
alter table orders add column if not exists delivery_rating int check (delivery_rating between 1 and 5);
alter table orders add column if not exists delivered_at timestamptz;

-- Admin-configurable distance-based delivery charge tiers
create table if not exists delivery_charge_tiers (
  id uuid primary key default uuid_generate_v4(),
  max_km numeric not null,
  charge numeric not null,
  created_at timestamptz default now()
);

alter table delivery_charge_tiers enable row level security;

drop policy if exists "delivery_tiers_public_read" on delivery_charge_tiers;
create policy "delivery_tiers_public_read" on delivery_charge_tiers for select using (true);

drop policy if exists "delivery_tiers_admin_write" on delivery_charge_tiers;
create policy "delivery_tiers_admin_write" on delivery_charge_tiers for insert with check (is_admin());

drop policy if exists "delivery_tiers_admin_update" on delivery_charge_tiers;
create policy "delivery_tiers_admin_update" on delivery_charge_tiers for update using (is_admin());

drop policy if exists "delivery_tiers_admin_delete" on delivery_charge_tiers;
create policy "delivery_tiers_admin_delete" on delivery_charge_tiers for delete using (is_admin());

-- Seed 3 starter tiers only if the table is currently empty
insert into delivery_charge_tiers (max_km, charge)
select * from (values (2::numeric, 5::numeric), (5::numeric, 15::numeric), (10::numeric, 20::numeric)) as v(max_km, charge)
where not exists (select 1 from delivery_charge_tiers);
