/**
 * Deterministic, explainable scoring for "AI Recommendation" and
 * "Popular Food Prediction" — see Section 8 of the build guide.
 * Swap this out for a call to an edge function backed by OpenAI later
 * if you want natural-language upsell copy on top of these numbers.
 */
import type { MenuItem, CartLine } from '../types'
import { supabase } from './supabaseClient'

export interface OrderCountsByItem {
  [menuItemId: string]: { thisWeek: number; lastWeek: number; customerOrders: number }
}

export function scoreRecommendation(
  item: MenuItem,
  counts: OrderCountsByItem,
  cart: CartLine[]
): number {
  const c = counts[item.id] ?? { thisWeek: 0, lastWeek: 0, customerOrders: 0 }
  const globalPopularity = Math.min(1, c.thisWeek / 20) // normalize, cap at 1
  const cartCategoryMatch = cart.some((line) => line.menu_item.category === item.category) ? 1 : 0
  const customerHistory = Math.min(1, c.customerOrders / 5)
  const popularFlag = item.is_popular ? 1 : 0

  return (
    0.4 * customerHistory +
    0.3 * globalPopularity +
    0.2 * cartCategoryMatch +
    0.1 * popularFlag
  )
}

export function predictNextWeek(thisWeek: number, lastWeek: number) {
  const growthRate = lastWeek === 0 ? 0 : (thisWeek - lastWeek) / lastWeek
  const predictedOrders = Math.max(0, Math.round(thisWeek * (1 + growthRate)))
  const confidence = Math.min(95, Math.round(thisWeek * 5))
  return { predictedOrders, confidence, growthRate }
}

/**
 * Fetches real order quantities per menu item for the last 7 days and the
 * 7 days before that, so predictNextWeek() has actual data to work with
 * instead of always showing 0.
 */
export async function fetchItemOrderCounts(): Promise<Record<string, { thisWeek: number; lastWeek: number }>> {
  const now = new Date()
  const oneWeekAgo = new Date(now); oneWeekAgo.setDate(now.getDate() - 7)
  const twoWeeksAgo = new Date(now); twoWeeksAgo.setDate(now.getDate() - 14)

  const { data: orders } = await supabase
    .from('orders')
    .select('placed_at, items:order_items(quantity, menu_item_id)')
    .eq('payment_status', 'paid')
    .gte('placed_at', twoWeeksAgo.toISOString())

  const counts: Record<string, { thisWeek: number; lastWeek: number }> = {}

  ;(orders ?? []).forEach((o: any) => {
    const placed = new Date(o.placed_at)
    const isThisWeek = placed >= oneWeekAgo
    o.items?.forEach((it: any) => {
      if (!it.menu_item_id) return
      if (!counts[it.menu_item_id]) counts[it.menu_item_id] = { thisWeek: 0, lastWeek: 0 }
      if (isThisWeek) counts[it.menu_item_id].thisWeek += it.quantity
      else counts[it.menu_item_id].lastWeek += it.quantity
    })
  })

  return counts
}
