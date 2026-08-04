-- ============================================================
-- One-time setup: creates the "cafe-images" bucket and lets
-- admins upload/replace photos, while anyone can view them
-- (needed since customer-facing pages display these images).
-- Run this once in the Supabase SQL Editor.
-- ============================================================

insert into storage.buckets (id, name, public)
values ('cafe-images', 'cafe-images', true)
on conflict (id) do nothing;

-- Public read (so customer pages can display the photos)
create policy "cafe_images_public_read"
on storage.objects for select
using (bucket_id = 'cafe-images');

-- Only admins can upload/replace/delete
create policy "cafe_images_admin_insert"
on storage.objects for insert
with check (bucket_id = 'cafe-images' and is_admin());

create policy "cafe_images_admin_update"
on storage.objects for update
using (bucket_id = 'cafe-images' and is_admin());

create policy "cafe_images_admin_delete"
on storage.objects for delete
using (bucket_id = 'cafe-images' and is_admin());
