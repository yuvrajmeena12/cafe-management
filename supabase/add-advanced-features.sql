-- ============================================================
-- Migration: role management, delivery upgrades, gallery,
-- branding, and performance indexes.
-- Run this once in the SQL Editor on your existing project.
-- ============================================================

-- BRANDING: logo separate from the homepage hero image
alter table cafe_settings add column if not exists logo_url text;

-- DELIVERY: one-tap status stepper (separate from the main order status,
-- so kitchen/admin views stay simple while riders get a finer-grained flow)
alter table orders add column if not exists delivery_stage text
  check (delivery_stage in ('assigned','picked_up','on_the_way','reached','delivered'));
alter table orders add column if not exists is_cash_deposited boolean default false;

-- DELIVERY: rider vehicle details (self-editable "My Vehicle" panel)
alter table profiles add column if not exists vehicle_type text;
alter table profiles add column if not exists vehicle_number text;
alter table profiles add column if not exists vehicle_insurance_expiry date;

-- GALLERY: admin-managed photos for the About page
create table if not exists gallery_photos (
  id uuid primary key default uuid_generate_v4(),
  image_url text not null,
  caption text,
  sort_order int default 0,
  created_at timestamptz default now()
);
alter table gallery_photos enable row level security;
drop policy if exists "gallery_public_read" on gallery_photos;
create policy "gallery_public_read" on gallery_photos for select using (true);
drop policy if exists "gallery_admin_write" on gallery_photos;
create policy "gallery_admin_write" on gallery_photos for insert with check (is_admin());
drop policy if exists "gallery_admin_update" on gallery_photos;
create policy "gallery_admin_update" on gallery_photos for update using (is_admin());
drop policy if exists "gallery_admin_delete" on gallery_photos;
create policy "gallery_admin_delete" on gallery_photos for delete using (is_admin());

-- ROLE MANAGEMENT: pre-assign a role to an email before they even sign up
create table if not exists role_invites (
  email text primary key,
  role text not null check (role in ('customer','staff','admin','delivery')),
  created_at timestamptz default now()
);
alter table role_invites enable row level security;
drop policy if exists "role_invites_admin_only" on role_invites;
create policy "role_invites_admin_only" on role_invites for all using (is_admin()) with check (is_admin());

-- Update the signup trigger to honor any pre-assigned role for this email
create or replace function public.handle_new_user()
returns trigger as $$
declare
  invited_role text;
begin
  select role into invited_role from public.role_invites where email = new.email;

  insert into public.profiles (id, full_name, role)
  values (new.id, new.raw_user_meta_data->>'full_name', coalesce(invited_role, 'customer'))
  on conflict (id) do nothing;

  if invited_role is not null then
    delete from public.role_invites where email = new.email;
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path = public;

-- PERFORMANCE: indexes on the columns most frequently filtered/sorted
create index if not exists idx_orders_status on orders(status);
create index if not exists idx_orders_customer_id on orders(customer_id);
create index if not exists idx_orders_placed_at on orders(placed_at desc);
create index if not exists idx_orders_assigned_delivery_id on orders(assigned_delivery_id);
create index if not exists idx_menu_items_category on menu_items(category);
create index if not exists idx_order_items_order_id on order_items(order_id);
create index if not exists idx_order_items_menu_item_id on order_items(menu_item_id);
create index if not exists idx_reviews_menu_item_id on reviews(menu_item_id);
