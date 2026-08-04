import { useEffect, useState } from 'react'
import { Phone, Mail, MapPin, Facebook, Instagram, Twitter } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { useCafeSettings } from '../context/CafeSettingsContext'
import type { GalleryPhoto } from '../types'

export default function About() {
  const { settings } = useCafeSettings()
  const [photos, setPhotos] = useState<GalleryPhoto[]>([])

  useEffect(() => {
    supabase.from('gallery_photos').select('*').order('sort_order').then(({ data }) => setPhotos((data as GalleryPhoto[]) ?? []))
  }, [])

  return (
    <div>
      <div className="bg-sage-700 text-white py-16 px-6 text-center">
        {settings.logo_url && <img src={settings.logo_url} alt="logo" className="w-16 h-16 rounded-2xl object-cover mx-auto mb-4" />}
        <h1 className="font-display text-4xl font-bold mb-2">{settings.cafe_name ?? 'Saffron & Sage'}</h1>
        <p className="italic text-saffron-400 mb-4">"{settings.tagline ?? 'Eat Healthy, Stay Healthy'}"</p>
        <p className="max-w-xl mx-auto text-sage-100 leading-relaxed">
          {settings.about_text ?? 'A cozy cafe serving wholesome, freshly prepared meals made from locally sourced ingredients.'}
        </p>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-12">
        <div className="card p-6 space-y-3 mb-10">
          <div className="flex items-center gap-3 text-sage-700"><Phone size={18} className="text-saffron-500" /> {settings.phone ?? '+91 98765 43210'}</div>
          <div className="flex items-center gap-3 text-sage-700"><Mail size={18} className="text-saffron-500" /> {settings.email ?? 'hello@saffronsage.cafe'}</div>
          <div className="flex items-center gap-3 text-sage-700"><MapPin size={18} className="text-saffron-500" /> {settings.address ?? '123 Garden Street'}</div>
          <div className="flex gap-3 pt-2">
            <a href={settings.facebook_url || '#'} className="p-2 bg-sage-50 rounded-lg"><Facebook size={18} /></a>
            <a href={settings.instagram_url || '#'} className="p-2 bg-sage-50 rounded-lg"><Instagram size={18} /></a>
            <a href={settings.twitter_url || '#'} className="p-2 bg-sage-50 rounded-lg"><Twitter size={18} /></a>
          </div>
        </div>

        {photos.length > 0 && (
          <div>
            <h2 className="font-display text-2xl font-bold text-sage-700 mb-4">A Look Inside</h2>
            {/* auto-fill grid: adapts cleanly whether there are 3 photos or 300 */}
            <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
              {photos.map((p) => (
                <div key={p.id} className="relative rounded-xl overflow-hidden">
                  <img src={p.image_url} alt={p.caption ?? ''} className="w-full h-48 object-cover" />
                  {p.caption && <div className="absolute bottom-0 inset-x-0 bg-black/50 text-white text-sm px-3 py-2">{p.caption}</div>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
