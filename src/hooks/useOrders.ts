import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabaseClient'
import type { Order, OrderStatus } from '../types'

/** Realtime subscription so the Kitchen Dashboard / customer tracking page
 *  update instantly without a manual refresh. */
export function useOrders(filterStatus?: OrderStatus | 'all') {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const ordersRef = useRef<Order[]>([])

  useEffect(() => {
    ordersRef.current = orders
  }, [orders])

  async function fetchOrders() {
    let query = supabase
      .from('orders')
      .select('*, items:order_items(*, menu_item:menu_items(*))')
      .order('placed_at', { ascending: false })
      .limit(200) // Cap initial load — realtime subscription keeps the dashboard live

    if (filterStatus && filterStatus !== 'all') query = query.eq('status', filterStatus)

    const { data } = await query
    setOrders((data as Order[]) ?? [])
    setLoading(false)
  }

  async function fetchSingleOrder(orderId: string) {
    try {
      const { data } = await supabase
        .from('orders')
        .select('*, items:order_items(*, menu_item:menu_items(*))')
        .eq('id', orderId)
        .single()

      if (!data) return

      const hydrated = data as Order

      setOrders((prev) => {
        // If filterStatus is active and the order does not match, filter it out
        if (filterStatus && filterStatus !== 'all' && hydrated.status !== filterStatus) {
          return prev.filter((o) => o.id !== orderId)
        }

        const exists = prev.some((o) => o.id === orderId)
        let next: Order[]
        if (exists) {
          next = prev.map((o) => (o.id === orderId ? hydrated : o))
        } else {
          next = [hydrated, ...prev]
        }

        next.sort((a, b) => new Date(b.placed_at).getTime() - new Date(a.placed_at).getTime())
        return next.length > 200 ? next.slice(0, 200) : next
      })
    } catch {
      fetchOrders()
    }
  }

  useEffect(() => {
    fetchOrders()

    const channel = supabase
      .channel('orders-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
        const eventType = payload.eventType
        const newRow = payload.new as Partial<Order> | undefined
        const oldRow = payload.old as { id?: string } | undefined

        if (eventType === 'UPDATE' && newRow && newRow.id) {
          const currentOrders = ordersRef.current
          const existing = currentOrders.find((o) => o.id === newRow.id)

          if (!existing) {
            // Scenario C: Order enters the current filter (was not present locally)
            if (!filterStatus || filterStatus === 'all' || newRow.status === filterStatus) {
              fetchSingleOrder(newRow.id)
            }
            return
          }

          // Scenario B: Existing order leaves the current filter
          if (filterStatus && filterStatus !== 'all' && newRow.status && newRow.status !== filterStatus) {
            setOrders((prev) => prev.filter((o) => o.id !== newRow.id))
            return
          }

          // Scenario A: Existing order remains inside the current filter
          // Update in place preserving nested items
          const updated: Order = {
            ...existing,
            ...(newRow as Order),
            items: existing.items, // Crucial: preserve nested items/menu information
          }

          setOrders((prev) => prev.map((o) => (o.id === newRow.id ? updated : o)))
          return
        }

        if (eventType === 'DELETE' && oldRow && oldRow.id) {
          // Scenario E: Remove only the deleted order locally
          setOrders((prev) => prev.filter((o) => o.id !== oldRow.id))
          return
        }

        if (eventType === 'INSERT' && newRow && newRow.id) {
          // Scenario D: Fetch only the new order and hydrate nested items
          if (!filterStatus || filterStatus === 'all' || newRow.status === filterStatus) {
            fetchSingleOrder(newRow.id)
          }
          return
        }

        // Scenario F: Complex or unknown event fallback
        fetchOrders()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterStatus])

  async function updateStatus(orderId: string, status: OrderStatus) {
    await supabase.from('orders').update({ status }).eq('id', orderId)
    // Fire-and-forget — don't block the UI on email sending, and don't
    // fail the status change if the email happens to fail.
    supabase.functions.invoke('send-order-email', { body: { orderId } }).catch(() => {})
  }

  return { orders, loading, updateStatus, refetch: fetchOrders }
}

export function useOrderTracking(orderId: string | undefined) {
  const [order, setOrder] = useState<Order | null>(null)

  useEffect(() => {
    if (!orderId) return

    supabase
      .from('orders')
      .select('*, items:order_items(*, menu_item:menu_items(*))')
      .eq('id', orderId)
      .single()
      .then(({ data }) => setOrder(data as Order))

    const channel = supabase
      .channel(`order-${orderId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${orderId}` },
        (payload) => setOrder((prev) => ({ ...(prev as Order), ...(payload.new as Order) }))
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [orderId])

  return order
}

/** The logged-in customer's own order history — lets them click an order
 *  instead of having to know/find its ID. */
export function useMyOrders(customerId: string | undefined) {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!customerId) { setLoading(false); return }

    function fetchMine() {
      supabase
        .from('orders')
        .select('*, items:order_items(*, menu_item:menu_items(*))')
        .eq('customer_id', customerId)
        .order('placed_at', { ascending: false })
        .then(({ data }) => {
          setOrders((data as Order[]) ?? [])
          setLoading(false)
        })
    }

    fetchMine()
    const channel = supabase
      .channel(`my-orders-${customerId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `customer_id=eq.${customerId}` }, fetchMine)
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [customerId])

  return { orders, loading }
}
