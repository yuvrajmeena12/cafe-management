import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { getCache, setCache, clearCache } from './useCache'
import type { MenuItem } from '../types'

const CACHE_TTL_MS = 3 * 60 * 1000
const MENU_COLUMNS = 'id, name, description, price, image_url, category, calories, tags, is_popular, is_available, prep_time_minutes'
const inFlightRequests = new Map<string, Promise<MenuItem[] | null>>()

// Built-in fallback items in case Supabase is empty or unseeded, so the menu is ALWAYS discoverable!
const FALLBACK_MENU: MenuItem[] = [
  {
    id: 'f1',
    name: 'Heart Latte',
    description: 'Smooth double espresso with silky steamed milk and delicate latte art.',
    price: 395,
    cost_price: 120,
    image_url: 'https://images.pexels.com/photos/302899/pexels-photo-302899.jpeg?auto=compress',
    category: 'Beverages',
    calories: 120,
    tags: ['Coffee', 'Signature'],
    is_popular: true,
    is_available: true,
    prep_time_minutes: 5,
  },
  {
    id: 'f2',
    name: 'Artisan Cappuccino',
    description: 'Hand-crafted cappuccino with intricate latte art on a wooden table.',
    price: 415,
    cost_price: 130,
    image_url: 'https://images.pexels.com/photos/302899/pexels-photo-302899.jpeg?auto=compress',
    category: 'Beverages',
    calories: 130,
    tags: ['Coffee'],
    is_popular: false,
    is_available: true,
    prep_time_minutes: 6,
  },
  {
    id: 'f3',
    name: 'Avocado Toast Deluxe',
    description: 'Smashed avocado on sourdough with poached eggs and a drizzle of olive oil.',
    price: 705,
    cost_price: 250,
    image_url: 'https://images.pexels.com/photos/1351238/pexels-photo-1351238.jpeg?auto=compress',
    category: 'Breakfast',
    calories: 310,
    tags: ['Vegetarian', 'Popular'],
    is_popular: true,
    is_available: true,
    prep_time_minutes: 12,
  },
  {
    id: 'f4',
    name: 'Grilled Chicken Salad Bowl',
    description: 'Fresh organic greens with tender grilled chicken breast and citrus dressing.',
    price: 915,
    cost_price: 340,
    image_url: 'https://images.pexels.com/photos/1213710/pexels-photo-1213710.jpeg?auto=compress',
    category: 'Salads',
    calories: 420,
    tags: ['High Protein', 'Popular'],
    is_popular: true,
    is_available: true,
    prep_time_minutes: 15,
  },
  {
    id: 'f5',
    name: 'Mediterranean Mezze Plate',
    description: 'Boiled farm eggs, grilled halloumi, kalamata olives, and fresh garden greens.',
    price: 870,
    cost_price: 310,
    image_url: 'https://images.pexels.com/photos/1105325/pexels-photo-1105325.jpeg?auto=compress',
    category: 'Salads',
    calories: 380,
    tags: ['Vegetarian'],
    is_popular: false,
    is_available: true,
    prep_time_minutes: 10,
  },
  {
    id: 'f6',
    name: 'Classic Brioche Cheeseburger',
    description: 'Juicy grass-fed patty with aged cheddar, crisp lettuce, and secret cafe relish.',
    price: 1035,
    cost_price: 420,
    image_url: 'https://images.pexels.com/photos/1639557/pexels-photo-1639557.jpeg?auto=compress',
    category: 'Mains',
    calories: 650,
    tags: ['Bestseller'],
    is_popular: true,
    is_available: true,
    prep_time_minutes: 18,
  },
  {
    id: 'f7',
    name: 'Berry Streusel Slice',
    description: 'Crumbly wild berry streuselkuchen served with organic vanilla cream.',
    price: 455,
    cost_price: 150,
    image_url: 'https://images.pexels.com/photos/2144200/pexels-photo-2144200.jpeg?auto=compress',
    category: 'Desserts',
    calories: 290,
    tags: ['Sweet', 'Chef Special'],
    is_popular: true,
    is_available: true,
    prep_time_minutes: 5,
  },
  {
    id: 'f8',
    name: 'Herbal Wellness Infusion',
    description: 'A soothing organic blend of chamomile, saffron, and fresh mountain herbs.',
    price: 290,
    cost_price: 70,
    image_url: 'https://images.pexels.com/photos/1417945/pexels-photo-1417945.jpeg?auto=compress',
    category: 'Beverages',
    calories: 5,
    tags: ['Wellness', 'Organic'],
    is_popular: false,
    is_available: true,
    prep_time_minutes: 4,
  },
]

export function useMenu(onlyAvailable = true) {
  const cacheKey = `menu_items_${onlyAvailable}`
  const cached = getCache<MenuItem[]>(cacheKey, CACHE_TTL_MS)

  const [items, setItems] = useState<MenuItem[]>(() => {
    if (cached && cached.length > 0) return cached
    return FALLBACK_MENU
  })
  const [loading, setLoading] = useState(!cached)

  useEffect(() => {
    let isMounted = true

    async function fetchMenu(force = false) {
      if (!force) {
        const freshCached = getCache<MenuItem[]>(cacheKey, CACHE_TTL_MS)
        if (freshCached && freshCached.length > 0) {
          if (isMounted) {
            setItems(freshCached)
            setLoading(false)
          }
          return
        }
      }

      try {
        let req = inFlightRequests.get(cacheKey)
        if (!req) {
          req = (async () => {
            let query = supabase.from('menu_items').select(MENU_COLUMNS).order('name')
            if (onlyAvailable) {
              query = query.or('is_available.eq.true,is_available.is.null')
            }

            const { data, error } = await query
            if (!error && data && data.length > 0) {
              setCache(cacheKey, data as MenuItem[])
              return data as MenuItem[]
            }
            if (error) {
              console.warn('Could not fetch from Supabase menu_items (using cached/fallback):', error.message)
            }
            return null
          })()

          inFlightRequests.set(cacheKey, req)
        }

        const result = await req
        if (!isMounted) return

        if (result && result.length > 0) {
          setItems(result)
        } else if (!cached || cached.length === 0) {
          setItems(FALLBACK_MENU)
        }
      } catch (err) {
        console.warn('Menu fetch exception:', err)
        if (isMounted && (!cached || cached.length === 0)) {
          setItems(FALLBACK_MENU)
        }
      } finally {
        inFlightRequests.delete(cacheKey)
        if (isMounted) setLoading(false)
      }
    }

    // Only issue network fetch on mount if cache is absent or expired
    if (!cached || cached.length === 0) {
      fetchMenu()
    }

    let channel: any = null
    try {
      channel = supabase
        .channel('menu-items-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'menu_items' }, () => {
          clearCache(cacheKey)
          fetchMenu(true)
        })
        .subscribe()
    } catch {
      // Realtime may not be enabled or connection dropped
    }

    return () => {
      isMounted = false
      if (channel) {
        try {
          supabase.removeChannel(channel)
        } catch {}
      }
    }
  }, [onlyAvailable, cacheKey])

  return { items, loading }
}
