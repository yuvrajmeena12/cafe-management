import { Link } from 'react-router-dom'
import { Facebook, Instagram, Twitter, Phone, Mail, MapPin } from 'lucide-react'
import { useCafeSettings } from '../context/CafeSettingsContext'

export default function Footer() {
  const { settings } = useCafeSettings()

  return (
    <footer className="bg-sage-700 text-cream mt-16 print:hidden">
      <div className="max-w-7xl mx-auto px-6 py-12 grid grid-cols-1 md:grid-cols-3 gap-10">
        <div>
          <div className="flex items-center gap-3 mb-3">
            {settings.logo_url ? (
              <img src={settings.logo_url} alt="logo" className="w-12 h-12 rounded-xl object-cover flex-shrink-0" />
            ) : (
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-sage-500 to-saffron-500 flex items-center justify-center text-white text-xl flex-shrink-0">☕</div>
            )}
            <h3 className="font-display text-xl font-bold">{settings.cafe_name ?? 'Saffron & Sage'}</h3>
          </div>
          <p className="text-sage-100 text-sm mb-3">
            {settings.about_text ?? 'A cozy cafe serving wholesome, freshly prepared meals made from locally sourced ingredients.'}
          </p>
          <p className="italic text-saffron-400 text-sm">"{settings.tagline ?? 'Eat Healthy, Stay Healthy'}"</p>
        </div>
        <div>
          <h4 className="text-saffron-400 font-semibold mb-3">Explore</h4>
          <ul className="space-y-2 text-sm">
            <li><Link to="/">Home</Link></li>
            <li><Link to="/menu">Menu</Link></li>
            <li><Link to="/track">Track Order</Link></li>
            <li><Link to="/reviews">Reviews</Link></li>
            <li><Link to="/about">About</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="text-saffron-400 font-semibold mb-3">Get in Touch</h4>
          <ul className="space-y-2 text-sm">
            <li className="flex items-center gap-2"><Phone size={14}/> {settings.phone ?? '+91 98765 43210'}</li>
            <li className="flex items-center gap-2"><Mail size={14}/> {settings.email ?? 'hello@saffronsage.cafe'}</li>
            <li className="flex items-center gap-2"><MapPin size={14}/> {settings.address ?? '123 Garden Street'}</li>
          </ul>
          <div className="flex gap-2 mt-4">
            <a href={settings.facebook_url || '#'} className="p-2 bg-sage-600 rounded-lg"><Facebook size={16}/></a>
            <a href={settings.instagram_url || '#'} className="p-2 bg-sage-600 rounded-lg"><Instagram size={16}/></a>
            <a href={settings.twitter_url || '#'} className="p-2 bg-sage-600 rounded-lg"><Twitter size={16}/></a>
          </div>
        </div>
      </div>
      <div className="text-center text-xs text-sage-200 py-4 border-t border-sage-600">
        © {new Date().getFullYear()} {settings.cafe_name ?? 'Saffron & Sage'}. All rights reserved.
      </div>
    </footer>
  )
}
