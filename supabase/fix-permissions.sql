-- ============================================================
-- Saffron & Sage — Public Access & RLS Policy Fix
-- Run this in your Supabase SQL Editor to make sure unauthenticated
-- visitors (logged out) can read the menu, cafe settings, reviews,
-- discounts, and gallery photos without errors.
-- ============================================================

-- 1. Grant usage on schema public to anon and authenticated
grant usage on schema public to anon, authenticated;

-- 2. Grant SELECT on public tables to anon and authenticated
grant select on all tables in schema public to anon, authenticated;
grant insert on orders, order_items, reviews, profiles to anon, authenticated;
grant update on orders, profiles to anon, authenticated;

-- 3. Ensure public read RLS policies exist for customer tables
drop policy if exists "menu_public_read" on menu_items;
create policy "menu_public_read" on menu_items for select using (true);

drop policy if exists "settings_public_read" on cafe_settings;
create policy "settings_public_read" on cafe_settings for select using (true);

drop policy if exists "discounts_public_read" on discounts;
create policy "discounts_public_read" on discounts for select using (true);

drop policy if exists "reviews_public_read" on reviews;
create policy "reviews_public_read" on reviews for select using (true);

drop policy if exists "gallery_public_read" on gallery_photos;
create policy "gallery_public_read" on gallery_photos for select using (true);

drop policy if exists "delivery_tiers_public_read" on delivery_charge_tiers;
create policy "delivery_tiers_public_read" on delivery_charge_tiers for select using (true);

-- 4. Enable Realtime for live kitchen and status updates
alter publication supabase_realtime add table menu_items;
alter publication supabase_realtime add table orders;
alter publication supabase_realtime add table cafe_settings;
