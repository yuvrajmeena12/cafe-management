-- ============================================================
-- Saffron & Sage — Database Schema
-- Run this in the Supabase SQL Editor on a fresh project.
-- ============================================================

create extension if not exists "uuid-ossp";

-- PROFILES (extends Supabase auth.users with role info)
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  role text not null default 'customer' check (role in ('customer','staff','admin','delivery')),
  whatsapp_opt_in boolean default true,
  vehicle_type text,
  vehicle_number text,
  vehicle_insurance_expiry date,
  created_at timestamptz default now()
);

-- MENU ITEMS
create table menu_items (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  description text,
  price numeric not null default 0,
  cost_price numeric default 0,
  image_url text,
  category text not null default 'General',
  calories int,
  tags text[] default '{}',
  is_popular boolean default false,
  is_available boolean default true,
  prep_time_minutes int default 10,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ORDERS
create table orders (
  id uuid primary key default uuid_generate_v4(),
  customer_id uuid references profiles(id),
  customer_name text,
  customer_email text,
  status text not null default 'received'
    check (status in ('received','preparing','ready','out_for_delivery','delivered','cancelled')),
  order_type text not null default 'delivery' check (order_type in ('dine_in','pickup','delivery')),
  delivery_lat float8,
  delivery_lng float8,
  delivery_address text,
  subtotal numeric not null default 0,
  discount_amount numeric not null default 0,
  tax numeric not null default 0,
  total numeric not null default 0,
  payment_status text not null default 'pending' check (payment_status in ('pending','paid','failed','refunded')),
  payment_method text not null default 'online' check (payment_method in ('online','cod')),
  payment_id text,
  razorpay_order_id text,
  assigned_delivery_id uuid references profiles(id),
  customer_phone text,
  delivery_charge numeric default 0,
  delivery_rating int check (delivery_rating between 1 and 5),
  delivered_at timestamptz,
  delivery_stage text check (delivery_stage in ('assigned','picked_up','on_the_way','reached','delivered')),
  is_cash_deposited boolean default false,
  placed_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table order_items (
  id uuid primary key default uuid_generate_v4(),
  order_id uuid references orders(id) on delete cascade,
  menu_item_id uuid references menu_items(id),
  quantity int not null default 1,
  unit_price numeric not null,
  notes text
);

-- INVENTORY
create table inventory_items (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  quantity numeric not null default 0,
  unit text not null default 'kg',
  min_level numeric not null default 0,
  cost_per_unit numeric not null default 0,
  updated_at timestamptz default now()
);

-- STAFF
create table staff (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  role text,
  phone text,
  email text,
  shift text default 'Morning',
  monthly_salary numeric default 0,
  active boolean default true,
  created_at timestamptz default now()
);

-- EXPENSES
create table expenses (
  id uuid primary key default uuid_generate_v4(),
  category text not null,
  amount numeric not null,
  note text,
  date date not null default current_date
);

-- DISCOUNTS
create table discounts (
  id uuid primary key default uuid_generate_v4(),
  code text unique not null,
  type text not null default 'percent' check (type in ('percent','flat')),
  value numeric not null,
  min_order_value numeric default 0,
  valid_from date,
  valid_to date,
  applicable_items uuid[],
  active boolean default true
);

-- REVIEWS
create table reviews (
  id uuid primary key default uuid_generate_v4(),
  customer_id uuid references profiles(id),
  order_id uuid references orders(id),
  menu_item_id uuid references menu_items(id),
  rating int not null check (rating between 1 and 5),
  comment text,
  category text check (category in ('Late Delivery','Cold Food','Packaging Issue','Taste','Other')),
  created_at timestamptz default now()
);

-- CAFE SETTINGS (singleton row, id always = 1)
create table cafe_settings (
  id int primary key default 1,
  cafe_name text default 'Saffron & Sage',
  tagline text default 'Eat Healthy, Stay Healthy',
  logo_url text,
  hero_image_url text,
  about_text text,
  phone text,
  email text,
  address text,
  address_lat float8,
  address_lng float8,
  facebook_url text,
  instagram_url text,
  twitter_url text,
  constraint single_row check (id = 1)
);
insert into cafe_settings (id) values (1);

-- DELIVERY CHARGE TIERS (admin-configurable distance-based pricing)
create table delivery_charge_tiers (
  id uuid primary key default uuid_generate_v4(),
  max_km numeric not null,
  charge numeric not null,
  created_at timestamptz default now()
);
insert into delivery_charge_tiers (max_km, charge) values (2, 5), (5, 15), (10, 20);

-- GALLERY (About page photos, admin-managed)
create table gallery_photos (
  id uuid primary key default uuid_generate_v4(),
  image_url text not null,
  caption text,
  sort_order int default 0,
  created_at timestamptz default now()
);

-- ROLE INVITES (pre-assign a role to an email before they sign up)
create table role_invites (
  email text primary key,
  role text not null check (role in ('customer','staff','admin','delivery')),
  created_at timestamptz default now()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table profiles enable row level security;
alter table menu_items enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table inventory_items enable row level security;
alter table staff enable row level security;
alter table expenses enable row level security;
alter table discounts enable row level security;
alter table reviews enable row level security;
alter table cafe_settings enable row level security;
alter table delivery_charge_tiers enable row level security;
alter table gallery_photos enable row level security;
alter table role_invites enable row level security;

-- Helper: is the current user an admin?
create or replace function is_admin() returns boolean as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = 'admin'
  );
$$ language sql security definer;

-- Helper: is the current user a delivery staff member (or admin)?
create or replace function is_delivery() returns boolean as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role in ('delivery','admin')
  );
$$ language sql security definer;

-- Profiles: users see/edit their own row; admins see all
create policy "profiles_select_own_or_admin" on profiles for select using (id = auth.uid() or is_admin());
create policy "profiles_update_own" on profiles for update using (id = auth.uid());
create policy "profiles_insert_own" on profiles for insert with check (id = auth.uid());

-- Menu: public read, admin write
create policy "menu_public_read" on menu_items for select using (true);
create policy "menu_admin_write" on menu_items for insert with check (is_admin());
create policy "menu_admin_update" on menu_items for update using (is_admin());
create policy "menu_admin_delete" on menu_items for delete using (is_admin());

-- Cafe settings: public read, admin write
create policy "settings_public_read" on cafe_settings for select using (true);
create policy "settings_admin_write" on cafe_settings for insert with check (is_admin());
create policy "settings_admin_update" on cafe_settings for update using (is_admin());

-- Discounts: public read (to validate codes at checkout), admin write
create policy "discounts_public_read" on discounts for select using (true);
create policy "discounts_admin_write" on discounts for insert with check (is_admin());
create policy "discounts_admin_update" on discounts for update using (is_admin());
create policy "discounts_admin_delete" on discounts for delete using (is_admin());

-- Delivery charge tiers: public read (checkout needs to compute the fee), admin write
create policy "delivery_tiers_public_read" on delivery_charge_tiers for select using (true);
create policy "delivery_tiers_admin_write" on delivery_charge_tiers for insert with check (is_admin());
create policy "delivery_tiers_admin_update" on delivery_charge_tiers for update using (is_admin());
create policy "delivery_tiers_admin_delete" on delivery_charge_tiers for delete using (is_admin());

-- Gallery: public read (About page), admin write
create policy "gallery_public_read" on gallery_photos for select using (true);
create policy "gallery_admin_write" on gallery_photos for insert with check (is_admin());
create policy "gallery_admin_update" on gallery_photos for update using (is_admin());
create policy "gallery_admin_delete" on gallery_photos for delete using (is_admin());

-- Role invites: admin-only, end to end
create policy "role_invites_admin_only" on role_invites for all using (is_admin()) with check (is_admin());

-- Reviews: public read, customers can insert their own, admin can delete any
create policy "reviews_public_read" on reviews for select using (true);
create policy "reviews_customer_insert" on reviews for insert with check (customer_id = auth.uid());
create policy "reviews_admin_delete" on reviews for delete using (is_admin());

-- Orders: customers see their own; admins and delivery staff see all; anyone can create an order (guest checkout)
create policy "orders_select_own_or_admin" on orders for select using (customer_id = auth.uid() or is_admin() or is_delivery());
create policy "orders_insert_any" on orders for insert with check (true);
create policy "orders_admin_update" on orders for update using (is_admin() or customer_id = auth.uid() or is_delivery());

create policy "order_items_select" on order_items for select using (
  exists (select 1 from orders o where o.id = order_id and (o.customer_id = auth.uid() or is_admin() or is_delivery()))
);
create policy "order_items_insert" on order_items for insert with check (true);

-- Inventory, staff, expenses: admin only, end to end
create policy "inventory_admin_all" on inventory_items for all using (is_admin()) with check (is_admin());
create policy "staff_admin_all" on staff for all using (is_admin()) with check (is_admin());
create policy "expenses_admin_all" on expenses for all using (is_admin()) with check (is_admin());

-- ============================================================
-- REALTIME
-- ============================================================
alter publication supabase_realtime add table orders;
alter publication supabase_realtime add table menu_items;


-- ============================================================
-- SIGNUP TRIGGER: auto-creates a profile row for every new user,
-- honoring any pre-assigned role from role_invites.
-- ============================================================
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

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- PERFORMANCE INDEXES
-- ============================================================
create index idx_orders_status on orders(status);
create index idx_orders_customer_id on orders(customer_id);
create index idx_orders_placed_at on orders(placed_at desc);
create index idx_orders_assigned_delivery_id on orders(assigned_delivery_id);
create index idx_menu_items_category on menu_items(category);
create index idx_order_items_order_id on order_items(order_id);
create index idx_order_items_menu_item_id on order_items(menu_item_id);
create index idx_reviews_menu_item_id on reviews(menu_item_id);
