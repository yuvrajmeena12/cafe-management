import { supabase } from './supabaseClient'

/**
 * Uploads a file to the "cafe-images" Supabase Storage bucket and returns
 * a public URL you can save straight into menu_items.image_url or
 * cafe_settings.hero_image_url. See supabase/storage-setup.sql for the
 * one-time bucket + policy setup this depends on.
 */
export async function uploadImage(file: File, folder: string): Promise<string> {
  const ext = file.name.split('.').pop() ?? 'jpg'
  const path = `${folder}/${crypto.randomUUID()}.${ext}`

  const { error } = await supabase.storage
    .from('cafe-images')
    .upload(path, file, { upsert: true, cacheControl: '3600' })

  if (error) throw error

  const { data } = supabase.storage.from('cafe-images').getPublicUrl(path)
  return data.publicUrl
}
