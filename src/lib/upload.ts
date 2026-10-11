import { supabase } from './supabaseClient'

/**
 * Strict whitelist of allowed image MIME types to their canonical file extensions.
 * SVG, HTML, and executables are strictly rejected to prevent Stored XSS and polyglot attacks.
 */
export const ALLOWED_IMAGE_MIME_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

/**
 * Uploads a validated image file to the "cafe-images" Supabase Storage bucket and returns
 * a public URL you can save straight into menu_items.image_url or
 * cafe_settings.hero_image_url.
 *
 * SECURITY:
 * - Derives stored file extension strictly from validated MIME type, NEVER from user's file.name
 * - Randomizes filename via crypto.randomUUID() to prevent collisions and path traversal
 * - Sanitizes folder name to prevent folder path traversal
 * - Explicitly passes contentType to Supabase Storage
 */
export async function uploadImage(file: File, folder: string): Promise<string> {
  const ext = ALLOWED_IMAGE_MIME_TYPES[file.type]
  if (!ext) {
    throw new Error(
      `Unsupported file type "${file.type}". Only JPEG, PNG, and WebP are allowed.`
    )
  }

  // Sanitize folder path against path traversal
  const cleanFolder = folder.replace(/[^a-zA-Z0-9_-]/g, '') || 'general'
  const path = `${cleanFolder}/${crypto.randomUUID()}.${ext}`

  const { error } = await supabase.storage
    .from('cafe-images')
    .upload(path, file, {
      contentType: file.type,
      upsert: true,
      cacheControl: '3600',
    })

  if (error) throw error

  const { data } = supabase.storage.from('cafe-images').getPublicUrl(path)
  return data.publicUrl
}

