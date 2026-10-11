-- ============================================================
-- Saffron & Sage — Phase 4B-3 Upload Security & SVG Elimination
-- Migration: Hardens the "cafe-images" Supabase Storage bucket
-- with strict allowed_mime_types (JPEG, PNG, WebP) and 5MB size limit.
-- Adds safe database check constraints on image_url columns to prevent
-- dangerous protocols (javascript:, data:) and SVG files from being persisted.
-- ============================================================

-- 1. STORAGE BUCKET HARDENING (SEC-P1-STORAGE-MIME-SIZE)
-- Idempotently update or insert the 'cafe-images' bucket with strict MIME and size caps
INSERT INTO storage.buckets (id, name, public, allowed_mime_types, file_size_limit)
VALUES (
  'cafe-images',
  'cafe-images',
  true,
  ARRAY['image/jpeg', 'image/png', 'image/webp'],
  5242880 -- 5 MB in bytes
)
ON CONFLICT (id) DO UPDATE
SET allowed_mime_types = EXCLUDED.allowed_mime_types,
    file_size_limit = EXCLUDED.file_size_limit,
    public = true;


-- 2. ENSURE STORAGE POLICIES ARE PRESERVED AND ENFORCED
-- Public read access so customer-facing menu and gallery pages can display images
DROP POLICY IF EXISTS "cafe_images_public_read" ON storage.objects;
CREATE POLICY "cafe_images_public_read"
ON storage.objects FOR SELECT
USING (bucket_id = 'cafe-images');

-- Only admins can upload, update, or delete
DROP POLICY IF EXISTS "cafe_images_admin_insert" ON storage.objects;
CREATE POLICY "cafe_images_admin_insert"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'cafe-images' AND is_admin());

DROP POLICY IF EXISTS "cafe_images_admin_update" ON storage.objects;
CREATE POLICY "cafe_images_admin_update"
ON storage.objects FOR UPDATE
USING (bucket_id = 'cafe-images' AND is_admin());

DROP POLICY IF EXISTS "cafe_images_admin_delete" ON storage.objects;
CREATE POLICY "cafe_images_admin_delete"
ON storage.objects FOR DELETE
USING (bucket_id = 'cafe-images' AND is_admin());


-- 3. DATABASE IMAGE URL INTEGRITY CONSTRAINTS (SEC-P3-URL-INTEGRITY)
-- Guarantees that stored image URLs:
-- - Are either NULL or empty (for unconfigured fields)
-- - Start with 'https://' or '/' (strictly rejecting http:, javascript:, data:, etc.)
-- - Do NOT reference SVG files (.svg) to eliminate SVG-based XSS vectors

-- menu_items.image_url
ALTER TABLE public.menu_items
  DROP CONSTRAINT IF EXISTS chk_menu_items_image_url_safe;

ALTER TABLE public.menu_items
  ADD CONSTRAINT chk_menu_items_image_url_safe
  CHECK (
    image_url IS NULL
    OR image_url = ''
    OR (
      (image_url ~* '^(https://|/)[^\s]+$')
      AND (image_url !~* '\.svg([?#].*)?$')
    )
  );

-- cafe_settings.logo_url
ALTER TABLE public.cafe_settings
  DROP CONSTRAINT IF EXISTS chk_cafe_settings_logo_url_safe;

ALTER TABLE public.cafe_settings
  ADD CONSTRAINT chk_cafe_settings_logo_url_safe
  CHECK (
    logo_url IS NULL
    OR logo_url = ''
    OR (
      (logo_url ~* '^(https://|/)[^\s]+$')
      AND (logo_url !~* '\.svg([?#].*)?$')
    )
  );

-- cafe_settings.hero_image_url
ALTER TABLE public.cafe_settings
  DROP CONSTRAINT IF EXISTS chk_cafe_settings_hero_image_url_safe;

ALTER TABLE public.cafe_settings
  ADD CONSTRAINT chk_cafe_settings_hero_image_url_safe
  CHECK (
    hero_image_url IS NULL
    OR hero_image_url = ''
    OR (
      (hero_image_url ~* '^(https://|/)[^\s]+$')
      AND (hero_image_url !~* '\.svg([?#].*)?$')
    )
  );

-- gallery_photos.image_url
ALTER TABLE public.gallery_photos
  DROP CONSTRAINT IF EXISTS chk_gallery_photos_image_url_safe;

ALTER TABLE public.gallery_photos
  ADD CONSTRAINT chk_gallery_photos_image_url_safe
  CHECK (
    image_url IS NULL
    OR image_url = ''
    OR (
      (image_url ~* '^(https://|/)[^\s]+$')
      AND (image_url !~* '\.svg([?#].*)?$')
    )
  );
