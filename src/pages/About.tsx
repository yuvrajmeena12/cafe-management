import { useEffect, useState } from 'react'
import { Phone, Mail, MapPin, Facebook, Instagram, Twitter, Heart, Sparkles } from 'lucide-react'
import { motion } from 'framer-motion'
import { supabase } from '../lib/supabaseClient'
import { useCafeSettings } from '../context/CafeSettingsContext'
import AnimatedPage from '../components/AnimatedPage'
import type { GalleryPhoto } from '../types'

export default function About() {
  const { settings } = useCafeSettings()
  const [photos, setPhotos] = useState<GalleryPhoto[]>([])

  useEffect(() => {
    supabase.from('gallery_photos').select('*').order('sort_order').then(({ data }) => setPhotos((data as GalleryPhoto[]) ?? []))
  }, [])

  return (
    <AnimatedPage>
      {/* Hero Header */}
      <div className="bg-sage-800 text-white py-20 px-6 text-center relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-saffron-500/10 via-transparent to-transparent pointer-events-none" />
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-2xl mx-auto space-y-4 relative z-10"
        >
          {settings.logo_url ? (
            <img src={settings.logo_url} alt="logo" className="w-18 h-18 rounded-3xl object-cover mx-auto shadow-xl border-2 border-white/20 animate-float" />
          ) : (
            <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-saffron-500 to-saffron-600 flex items-center justify-center text-white text-3xl mx-auto shadow-xl">
              🌿
            </div>
          )}
          <h1 className="font-display text-4xl sm:text-5xl font-extrabold">{settings.cafe_name ?? 'Saffron & Sage'}</h1>
          <p className="italic text-saffron-400 font-display text-lg">"{settings.tagline ?? 'Eat Healthy, Stay Healthy'}"</p>
          <p className="text-sage-200 text-sm sm:text-base leading-relaxed">
            {settings.about_text ?? 'A mindful sanctuary serving pure, freshly prepared culinary creations crafted from authentic organic ingredients.'}
          </p>
        </motion.div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-14 space-y-12">
        {/* Contact Info Card */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="card p-8 grid grid-cols-1 sm:grid-cols-3 gap-6 shadow-md border-sage-200/80"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-saffron-50 text-saffron-600 flex items-center justify-center shrink-0">
              <Phone size={20} />
            </div>
            <div>
              <div className="text-xs text-sage-400 font-semibold uppercase">Call Us</div>
              <a href={`tel:${settings.phone ?? '+91 98765 43210'}`} className="font-bold text-sage-800 text-sm hover:text-saffron-600">
                {settings.phone ?? '+91 98765 43210'}
              </a>
            </div>
          </div>

          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-saffron-50 text-saffron-600 flex items-center justify-center shrink-0">
              <Mail size={20} />
            </div>
            <div>
              <div className="text-xs text-sage-400 font-semibold uppercase">Email Us</div>
              <a href={`mailto:${settings.email ?? 'hello@saffronsage.cafe'}`} className="font-bold text-sage-800 text-sm hover:text-saffron-600 truncate block max-w-[180px]">
                {settings.email ?? 'hello@saffronsage.cafe'}
              </a>
            </div>
          </div>

          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-saffron-50 text-saffron-600 flex items-center justify-center shrink-0">
              <MapPin size={20} />
            </div>
            <div>
              <div className="text-xs text-sage-400 font-semibold uppercase">Location</div>
              <div className="font-bold text-sage-800 text-sm">{settings.address ?? '123 Garden Street'}</div>
            </div>
          </div>
        </motion.div>

        {/* Gallery Showcase */}
        {photos.length > 0 && (
          <div className="space-y-6">
            <div className="text-center max-w-xl mx-auto">
              <span className="text-xs font-bold uppercase tracking-wider text-saffron-600">Visual Journey</span>
              <h2 className="font-display text-3xl font-bold text-sage-800 mt-1">A Look Inside Our Cafe</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
              {photos.map((p, i) => (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.05 }}
                  whileHover={{ y: -5 }}
                  className="relative rounded-2xl overflow-hidden group shadow-sm hover:shadow-xl transition-all duration-300 h-56 bg-sage-100"
                >
                  <img src={p.image_url} alt={p.caption ?? ''} className="w-full h-full object-cover group-hover:scale-108 transition-transform duration-500" />
                  {p.caption && (
                    <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent text-white text-xs font-medium px-4 py-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      {p.caption}
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AnimatedPage>
  )
}
