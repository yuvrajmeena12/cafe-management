import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CheckCircle2, Circle, Package, ChefHat, Bike, Receipt, ArrowLeft, Search } from 'lucide-react'
import { useOrderTracking, useMyOrders } from '../hooks/useOrders'
import { useAuth } from '../context/AuthContext'
import type { OrderStatus } from '../types'

const STEPS: { key: OrderStatus; label: string; icon: any }[] = [
  { key: 'received', label: 'Received', icon: Package },
  { key: 'preparing', label: 'Preparing', icon: ChefHat },
  { key: 'ready', label: 'Ready', icon: CheckCircle2 },
  { key: 'out_for_delivery', label: 'Out for Delivery', icon: Bike },
  { key: 'delivered', label: 'Delivered', icon: CheckCircle2 },
]

const STATUS_COLORS: Record<string, string> = {
  received: 'bg-blue-50 text-blue-600',
  preparing: 'bg-amber-50 text-amber-600',
  ready: 'bg-purple-50 text-purple-600',
  out_for_delivery: 'bg-saffron-50 text-saffron-600',
  delivered: 'bg-green-50 text-green-600',
  cancelled: 'bg-red-50 text-red-600',
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

  // ── Detail view: a specific order is selected ──────────────────────────
  if (activeId && order) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-10">
        <button onClick={() => setActiveId(undefined)} className="flex items-center gap-1.5 text-sm text-sage-500 hover:text-sage-700 mb-6">
          <ArrowLeft size={16} /> Back to my orders
        </button>

        <div className="card p-6">
          <div className="flex justify-between items-start mb-6">
            <div>
              <div className="text-sm text-sage-400">Order #{order.id.slice(0, 8)}</div>
              <div className={`inline-block mt-1 px-3 py-1 rounded-full text-sm font-semibold capitalize ${STATUS_COLORS[order.status] ?? 'bg-sage-50 text-sage-600'}`}>
                {order.status.replace(/_/g, ' ')}
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm text-sage-400">Total</div>
              <div className="font-bold text-xl text-saffron-600">₹{order.total.toFixed(2)}</div>
              <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full font-medium ${
                order.payment_status === 'paid' ? 'bg-green-50 text-green-600' :
                order.payment_status === 'failed' ? 'bg-red-50 text-red-600' :
                'bg-amber-50 text-amber-600'
              }`}>
                {order.payment_status === 'paid' ? '✓ Paid' : order.payment_status === 'failed' ? 'Payment Failed' : 'Payment Processing...'}
              </span>
            </div>
          </div>

          <div className="flex justify-between mb-6">
            {STEPS.map((step, i) => {
              const done = i <= currentIndex
              const Icon = step.icon
              return (
                <div key={step.key} className="flex flex-col items-center flex-1 text-center">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 ${done ? 'bg-saffron-500 text-white' : 'bg-sage-50 text-sage-300'}`}>
                    {done ? <Icon size={18} /> : <Circle size={18} />}
                  </div>
                  <span className={`text-xs ${done ? 'text-sage-700 font-medium' : 'text-sage-300'}`}>{step.label}</span>
                </div>
              )
            })}
          </div>

          {order.items && order.items.length > 0 && (
            <div className="border-t border-sage-100 pt-4 mb-4">
              <div className="text-sm font-medium text-sage-700 mb-2">Items</div>
              <ul className="text-sm text-sage-600 space-y-1">
                {order.items.map((it) => <li key={it.id}>{it.quantity}× {it.menu_item?.name ?? 'Item'}</li>)}
              </ul>
            </div>
          )}

          {order.delivery_address && (
            <div className="pt-2 text-sm text-sage-600 mb-3">
              Delivering to: {order.delivery_address}
            </div>
          )}

          <Link to={`/invoice/${order.id}`} className="flex items-center justify-center gap-1.5 text-sm text-saffron-600 hover:underline pt-2 border-t border-sage-100 mt-2">
            <Receipt size={14} /> View / Print Invoice
          </Link>
        </div>
      </div>
    )
  }

  // ── List view: choose which order to track ──────────────────────────
  return (
    <div className="max-w-2xl mx-auto px-6 py-10">
      <h1 className="font-display text-3xl font-bold text-sage-700 mb-2">Track Your Order</h1>
      <p className="text-sage-500 mb-8">Click any order below to see its live status.</p>

      {profile && (
        <>
          {myOrdersLoading ? (
            <div className="text-center text-sage-400 py-10">Loading your orders...</div>
          ) : myOrders.length === 0 ? (
            <div className="card p-8 text-center text-sage-400 mb-6">
              You haven't placed any orders yet.
            </div>
          ) : (
            <div className="space-y-3 mb-8">
              {myOrders.map((o) => (
                <button
                  key={o.id}
                  onClick={() => setActiveId(o.id)}
                  className="w-full card p-4 flex items-center justify-between hover:border-saffron-300 hover:shadow-md transition-all text-left"
                >
                  <div>
                    <div className="font-semibold text-sage-700">Order #{o.id.slice(0, 8)}</div>
                    <div className="text-xs text-sage-400 mt-0.5">
                      {new Date(o.placed_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      {' · '}{o.items?.length ?? 0} item{(o.items?.length ?? 0) !== 1 ? 's' : ''}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-saffron-600 mb-1">₹{o.total.toFixed(2)}</div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${STATUS_COLORS[o.status] ?? 'bg-sage-50 text-sage-600'}`}>
                      {o.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {/* Guest fallback — for orders placed without an account */}
      {!profile && (
        <p className="text-sm text-sage-500 mb-4">
          <Link to="/login" className="text-saffron-600 font-medium hover:underline">Log in</Link> to see all your past orders automatically,
          or look one up by ID below if you checked out as a guest.
        </p>
      )}

      {profile && (
        <button onClick={() => setShowGuestSearch(!showGuestSearch)} className="text-sm text-sage-400 hover:text-sage-600 mb-3">
          {showGuestSearch ? 'Hide' : 'Looking for a guest order instead?'}
        </button>
      )}

      {(showGuestSearch || !profile) && (
        <div className="card p-5">
          <div className="text-sm font-medium text-sage-700 mb-2">Track by Order ID</div>
          <div className="flex gap-2">
            <input
              value={guestIdInput}
              onChange={(e) => setGuestIdInput(e.target.value)}
              placeholder="Paste the Order ID from your confirmation email"
              className="flex-1 px-4 py-3 rounded-lg border border-sage-100"
            />
            <button onClick={() => setActiveId(guestIdInput.trim())} className="btn-primary flex items-center gap-1.5">
              <Search size={16} /> Track
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
