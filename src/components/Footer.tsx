import { Link } from 'react-router-dom'
import { Facebook, Instagram, Twitter, Phone, Mail, MapPin, Heart, Sparkles } from 'lucide-react'
import { motion } from 'framer-motion'
import { useCafeSettings } from '../context/CafeSettingsContext'

export default function Footer() {
  const { settings } = useCafeSettings()

  return (
    <footer className="bg-sage-900 text-cream mt-20 print:hidden relative overflow-hidden border-t border-sage-800">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,_var(--tw-gradient-stops))] from-saffron-500/5 via-transparent to-transparent pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 py-16 grid grid-cols-1 md:grid-cols-3 gap-12 relative z-10">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            {settings.logo_url ? (
              <img src={settings.logo_url} alt="logo" className="w-12 h-12 rounded-2xl object-cover shadow" />
            ) : (
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-sage-600 to-saffron-500 flex items-center justify-center text-white text-xl shadow">
                ☕
              </div>
            )}
            <div>
              <h3 className="font-display text-2xl font-extrabold tracking-tight">{settings.cafe_name ?? 'Saffron & Sage'}</h3>
              <p className="italic text-saffron-400 text-xs font-medium">"{settings.tagline ?? 'Eat Healthy, Stay Healthy'}"</p>
            </div>
          </div>
          <p className="text-sage-300 text-xs sm:text-sm leading-relaxed max-w-sm">
            {settings.about_text ?? 'A cozy mindful sanctuary serving wholesome, freshly prepared meals made from authentic organic ingredients.'}
          </p>
        </div>

        <div>
          <h4 className="text-saffron-400 font-bold text-xs uppercase tracking-wider mb-4">Quick Navigation</h4>
          <ul className="space-y-2.5 text-sm">
            <li><Link to="/" className="text-sage-200 hover:text-white transition-colors">Home Page</Link></li>
            <li><Link to="/menu" className="text-sage-200 hover:text-white transition-colors">Full Food & Beverage Menu</Link></li>
            <li><Link to="/track" className="text-sage-200 hover:text-white transition-colors">Live Order Tracking</Link></li>
            <li><Link to="/reviews" className="text-sage-200 hover:text-white transition-colors">Customer Reviews & Ratings</Link></li>
            <li><Link to="/about" className="text-sage-200 hover:text-white transition-colors">Our Culinary Story</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="text-saffron-400 font-bold text-xs uppercase tracking-wider mb-4">Contact & Location</h4>
          <ul className="space-y-2.5 text-xs sm:text-sm text-sage-200">
            <li className="flex items-center gap-2.5"><Phone size={15} className="text-saffron-400" /> {settings.phone ?? '+91 98765 43210'}</li>
            <li className="flex items-center gap-2.5"><Mail size={15} className="text-saffron-400" /> {settings.email ?? 'hello@saffronsage.cafe'}</li>
            <li className="flex items-center gap-2.5"><MapPin size={15} className="text-saffron-400" /> {settings.address ?? '123 Garden Street'}</li>
          </ul>
          <div className="flex gap-2.5 mt-5">
            <a href={settings.facebook_url || '#'} className="p-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-sage-300 hover:text-white transition-all"><Facebook size={16}/></a>
            <a href={settings.instagram_url || '#'} className="p-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-sage-300 hover:text-white transition-all"><Instagram size={16}/></a>
            <a href={settings.twitter_url || '#'} className="p-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-sage-300 hover:text-white transition-all"><Twitter size={16}/></a>
          </div>
        </div>
      </div>

      <div className="text-center text-xs text-sage-400 py-6 border-t border-sage-800/80 bg-black/20">
        © {new Date().getFullYear()} {settings.cafe_name ?? 'Saffron & Sage'}. All rights reserved. Crafted with organic wellness.
      </div>
    </footer>
  )
}
