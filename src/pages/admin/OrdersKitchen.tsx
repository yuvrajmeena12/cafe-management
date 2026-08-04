import { useState } from 'react'
import { Package, ChefHat, Bike, CheckCircle2, MapPin } from 'lucide-react'
import { useOrders } from '../../hooks/useOrders'
import type { OrderStatus } from '../../types'

const COLUMNS: { key: OrderStatus | 'all'; label: string; icon: any }[] = [
  { key: 'all', label: 'All', icon: Package },
  { key: 'received', label: 'Received', icon: Package },
  { key: 'preparing', label: 'Preparing', icon: ChefHat },
  { key: 'ready', label: 'Ready', icon: Bike },
  { key: 'delivered', label: 'Delivered', icon: CheckCircle2 },
]

const NEXT_STATUS: Record<string, OrderStatus> = {
  received: 'preparing',
  preparing: 'ready',
  ready: 'out_for_delivery',
  out_for_delivery: 'delivered',
}

export default function OrdersKitchen() {
  const [filter, setFilter] = useState<OrderStatus | 'all'>('all')
  const { orders, updateStatus } = useOrders(filter)

  const counts = COLUMNS.reduce((acc, c) => {
    acc[c.key] = c.key === 'all' ? orders.length : orders.filter((o) => o.status === c.key).length
    return acc
  }, {} as Record<string, number>)

  return (
    <div>
      <h1 className="font-display text-3xl font-bold text-sage-700 mb-1">Orders & Kitchen</h1>
      <p className="text-sage-500 mb-6">Manage incoming orders and update kitchen status</p>

      <div className="flex gap-2 mb-8 flex-wrap">
        {COLUMNS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`px-4 py-2 rounded-lg flex items-center gap-2 font-medium text-sm ${filter === key ? 'bg-saffron-500 text-white' : 'bg-white border border-sage-100 text-sage-600'}`}
          >
            <Icon size={16} /> {label} ({counts[key] ?? 0})
          </button>
        ))}
      </div>

      {orders.length === 0 ? (
        <div className="text-center py-20 text-sage-400">
          <Package size={48} className="mx-auto mb-3 opacity-40" />
          No orders in this category.
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <div key={order.id} className="card p-5">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <div className="font-semibold text-sage-700">Order #{order.id.slice(0, 8)}</div>
                  {order.customer_name && (
                    <div className="text-xs text-sage-500">
                      {order.customer_name}
                      {order.customer_phone && <> · <a href={`tel:${order.customer_phone}`} className="text-saffron-600 hover:underline">{order.customer_phone}</a></>}
                    </div>
                  )}
                  <div className="text-sm text-sage-400 capitalize">{order.order_type.replace('_', ' ')} • {order.status.replace(/_/g, ' ')}</div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-saffron-600">₹{order.total.toFixed(2)}</div>
                  <div className="text-xs text-sage-400">{order.payment_status}</div>
                </div>
              </div>
              <ul className="text-sm text-sage-600 mb-3">
                {order.items?.map((it) => (
                  <li key={it.id}>{it.quantity}× {it.menu_item?.name ?? 'Item'}</li>
                ))}
              </ul>
              {order.delivery_address && (
                <a
                  href={
                    order.delivery_lat && order.delivery_lng
                      ? `https://www.google.com/maps?q=${order.delivery_lat},${order.delivery_lng}`
                      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.delivery_address)}`
                  }
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 text-xs text-saffron-600 hover:underline mb-3"
                >
                  <MapPin size={12} /> {order.delivery_address} — Open in Google Maps
                </a>
              )}
              {NEXT_STATUS[order.status] && (
                <button onClick={() => updateStatus(order.id, NEXT_STATUS[order.status])} className="btn-primary text-sm">
                  Mark as {NEXT_STATUS[order.status].replace(/_/g, ' ')}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
