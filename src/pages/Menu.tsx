import { useEffect, useMemo, useState } from 'react'
import { Search, ArrowUpDown, X, Sparkles } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useMenu } from '../hooks/useMenu'
import ProductCard from '../components/ProductCard'
import AnimatedPage from '../components/AnimatedPage'
import { SkeletonCard } from '../components/SkeletonLoader'
import { supabase } from '../lib/supabaseClient'

type SortOption = 'default' | 'price_low' | 'price_high' | 'most_rated' | 'low_calories'

const SORT_LABELS: Record<SortOption, string> = {
  default: 'Recommended',
  price_low: 'Price: Low to High',
  price_high: 'Price: High to Low',
  most_rated: 'Most Rated',
  low_calories: 'Lowest Calories',
}

export default function Menu() {
  const { items, loading } = useMenu()
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')
  const [sort, setSort] = useState<SortOption>('default')
  const [ratings, setRatings] = useState<Record<string, { avg: number; count: number }>>({})

  useEffect(() => {
    supabase.from('reviews').select('menu_item_id, rating').not('menu_item_id', 'is', null).then(({ data }) => {
      const grouped: Record<string, number[]> = {}
      ;(data ?? []).forEach((r) => {
        if (!r.menu_item_id) return
        if (!grouped[r.menu_item_id]) grouped[r.menu_item_id] = []
        grouped[r.menu_item_id].push(r.rating)
      })
      const result: Record<string, { avg: number; count: number }> = {}
      Object.entries(grouped).forEach(([id, list]) => {
        result[id] = { avg: list.reduce((s, n) => s + n, 0) / list.length, count: list.length }
      })
      setRatings(result)
    })
  }, [])

  const categories = useMemo(() => ['All', ...new Set(items.map((i) => i.category))], [items])

  const filtered = useMemo(() => {
    let list = items.filter((i) => {
      const matchesSearch =
        i.name.toLowerCase().includes(search.toLowerCase()) ||
        i.description.toLowerCase().includes(search.toLowerCase()) ||
        i.tags?.some((t) => t.toLowerCase().includes(search.toLowerCase()))
      const matchesCategory = category === 'All' || i.category === category
      return matchesSearch && matchesCategory
    })

    if (sort === 'price_low') list = [...list].sort((a, b) => a.price - b.price)
    else if (sort === 'price_high') list = [...list].sort((a, b) => b.price - a.price)
    else if (sort === 'most_rated') list = [...list].sort((a, b) => (ratings[b.id]?.avg ?? 0) - (ratings[a.id]?.avg ?? 0))
    else if (sort === 'low_calories') list = [...list].sort((a, b) => (a.calories ?? 9999) - (b.calories ?? 9999))

    return list
  }, [items, search, category, sort, ratings])

  return (
    <AnimatedPage className="max-w-7xl mx-auto px-6 py-12">
      {/* Header Banner */}
      <div className="text-center max-w-2xl mx-auto mb-10 space-y-3">
        <motion.span
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="inline-flex items-center gap-1.5 bg-saffron-50 text-saffron-700 text-xs font-bold px-3.5 py-1 rounded-full uppercase tracking-wider border border-saffron-200/60"
        >
          <Sparkles size={13} /> Artisanal & Fresh Daily
        </motion.span>
        <h1 className="font-display text-4xl sm:text-5xl font-extrabold text-sage-800">
          Our Culinary Collection
        </h1>
        <p className="text-sage-500 text-sm sm:text-base leading-relaxed">
          Crafted with organic produce, wholesome superfoods, and authentic love.
        </p>
      </div>

      {/* Search & Sort Controls */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sage-400" size={18} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search healthy bowls, coffee, desserts, superfoods..."
            className="w-full pl-10 pr-10 py-3 rounded-2xl border border-sage-200/80 bg-white shadow-sm focus:ring-2 focus:ring-saffron-400 focus:outline-none text-sm transition-all"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-sage-400 hover:text-sage-700"
            >
              <X size={16} />
            </button>
          )}
        </div>

        <div className="relative shrink-0">
          <ArrowUpDown className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sage-400 pointer-events-none" size={16} />
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortOption)}
            className="pl-9 pr-8 py-3 rounded-2xl border border-sage-200/80 bg-white text-sage-700 font-medium text-sm shadow-sm focus:ring-2 focus:ring-saffron-400 focus:outline-none appearance-none cursor-pointer"
          >
            {Object.entries(SORT_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Category Pills with animated sliding active badge */}
      <div className="flex gap-2 overflow-x-auto pb-3 mb-8 no-scrollbar">
        {categories.map((c) => {
          const isSelected = category === c
          return (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`relative px-5 py-2.5 rounded-full text-xs font-bold tracking-wide whitespace-nowrap transition-all duration-200 ${
                isSelected
                  ? 'text-white shadow-md'
                  : 'bg-white border border-sage-200/70 text-sage-600 hover:bg-sage-50'
              }`}
            >
              {isSelected && (
                <motion.div
                  layoutId="activeMenuCategory"
                  className="absolute inset-0 bg-gradient-to-r from-saffron-500 to-saffron-600 rounded-full -z-10"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
              {c}
            </button>
          )
        })}
      </div>

      {/* Menu Cards Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <SkeletonCard count={6} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-16 text-center text-sage-400 space-y-3">
          <div className="text-4xl">🥗</div>
          <h3 className="font-bold text-sage-700 text-lg">No dishes found</h3>
          <p className="text-sm">Try searching for something else or clear the active category filter.</p>
          <button
            onClick={() => { setSearch(''); setCategory('All') }}
            className="btn-secondary text-xs mt-2"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <motion.div
          layout
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          <AnimatePresence>
            {filtered.map((item) => (
              <ProductCard
                key={item.id}
                item={item}
                avgRating={ratings[item.id]?.avg ?? null}
                ratingCount={ratings[item.id]?.count}
              />
            ))}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatedPage>
  )
}
