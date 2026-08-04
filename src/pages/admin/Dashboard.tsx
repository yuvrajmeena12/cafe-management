import { useEffect, useState } from 'react'
import { DollarSign, TrendingDown, ShoppingBag } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { predictNextWeek, fetchItemOrderCounts } from '../../lib/ai'
import VoiceAssistant from '../../components/VoiceAssistant'
import WeatherForecastCard from '../../components/WeatherForecastCard'
import type { MenuItem } from '../../types'

interface Stats {
  revenue: number
  expenses: number
  totalOrders: number
  pendingOrders: number
  lowStock: number
  todaysOrders: number
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats>({ revenue: 0, expenses: 0, totalOrders: 0, pendingOrders: 0, lowStock: 0, todaysOrders: 0 })
  const [predictions, setPredictions] = useState<{ item: MenuItem; predictedOrders: number; confidence: number }[]>([])

  useEffect(() => {
    async function load() {
      const [{ data: paidOrders }, { data: expenses }, { data: allOrders }, { data: inventory }] = await Promise.all([
        supabase.from('orders').select('total').eq('payment_status', 'paid'),
        supabase.from('expenses').select('amount'),
        supabase.from('orders').select('id, status, placed_at'),
        supabase.from('inventory_items').select('id, quantity, min_level'),
      ])

      const revenue = (paidOrders ?? []).reduce((s, o) => s + Number(o.total), 0)
      const expenseTotal = (expenses ?? []).reduce((s, e) => s + Number(e.amount), 0)
      const today = new Date().toDateString()
      const todaysOrders = (allOrders ?? []).filter((o) => new Date(o.placed_at).toDateString() === today).length
      const pendingOrders = (allOrders ?? []).filter((o) => !['delivered', 'cancelled'].includes(o.status)).length
      const lowStock = (inventory ?? []).filter((i) => Number(i.quantity) < Number(i.min_level)).length

      setStats({
        revenue,
        expenses: expenseTotal,
        totalOrders: (allOrders ?? []).length,
        pendingOrders,
        lowStock,
        todaysOrders,
      })

      // Popular Food Prediction — real numbers once order history exists
      const { data: menuItems } = await supabase.from('menu_items').select('*')
      const counts = await fetchItemOrderCounts()
      const ranked = (menuItems ?? [])
        .map((item) => {
          const c = counts[item.id] ?? { thisWeek: 0, lastWeek: 0 }
          return { item, ...predictNextWeek(c.thisWeek, c.lastWeek) }
        })
        .sort((a, b) => b.predictedOrders - a.predictedOrders)
        .slice(0, 4)
      setPredictions(ranked)
    }
    load()
  }, [])

  const netProfit = stats.revenue - stats.expenses

  const cards = [
    { label: 'Total Revenue', value: `₹${stats.revenue.toFixed(2)}`, icon: DollarSign, up: true },
    { label: 'Total Expenses', value: `₹${stats.expenses.toFixed(2)}`, icon: TrendingDown, up: false },
    { label: 'Net Profit', value: `₹${netProfit.toFixed(2)}`, icon: DollarSign, up: netProfit >= 0 },
    { label: 'Total Orders', value: stats.totalOrders, icon: ShoppingBag, up: true },
  ]

  return (
    <div>
      <h1 className="font-display text-3xl font-bold text-sage-700 mb-1">Dashboard</h1>
      <p className="text-sage-500 mb-6">Business overview and insights</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-6">
        {cards.map((c) => (
          <div key={c.label} className="card p-5">
            <div className="flex justify-between items-start mb-3">
              <div className={`p-2 rounded-lg ${c.up ? 'bg-sage-50 text-sage-600' : 'bg-red-50 text-red-500'}`}><c.icon size={18} /></div>
            </div>
            <div className="text-sage-500 text-sm">{c.label}</div>
            <div className="font-display text-2xl font-bold text-sage-700">{c.value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-6">
        <div className="card p-5"><div className="text-sage-500 text-sm">Pending Orders</div><div className="text-2xl font-bold text-sage-700">{stats.pendingOrders}</div></div>
        <div className="card p-5"><div className="text-sage-500 text-sm">Low Stock Items</div><div className="text-2xl font-bold text-sage-700">{stats.lowStock}</div></div>
        <div className="card p-5"><div className="text-sage-500 text-sm">Today's Orders</div><div className="text-2xl font-bold text-sage-700">{stats.todaysOrders}</div></div>
      </div>

      <div className="bg-sage-700 text-white rounded-xl p-6">
        <h2 className="font-bold text-lg mb-1">📈 AI Popular Food Prediction</h2>
        <p className="text-sage-200 text-sm mb-4">Forecasted trending items for next week, based on real order history (updates as orders come in).</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {predictions.map((p, i) => (
            <div key={p.item.id} className="bg-sage-600/60 rounded-lg p-4">
              <div className="text-xs text-sage-300 mb-1">#{i + 1}</div>
              <div className="font-semibold">{p.item.name}</div>
              <div className="text-sm text-sage-200">{p.predictedOrders} predicted orders</div>
              <div className="text-xs text-saffron-300">{p.confidence}% confidence</div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <VoiceAssistant />
        <WeatherForecastCard />
      </div>
    </div>
  )
}
