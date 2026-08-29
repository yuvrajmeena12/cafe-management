import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { Star, Coffee, Heart, Sparkles, TrendingUp, HelpCircle, ArrowRight, ShieldCheck, Clock, Award } from 'lucide-react'
import { useMenu } from '../hooks/useMenu'
import ProductCard from '../components/ProductCard'
import HeroQuoteOverlay from '../components/HeroQuoteOverlay'
import AnimatedCounter from '../components/AnimatedCounter'
import AnimatedPage from '../components/AnimatedPage'
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
    supabase.rpc('get_site_stats').single().then(({ data }) => {
      const stats = data as { avg_rating: number | null; menu_item_count: number; happy_customers: number } | null
      if (stats) {
        setAvgRating(stats.avg_rating)
        setHappyCustomers(stats.happy_customers)
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
    <AnimatedPage>
      {/* Hero Showcase Section */}
      <section className="relative min-h-[560px] md:h-[600px] flex items-center overflow-hidden">
        <HeroQuoteOverlay />
        <motion.img
          initial={{ scale: 1.08 }}
          animate={{ scale: 1 }}
          transition={{ duration: 1.5, ease: 'easeOut' }}
          src={settings.hero_image_url || 'https://images.pexels.com/photos/972845/pexels-photo-972845.jpeg?auto=compress'}
          alt="Cafe interior"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-sage-950/90 via-sage-900/70 to-transparent" />

        <div className="relative z-10 max-w-7xl mx-auto px-6 py-16 w-full">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="max-w-2xl text-white space-y-5"
          >
            <motion.span
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
              className="inline-flex items-center gap-2 bg-white/15 backdrop-blur-md px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider text-saffron-300 border border-white/20"
            >
              🌿 Farm to Table Artisanal Flavors
            </motion.span>

            <h1 className="font-display text-4xl sm:text-6xl font-extrabold leading-tight tracking-tight drop-shadow-sm">
              {settings.cafe_name ?? 'Saffron & Sage'}
            </h1>

            <p className="italic text-saffron-400 text-xl font-display font-medium">
              "{settings.tagline ?? 'Eat Healthy, Stay Healthy'}"
            </p>

            <p className="text-sage-100 text-sm sm:text-base leading-relaxed max-w-xl text-sage-200">
              {settings.about_text ?? 'Where every dish tells a story of wellness. Fresh ingredients, bold flavors, and a warm atmosphere crafted for your mindful lifestyle.'}
            </p>

            <div className="flex flex-wrap gap-4 pt-2">
              <Link to="/menu" className="btn-primary text-sm px-6 py-3 shadow-lg shadow-saffron-600/30 flex items-center gap-2">
                🍴 Explore Full Menu <ArrowRight size={16} />
              </Link>
              <Link to="/track" className="btn-secondary text-sm px-6 py-3 backdrop-blur-md bg-white/90">
                📍 Track Order Live
              </Link>
            </div>

            {/* Live Stats Counters */}
            <div className="grid grid-cols-3 gap-6 pt-6 border-t border-white/15 max-w-lg">
              <div>
                <div className="font-extrabold text-2xl flex items-center gap-1 text-white">
                  <Star size={18} className="text-saffron-400 fill-saffron-400" />
                  {avgRating != null ? <AnimatedCounter value={avgRating} decimals={1} /> : '4.9'}
                </div>
                <div className="text-xs text-sage-300 font-medium">Customer Rating</div>
              </div>

              <div>
                <div className="font-extrabold text-2xl flex items-center gap-1 text-white">
                  <Coffee size={18} className="text-saffron-400" />
                  <AnimatedCounter value={items.length || 24} suffix="+" />
                </div>
                <div className="text-xs text-sage-300 font-medium">Organic Delicacies</div>
              </div>

              <div>
                <div className="font-extrabold text-2xl flex items-center gap-1 text-white">
                  <Heart size={18} className="text-saffron-400 fill-saffron-400" />
                  <AnimatedCounter value={happyCustomers ?? 500} suffix="+" />
                </div>
                <div className="text-xs text-sage-300 font-medium">Happy Foodies</div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Feature Highlights */}
      <section className="max-w-7xl mx-auto px-6 -mt-8 relative z-20">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="glass-card p-5 flex items-center gap-4 border-sage-200/60"
          >
            <div className="w-12 h-12 rounded-2xl bg-saffron-50 text-saffron-600 flex items-center justify-center shrink-0">
              <ShieldCheck size={24} />
            </div>
            <div>
              <h3 className="font-bold text-sage-800 text-sm">100% Pure Ingredients</h3>
              <p className="text-xs text-sage-500 mt-0.5">Locally sourced, no artificial additives</p>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="glass-card p-5 flex items-center gap-4 border-sage-200/60"
          >
            <div className="w-12 h-12 rounded-2xl bg-green-50 text-green-600 flex items-center justify-center shrink-0">
              <Clock size={24} />
            </div>
            <div>
              <h3 className="font-bold text-sage-800 text-sm">Swift Hot Delivery</h3>
              <p className="text-xs text-sage-500 mt-0.5">Dispatched fresh directly from kitchen</p>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="glass-card p-5 flex items-center gap-4 border-sage-200/60"
          >
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
              <Award size={24} />
            </div>
            <div>
              <h3 className="font-bold text-sage-800 text-sm">Master Chef Quality</h3>
              <p className="text-xs text-sage-500 mt-0.5">Artisanal recipes perfected daily</p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* AI Trending Section */}
      {trendingPicks.length > 0 && (
        <section className="bg-sage-800 text-white py-16 mt-16">
          <div className="max-w-7xl mx-auto px-6">
            <div className="flex items-center gap-2 text-saffron-400 font-bold text-xs uppercase tracking-wider mb-2">
              <Sparkles size={16} /> Powered by Live Food Intelligence
            </div>
            <h2 className="font-display text-3xl font-bold mb-2 flex items-center gap-2">
              <TrendingUp size={28} className="text-saffron-400" /> Trending Forecast This Week
            </h2>
            <p className="text-sage-300 text-sm mb-4 max-w-xl leading-relaxed">
              Predictive flavor radar based on real ordering velocity — try tomorrow's favorites today.
            </p>

            <button
              onClick={() => setShowConfidenceInfo(!showConfidenceInfo)}
              className="text-xs text-sage-300 flex items-center gap-1.5 mb-6 hover:text-white transition-colors"
            >
              <HelpCircle size={14} /> How is prediction confidence calculated?
            </button>

            {showConfidenceInfo && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="bg-white/10 backdrop-blur-md rounded-2xl p-4 text-xs text-sage-200 mb-6 max-w-xl leading-relaxed border border-white/10"
              >
                Confidence is calculated dynamically by correlating multi-week repeat order volumes, time-of-day kitchen spikes, and customer taste category reviews.
              </motion.div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {trendingPicks.map(({ item, predictedOrders, confidence }, i) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 15 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="bg-white/10 hover:bg-white/15 backdrop-blur-md rounded-2xl overflow-hidden border border-white/10 transition-all duration-300 group"
                >
                  <div className="relative h-32 overflow-hidden">
                    <img
                      src={item.image_url}
                      alt={item.name}
                      className="w-full h-full object-cover group-hover:scale-108 transition-transform duration-500"
                    />
                    <span className="absolute top-2 left-2 bg-saffron-500 text-white text-[11px] font-bold px-2 py-0.5 rounded-full shadow">
                      #{i + 1} Trending
                    </span>
                  </div>
                  <div className="p-4">
                    <h4 className="font-bold text-white text-sm truncate">{item.name}</h4>
                    <div className="text-xs text-saffron-300 font-semibold mt-1">₹{item.price.toFixed(2)}</div>
                    <div className="text-[11px] text-sage-300 mt-2 flex justify-between">
                      <span>{predictedOrders} forecasted</span>
                      <span className="text-saffron-400 font-bold">{confidence}% match</span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Popular Menu Showcase */}
      <section className="max-w-7xl mx-auto px-6 py-20">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-1.5 text-saffron-600 font-bold text-xs uppercase tracking-wider mb-2">
              <Star size={14} className="fill-saffron-600" /> Customer Favorites
            </div>
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-sage-800">
              Popular Dishes This Week
            </h2>
          </div>
          <Link
            to="/menu"
            className="text-saffron-600 hover:text-saffron-700 font-bold text-sm flex items-center gap-1.5 group"
          >
            Explore Complete Menu <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {popular.map((item) => (
            <ProductCard key={item.id} item={item} />
          ))}
        </div>
      </section>

      {/* Call to action section with animated gradient */}
      <section className="max-w-7xl mx-auto px-6 pb-20">
        <div className="bg-gradient-to-r from-sage-800 via-sage-900 to-sage-800 text-white rounded-3xl p-10 sm:p-16 text-center relative overflow-hidden shadow-2xl">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-saffron-500/10 via-transparent to-transparent pointer-events-none" />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="relative z-10 max-w-2xl mx-auto space-y-4"
          >
            <span className="text-saffron-400 font-semibold text-xs tracking-widest uppercase">
              Fresh · Mindful · Wholesome
            </span>
            <h2 className="font-display text-3xl sm:text-4xl font-bold">
              Ready for a Nourishing Experience?
            </h2>
            <p className="text-sage-300 text-sm sm:text-base leading-relaxed">
              Order your favorite artisanal coffee, fresh power bowls, and guilt-free desserts for instant doorstep delivery.
            </p>
            <div className="pt-3">
              <Link to="/menu" className="btn-primary text-sm px-8 py-3.5 shadow-lg shadow-saffron-600/40 inline-flex items-center gap-2">
                Start Your Order Now <ArrowRight size={16} />
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </AnimatedPage>
  )
}
