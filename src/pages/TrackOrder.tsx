import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CheckCircle2, Circle, Package, ChefHat, Bike, Receipt, ArrowLeft, Search, Clock, Sparkles } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useOrderTracking, useMyOrders } from '../hooks/useOrders'
import { useAuth } from '../context/AuthContext'
import AnimatedPage from '../components/AnimatedPage'
import type { OrderStatus } from '../types'

const STEPS: { key: OrderStatus; label: string; icon: any }[] = [
  { key: 'received', label: 'Received', icon: Package },
  { key: 'preparing', label: 'Preparing', icon: ChefHat },
  { key: 'ready', label: 'Ready', icon: CheckCircle2 },
  { key: 'out_for_delivery', label: 'Out for Delivery', icon: Bike },
  { key: 'delivered', label: 'Delivered', icon: CheckCircle2 },
]

const STATUS_COLORS: Record<string, string> = {
  received: 'bg-blue-100 text-blue-800',
  preparing: 'bg-amber-100 text-amber-800',
  ready: 'bg-purple-100 text-purple-800',
  out_for_delivery: 'bg-saffron-100 text-saffron-800',
  delivered: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
}

export default function TrackOrder() {
  const { profile } = useAuth()
  const [params] = useSearchParams()
  const { orders: myOrders, loading: myOrdersLoading } = useMyOrders(profile?.id)

  const [activeId, setActiveId] = useState<string | undefined>(params.get('order') ?? undefined)
  const [guestIdInput, setGuestIdInput] = useState('')
  const [showGuestSearch, setShowGuestSearch] = useState(!profile)

  const order = useOrderTracking(activeId)
  const currentIndex = order ? STEPS.findIndex((s) => s.key === order.status) : -1

  if (activeId && order) {
    return (
      <AnimatedPage className="max-w-2xl mx-auto px-6 py-12">
        <button
          onClick={() => setActiveId(undefined)}
          className="flex items-center gap-2 text-xs font-bold text-sage-600 hover:text-sage-900 mb-6 group transition-colors"
        >
          <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" /> Back to My Orders List
        </button>

        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="card p-6 sm:p-8 space-y-6 shadow-xl border-sage-200/80"
        >
          <div className="flex justify-between items-start">
            <div>
              <div className="text-xs font-mono uppercase tracking-wider text-sage-400">
                Order Reference #{order.id.slice(0, 8).toUpperCase()}
              </div>
              <div className={`inline-flex items-center gap-1.5 mt-2 px-3.5 py-1 rounded-full text-xs font-bold capitalize ${STATUS_COLORS[order.status] ?? 'bg-sage-100 text-sage-700'}`}>
                <span className="w-2 h-2 rounded-full bg-current animate-ping" />
                {order.status.replace(/_/g, ' ')}
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-sage-400">Total Amount</div>
              <div className="font-extrabold text-2xl text-saffron-600">₹{order.total.toFixed(2)}</div>
              <span className={`inline-block mt-1 text-[11px] px-2.5 py-0.5 rounded-full font-bold uppercase ${
                order.payment_status === 'paid'
                  ? 'bg-green-100 text-green-800'
                  : 'bg-amber-100 text-amber-800'
              }`}>
                {order.payment_status === 'paid' ? '✓ Paid' : 'Payment on Delivery'}
              </span>
            </div>
          </div>

          {/* Stepper Progress Bar */}
          <div className="relative pt-4 pb-2">
            <div className="flex justify-between relative z-10">
              {STEPS.map((step, i) => {
                const done = i <= currentIndex
                const isCurrent = i === currentIndex
                const Icon = step.icon
                return (
                  <div key={step.key} className="flex flex-col items-center flex-1 text-center">
                    <motion.div
                      animate={isCurrent ? { scale: [1, 1.1, 1] } : {}}
                      transition={{ repeat: Infinity, duration: 2 }}
                      className={`w-11 h-11 rounded-2xl flex items-center justify-center mb-2 transition-all shadow-sm ${
                        done
                          ? 'bg-saffron-500 text-white shadow-saffron-500/30'
                          : 'bg-sage-50 text-sage-300 border border-sage-100'
                      }`}
                    >
                      <Icon size={18} />
                    </motion.div>
                    <span className={`text-[11px] ${done ? 'text-sage-800 font-bold' : 'text-sage-400'}`}>
                      {step.label}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Order Details Accordion */}
          {order.items && order.items.length > 0 && (
            <div className="bg-sage-50/70 p-4 rounded-2xl space-y-2 text-xs">
              <div className="font-bold text-sage-800 text-sm mb-1">Dishes in Preparation:</div>
              {order.items.map((it) => (
                <div key={it.id} className="flex justify-between text-sage-700">
                  <span>{it.quantity}× {it.menu_item?.name ?? 'Item'}</span>
                  <span className="font-semibold">₹{(it.unit_price * it.quantity).toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}

          {order.delivery_address && (
            <div className="text-xs text-sage-600 bg-white border border-sage-100 p-3.5 rounded-xl">
              <strong>Delivery Destination:</strong> {order.delivery_address}
            </div>
          )}

          <div className="pt-2 border-t border-sage-100 flex justify-between items-center">
            <Link
              to={`/invoice/${order.id}`}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-saffron-600 hover:text-saffron-700 hover:underline"
            >
              <Receipt size={15} /> View Full PDF Invoice
            </Link>
            <span className="text-[11px] text-sage-400">Status updates in real-time</span>
          </div>
        </motion.div>
      </AnimatedPage>
    )
  }

  return (
    <AnimatedPage className="max-w-2xl mx-auto px-6 py-12">
      <div className="mb-8">
        <h1 className="font-display text-3xl sm:text-4xl font-bold text-sage-800">Track Orders</h1>
        <p className="text-sage-500 text-sm mt-0.5">Live real-time status of your kitchen & delivery progress</p>
      </div>

      {profile && (
        <div className="space-y-4 mb-8">
          {myOrdersLoading ? (
            <div className="card p-8 text-center text-sage-400">Loading your orders...</div>
          ) : myOrders.length === 0 ? (
            <div className="card p-10 text-center text-sage-400 space-y-3">
              <Package size={36} className="mx-auto text-sage-300 animate-float" />
              <p>You haven't placed any orders yet.</p>
              <Link to="/menu" className="btn-primary text-xs inline-block">
                Explore Menu
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {myOrders.map((o) => (
                <motion.button
                  key={o.id}
                  whileHover={{ y: -3 }}
                  onClick={() => setActiveId(o.id)}
                  className="w-full card p-5 flex items-center justify-between hover:border-saffron-300 hover:shadow-lg transition-all text-left group"
                >
                  <div>
                    <div className="font-bold text-sage-800 text-base group-hover:text-saffron-600 transition-colors">
                      Order #{o.id.slice(0, 8).toUpperCase()}
                    </div>
                    <div className="text-xs text-sage-400 mt-1">
                      {new Date(o.placed_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      {' · '}{o.items?.length ?? 0} item{(o.items?.length ?? 0) !== 1 ? 's' : ''}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-extrabold text-saffron-600 text-lg mb-1">₹{o.total.toFixed(2)}</div>
                    <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-bold uppercase ${STATUS_COLORS[o.status] ?? 'bg-sage-50 text-sage-600'}`}>
                      {o.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                </motion.button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Guest tracker fallback */}
      <div className="card p-6 space-y-3">
        <h3 className="font-bold text-sm text-sage-800">Track as Guest / Search by Order ID</h3>
        <div className="flex gap-2">
          <input
            value={guestIdInput}
            onChange={(e) => setGuestIdInput(e.target.value)}
            placeholder="Paste order ID from your confirmation email..."
            className="flex-1 px-4 py-2.5 rounded-xl border border-sage-200 text-xs focus:ring-2 focus:ring-saffron-400 focus:outline-none"
          />
          <button
            onClick={() => setActiveId(guestIdInput.trim())}
            className="btn-primary text-xs px-5 flex items-center gap-1.5"
          >
            <Search size={14} /> Track
          </button>
        </div>
      </div>
    </AnimatedPage>
  )
}
