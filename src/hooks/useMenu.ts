import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import type { MenuItem } from '../types'

export function useMenu(onlyAvailable = true) {
  const [items, setItems] = useState<MenuItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let query = supabase.from('menu_items').select('*').order('name')
    if (onlyAvailable) query = query.eq('is_available', true)

    query.then(({ data }) => {
      setItems((data as MenuItem[]) ?? [])
      setLoading(false)
    })

    // Live updates: if admin toggles an item off, it disappears for customers instantly
    const channel = supabase
      .channel('menu-items-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'menu_items' }, () => {
        query.then(({ data }) => setItems((data as MenuItem[]) ?? []))
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [onlyAvailable])

  return { items, loading }
}
