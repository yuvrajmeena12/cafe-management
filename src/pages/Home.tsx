import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { Star, Coffee, Heart, Sparkles, TrendingUp, HelpCircle } from 'lucide-react'
import { useMenu } from '../hooks/useMenu'
import ProductCard from '../components/ProductCard'
import HeroQuoteOverlay from '../components/HeroQuoteOverlay'
import { predictNextWeek, fetchItemOrderCounts } from '../lib/ai'
import { supabase } from '../lib/supabaseClient'
import { useCafeSettings } from '../context/CafeSettingsContext'
import type { MenuItem } from '../types'

export default function Home() {
  const { items } = useMenu()
  const { settings } = useCafeSettings()
  const popular = items.filter((i) => i.is_popular).slice(0, 4)

  const [avgRating, setAvgRating] = useState<number | null>(null)
  const [happyCustomers, setHappyCustomers] = useState<number | null>(null)
  const [trendingPicks, setTrendingPicks] = useState<{ item: MenuItem; predictedOrders: number; confidence: number }[]>([])
  const [showConfidenceInfo, setShowConfidenceInfo] = useState(false)

  useEffect(() => {
    // One small server-side aggregate call instead of downloading every
    // review and every paid order just to count them in the browser —
    // this is what keeps the homepage fast as order history grows.
    supabase.rpc('get_site_stats').single().then(({ data }) => {
      if (data) {
        setAvgRating(data.avg_rating)
        setHappyCustomers(data.happy_customers)
      }
    })
  }, [])

  useEffect(() => {
    if (items.length === 0) return
    fetchItemOrderCounts().then((counts) => {
      const ranked = items
        .map((item) => {
          const c = counts[item.id] ?? { thisWeek: 0, lastWeek: 0 }
          return { item, ...predictNextWeek(c.thisWeek, c.lastWeek) }
        })
        .sort((a, b) => b.predictedOrders - a.predictedOrders)
        .slice(0, 4)
      setTrendingPicks(ranked)
    })
  }, [items])

  return (
    <div>
      <section className="relative h-[520px] flex items-center overflow-hidden">
        <HeroQuoteOverlay />
        <img
          src={settings.hero_image_url || 'https://images.pexels.com/photos/972845/pexels-photo-972845.jpeg?auto=compress'}
          alt="Cafe interior"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-sage-900/80 to-sage-900/30" />
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="relative z-10 max-w-2xl px-6 md:px-16 text-white"
        >
          <span className="inline-block bg-white/20 backdrop-blur px-4 py-1 rounded-full text-sm mb-4">
            🌿 Farm to table, fresh every day
          </span>
          <h1 className="font-display text-5xl md:text-6xl font-bold mb-3">{settings.cafe_name ?? 'Saffron & Sage'}</h1>
          <p className="italic text-saffron-400 text-xl mb-4">"{settings.tagline ?? 'Eat Healthy, Stay Healthy'}"</p>
          <p className="text-sage-100 mb-6">
            {settings.about_text ?? 'Where every dish tells a story of wellness. Fresh ingredients, bold flavors, and a warm atmosphere that feels like home.'}
          </p>
          <div className="flex gap-4">
            <Link to="/menu" className="btn-primary">🍴 Explore Menu</Link>
            <Link to="/track" className="btn-secondary">📍 Track Order</Link>
          </div>
          <div className="flex gap-8 mt-8 text-sm">
            <div><div className="font-bold text-lg flex items-center gap-1"><Star size={16} className="text-saffron-400"/> {avgRating ?? '—'}</div>Rating</div>
            <div><div className="font-bold text-lg flex items-center gap-1"><Coffee size={16} className="text-saffron-400"/> {items.length}+</div>Menu Items</div>
            <div><div className="font-bold text-lg flex items-center gap-1"><Heart size={16} className="text-saffron-400"/> {happyCustomers != null ? `${happyCustomers}+` : '—'}</div>Happy Customers</div>
          </div>
        </motion.div>
      </section>

      {trendingPicks.length > 0 && (
        <section className="bg-sage-700 text-white py-14">
          <div className="max-w-7xl mx-auto px-6">
            <div className="flex items-center gap-2 text-saffron-400 font-semibold text-sm mb-2">
              <Sparkles size={16} /> POWERED BY AI
            </div>
            <h2 className="font-display text-3xl font-bold mb-2 flex items-center gap-2">
              <TrendingUp size={26} /> Trending This Week
            </h2>
            <p className="text-sage-200 mb-4 max-w-xl">
              Our AI predicts what's about to get popular based on real ordering patterns —
              so you can try it before everyone else does.
            </p>
            <button onClick={() => setShowConfidenceInfo(!showConfidenceInfo)} className="text-xs text-sage-300 flex items-center gap-1 mb-4 hover:text-white">
              <HelpCircle size={13} /> What does "confidence" mean?
            </button>
            {showConfidenceInfo && (
              <div className="bg-sage-600/50 rounded-lg p-3 text-sm text-sage-100 mb-4 max-w-xl">
                Confidence reflects how much order history we have to base the prediction on — more orders
                this week means we can trust the trend more. Low confidence just means we don't have much
                data yet, not that the item isn't popular.
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {trendingPicks.map(({ item, predictedOrders, confidence }, i) => (
                <div key={item.id} className="bg-sage-600/50 rounded-xl overflow-hidden">
                  <img src={item.image_url} className="w-full h-28 object-cover" />
                  <div className="p-3">
                    <div className="text-xs text-saffron-300 mb-1">#{i + 1} Trending</div>
                    <div className="font-semibold">{item.name}</div>
                    <div className="text-xs text-sage-300 mt-1">{predictedOrders} predicted orders · {confidence}% confidence</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="max-w-7xl mx-auto px-6 py-14">
        <div className="flex items-center gap-2 text-saffron-600 font-semibold text-sm mb-2">
          <Star size={16} /> CUSTOMER FAVORITES
        </div>
        <div className="flex justify-between items-end mb-6">
          <h2 className="font-display text-3xl font-bold text-sage-700">Popular This Week</h2>
          <Link to="/menu" className="text-saffron-600 font-semibold">View All →</Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {popular.map((item) => <ProductCard key={item.id} item={item} />)}
        </div>
      </section>

      <section className="bg-sage-700 text-white py-16 text-center">
        <h2 className="font-display text-3xl font-bold mb-3">Ready to Eat Healthy?</h2>
        <p className="text-sage-100 mb-6 max-w-lg mx-auto">
          Browse our full menu, add your favorites to the cart, and get them delivered to your door.
        </p>
        <Link to="/menu" className="btn-primary">Order Now</Link>
      </section>
    </div>
  )
}
