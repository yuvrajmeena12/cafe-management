import { useEffect, useMemo, useState } from 'react'
import { Search, ArrowUpDown } from 'lucide-react'
import { useMenu } from '../hooks/useMenu'
import ProductCard from '../components/ProductCard'
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
      const matchesSearch = i.name.toLowerCase().includes(search.toLowerCase())
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
    <div className="max-w-7xl mx-auto px-6 py-10">
      <h1 className="font-display text-4xl font-bold text-sage-700 mb-2">Our Menu</h1>
      <p className="text-sage-500 mb-6">Fresh, wholesome dishes made daily.</p>

      <div className="flex flex-col md:flex-row gap-4 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-sage-400" size={18} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search items..."
            className="w-full pl-10 pr-4 py-3 rounded-lg border border-sage-100 focus:outline-none focus:ring-2 focus:ring-saffron-400"
          />
        </div>
        <div className="relative">
          <ArrowUpDown className="absolute left-3 top-1/2 -translate-y-1/2 text-sage-400 pointer-events-none" size={16} />
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortOption)}
            className="pl-9 pr-4 py-3 rounded-lg border border-sage-100 bg-white text-sage-700 appearance-none"
          >
            {Object.entries(SORT_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto mb-8">
        {categories.map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={`px-4 py-2 rounded-full text-sm whitespace-nowrap font-medium transition-colors ${
              category === c ? 'bg-saffron-500 text-white' : 'bg-white border border-sage-100 text-sage-600'
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => <div key={i} className="card h-72 animate-pulse bg-sage-50" />)}
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-center text-sage-400 py-16">No items match your search.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((item) => (
            <ProductCard key={item.id} item={item} avgRating={ratings[item.id]?.avg ?? null} ratingCount={ratings[item.id]?.count} />
          ))}
        </div>
      )}
    </div>
  )
}
