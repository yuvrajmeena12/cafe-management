import { useEffect, useState } from 'react'
import { DollarSign, TrendingDown, ShoppingBag, TrendingUp, Sparkles, Clock, AlertTriangle } from 'lucide-react'
import { motion } from 'framer-motion'
import { supabase } from '../../lib/supabaseClient'
import { predictNextWeek, fetchItemOrderCounts } from '../../lib/ai'
import VoiceAssistant from '../../components/VoiceAssistant'
import WeatherForecastCard from '../../components/WeatherForecastCard'
import AnimatedCounter from '../../components/AnimatedCounter'
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
  const [stats, setStats] = useState<Stats>({
    revenue: 0,
    expenses: 0,
    totalOrders: 0,
    pendingOrders: 0,
    lowStock: 0,
    todaysOrders: 0,
  })
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
    { label: 'Gross Revenue', value: stats.revenue, prefix: '₹', icon: DollarSign, isMoney: true },
    { label: 'Total Expenses', value: stats.expenses, prefix: '₹', icon: TrendingDown, isMoney: true },
    { label: 'Net Profit', value: netProfit, prefix: '₹', icon: TrendingUp, isMoney: true },
    { label: 'Total Orders', value: stats.totalOrders, prefix: '', icon: ShoppingBag, isMoney: false },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold text-sage-800">Operational Intelligence Dashboard</h1>
        <p className="text-sage-500 text-sm">Real-time financials, inventory status, and AI sales forecasts</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {cards.map((c, idx) => (
          <motion.div
            key={c.label}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
            className="card p-5 space-y-2 border-sage-100"
          >
            <div className="flex justify-between items-center">
              <span className="text-xs font-semibold uppercase text-sage-500">{c.label}</span>
              <div className="w-8 h-8 rounded-xl bg-sage-50 flex items-center justify-center text-sage-700">
                <c.icon size={16} />
              </div>
            </div>
            <div className="font-display text-2xl sm:text-3xl font-bold text-sage-800">
              <AnimatedCounter value={c.value} prefix={c.prefix} decimals={c.isMoney ? 2 : 0} />
            </div>
          </motion.div>
        ))}
      </div>

      {/* Live Operational Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="card p-5 flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-sage-500 uppercase">Pending Kitchen Orders</div>
            <div className="text-2xl font-bold text-sage-800 mt-1">
              <AnimatedCounter value={stats.pendingOrders} />
            </div>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <Clock size={20} />
          </div>
        </div>

        <div className="card p-5 flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-sage-500 uppercase">Low Stock Alerts</div>
            <div className="text-2xl font-bold text-red-600 mt-1">
              <AnimatedCounter value={stats.lowStock} />
            </div>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center">
            <AlertTriangle size={20} />
          </div>
        </div>

        <div className="card p-5 flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-sage-500 uppercase">Today's Total Orders</div>
            <div className="text-2xl font-bold text-sage-800 mt-1">
              <AnimatedCounter value={stats.todaysOrders} />
            </div>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-green-50 text-green-600 flex items-center justify-center">
            <ShoppingBag size={20} />
          </div>
        </div>
      </div>

      {/* AI Popular Food Prediction */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-sage-800 text-white rounded-3xl p-6 sm:p-8 shadow-xl"
      >
        <div className="flex items-center gap-2 text-saffron-300 font-bold text-xs uppercase tracking-wider mb-1">
          <Sparkles size={16} /> Artificial Intelligence Forecasting
        </div>
        <h2 className="font-display font-bold text-xl sm:text-2xl mb-2">Demand Forecast for Coming Week</h2>
        <p className="text-sage-300 text-xs sm:text-sm mb-6 max-w-xl leading-relaxed">
          Kitchen prep estimations computed from multi-week ordering spikes to reduce food wastage.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {predictions.map((p, i) => (
            <div key={p.item.id} className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10 space-y-1.5">
              <div className="text-[11px] font-bold text-saffron-300">#{i + 1} Predicted Demand</div>
              <div className="font-bold text-sm text-white truncate">{p.item.name}</div>
              <div className="text-xs text-sage-200">{p.predictedOrders} estimated orders</div>
              <div className="text-[11px] text-saffron-400 font-semibold">{p.confidence}% algorithm confidence</div>
            </div>
          ))}
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <VoiceAssistant />
        <WeatherForecastCard />
      </div>
    </div>
  )
}
