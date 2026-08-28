import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { getCache, setCache } from './useCache'
import type { MenuItem } from '../types'

export function useMenu(onlyAvailable = true) {
  const cacheKey = `menu_items_${onlyAvailable}`
  const cached = getCache<MenuItem[]>(cacheKey, 3 * 60 * 1000)

  const [items, setItems] = useState<MenuItem[]>(cached ?? [])
  const [loading, setLoading] = useState(!cached)

  useEffect(() => {
    async function fetchMenu() {
      let query = supabase.from('menu_items').select('*').order('name')
      if (onlyAvailable) query = query.eq('is_available', true)

      const { data } = await query
      if (data) {
        setItems(data as MenuItem[])
        setCache(cacheKey, data as MenuItem[])
      }
      setLoading(false)
    }

    fetchMenu()

    // Live updates: if admin toggles an item or adds new, refresh cache
    const channel = supabase
      .channel('menu-items-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'menu_items' }, () => {
        fetchMenu()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [onlyAvailable, cacheKey])

  return { items, loading }
}
