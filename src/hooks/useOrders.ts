import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import type { Order, OrderStatus } from '../types'

/** Realtime subscription so the Kitchen Dashboard / customer tracking page
 *  update instantly without a manual refresh. */
export function useOrders(filterStatus?: OrderStatus | 'all') {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)

  async function fetchOrders() {
    let query = supabase
      .from('orders')
      .select('*, items:order_items(*, menu_item:menu_items(*))')
      .order('placed_at', { ascending: false })

    if (filterStatus && filterStatus !== 'all') query = query.eq('status', filterStatus)

    const { data } = await query
    setOrders((data as Order[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    fetchOrders()

    const channel = supabase
      .channel('orders-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, fetchOrders)
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
