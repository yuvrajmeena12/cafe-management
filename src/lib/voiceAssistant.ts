/**
 * AI Voice Assistant — deterministic query parsing over real order data.
 * No black box: every answer is a straightforward database sum, not a
 * guess. Keeping this rule-based (rather than a free-form LLM call)
 * means every number it gives you is exactly traceable to your own data.
 */
import { supabase } from './supabaseClient'

interface TimeWindow {
  label: string
  start: Date
}

function getTimeWindow(query: string): TimeWindow {
  const now = new Date()
  if (query.includes('month')) {
    return { label: 'this month', start: new Date(now.getFullYear(), now.getMonth(), 1) }
  }
  if (query.includes('week')) {
    const start = new Date(now)
    start.setDate(start.getDate() - 7)
    return { label: 'this week', start }
  }
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  return { label: 'today', start }
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2)
    .map((w) => (w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w)) // crude singularize
}

async function fetchPaidOrders(sinceISO: string) {
  return supabase
    .from('orders')
    .select('total, placed_at, items:order_items(quantity, unit_price, menu_item:menu_items(name, cost_price))')
    .eq('payment_status', 'paid')
    .gte('placed_at', sinceISO)
}

export async function answerBusinessQuestion(rawQuery: string): Promise<string> {
  const query = rawQuery.toLowerCase().trim()
  if (!query) return "I didn't catch that — try asking something like \"How many burgers sold today?\""

  let window = getTimeWindow(query)
  let { data: orders, error } = await fetchPaidOrders(window.start.toISOString())
  if (error) return "I couldn't reach your order data just now — please try again."

  // If the requested window (usually "today") has nothing, automatically
  // widen the search instead of dead-ending — most testing/early-stage
  // cafes won't have an order on the exact literal calendar day.
  let widened = false
  if ((!orders || orders.length === 0) && window.label === 'today') {
    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0)
    const wider = await fetchPaidOrders(monthStart.toISOString())
    if (wider.data && wider.data.length > 0) {
      orders = wider.data
      window = { label: 'this month (no orders today specifically)', start: monthStart }
      widened = true
    }
  }

  if (!orders || orders.length === 0) {
    return `No paid orders found yet at all. Once you've completed a real test order (paid or COD, marked delivered), ask me again — I only ever answer from real data, never estimates.`
  }

  const wantsRevenueOnly = query.includes('revenue') && !query.includes('profit')
  const wantsProfitOnly = query.includes('profit') && !/\b(sold|sell)\b/.test(query)

  // Match a specific menu item by comparing word tokens both ways —
  // handles plurals, partial names, and multi-word items more reliably
  // than a plain substring check.
  const { data: menuItems } = await supabase.from('menu_items').select('name')
  const queryTokens = tokenize(query)
  const mentionedItem = (menuItems ?? []).find((m) => {
    const itemTokens = tokenize(m.name)
    return itemTokens.some((it) => queryTokens.includes(it))
  })

  if (mentionedItem) {
    let qty = 0, revenue = 0, profit = 0, hasCostData = false

    orders.forEach((o: any) => {
      o.items?.forEach((it: any) => {
        if (it.menu_item?.name === mentionedItem.name) {
          qty += it.quantity
          revenue += it.quantity * it.unit_price
          if (it.menu_item.cost_price > 0) {
            hasCostData = true
            profit += it.quantity * (it.unit_price - it.menu_item.cost_price)
          }
        }
      })
    })

    if (qty === 0) return `No ${mentionedItem.name} sold ${window.label}.`

    let answer = `${qty} ${mentionedItem.name}${qty !== 1 ? 's' : ''} sold ${window.label}.\nRevenue ₹${revenue.toFixed(0)}.`
    if (hasCostData) answer += `\nProfit ₹${profit.toFixed(0)}.`
    else answer += `\n(Set a cost price on this item in Menu Items to see profit too.)`
    if (widened) answer += `\n(Widened the search since nothing matched today specifically.)`
    return answer
  }

  const totalRevenue = orders.reduce((s, o: any) => s + Number(o.total), 0)
  let totalProfit = 0
  let anyCostData = false
  orders.forEach((o: any) => {
    o.items?.forEach((it: any) => {
      if (it.menu_item?.cost_price > 0) {
        anyCostData = true
        totalProfit += it.quantity * (it.unit_price - it.menu_item.cost_price)
      }
    })
  })

  if (wantsRevenueOnly) return `Revenue ${window.label}: ₹${totalRevenue.toFixed(0)}.`
  if (wantsProfitOnly) {
    return anyCostData
      ? `Profit ${window.label}: ₹${totalProfit.toFixed(0)}.`
      : `Set cost prices on your menu items (in Menu Items) to see profit numbers.`
  }

  let answer = `${orders.length} order${orders.length !== 1 ? 's' : ''} ${window.label}.\nRevenue ₹${totalRevenue.toFixed(0)}.`
  if (anyCostData) answer += `\nProfit ₹${totalProfit.toFixed(0)}.`
  return answer
}
