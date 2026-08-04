import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Printer } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { useCafeSettings } from '../context/CafeSettingsContext'
import type { Order } from '../types'

export default function Invoice() {
  const { orderId } = useParams()
  const { settings } = useCafeSettings()
  const [order, setOrder] = useState<Order | null>(null)

  useEffect(() => {
    if (!orderId) return
    supabase
      .from('orders')
      .select('*, items:order_items(*, menu_item:menu_items(*))')
      .eq('id', orderId)
      .single()
      .then(({ data }) => setOrder(data as Order))
  }, [orderId])

  if (!order) return <div className="p-10 text-center text-sage-500">Loading invoice...</div>

  return (
    <div className="max-w-2xl mx-auto px-6 py-10 print:p-0">
      <div className="flex justify-end mb-4 print:hidden">
        <button onClick={() => window.print()} className="btn-primary flex items-center gap-2 text-sm">
          <Printer size={16} /> Print / Save as PDF
        </button>
      </div>

      <div className="card p-8 print:shadow-none print:border-none">
        <div className="flex justify-between items-start mb-8 pb-6 border-b border-sage-100">
          <div>
            {settings.logo_url && <img src={settings.logo_url} className="w-12 h-12 rounded-lg object-cover mb-2" />}
            <h1 className="font-display text-2xl font-bold text-sage-700">{settings.cafe_name ?? 'Saffron & Sage'}</h1>
            <p className="text-sm text-sage-500">{settings.address ?? ''}</p>
            <p className="text-sm text-sage-500">{settings.phone ?? ''} · {settings.email ?? ''}</p>
          </div>
          <div className="text-right">
            <h2 className="font-bold text-xl text-sage-700">INVOICE</h2>
            <p className="text-sm text-sage-500">#{order.id.slice(0, 8).toUpperCase()}</p>
            <p className="text-sm text-sage-500">{new Date(order.placed_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6 mb-8">
          <div>
            <div className="text-xs text-sage-400 uppercase font-semibold mb-1">Billed To</div>
            <p className="font-medium text-sage-700">{order.customer_name ?? 'Guest Customer'}</p>
            {order.customer_phone && <p className="text-sm text-sage-500">{order.customer_phone}</p>}
            {order.customer_email && <p className="text-sm text-sage-500">{order.customer_email}</p>}
            {order.delivery_address && <p className="text-sm text-sage-500 mt-1">{order.delivery_address}</p>}
          </div>
          <div className="text-right">
            <div className="text-xs text-sage-400 uppercase font-semibold mb-1">Payment</div>
            <p className="text-sm text-sage-700 capitalize">{order.payment_method === 'cod' ? 'Cash on Delivery' : 'Paid Online'}</p>
            <p className={`text-sm font-medium ${order.payment_status === 'paid' ? 'text-green-600' : 'text-amber-600'}`}>
              {order.payment_status === 'paid' ? 'PAID' : order.payment_status.toUpperCase()}
            </p>
            <p className="text-sm text-sage-500 capitalize mt-1">{order.order_type.replace('_', ' ')}</p>
          </div>
        </div>

        <table className="w-full mb-6">
          <thead>
            <tr className="border-b-2 border-sage-100 text-left text-xs text-sage-400 uppercase">
              <th className="py-2">Item</th>
              <th className="py-2 text-center">Qty</th>
              <th className="py-2 text-right">Unit Price</th>
              <th className="py-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {order.items?.map((it) => (
              <tr key={it.id} className="border-b border-sage-50">
                <td className="py-2 text-sage-700">{it.menu_item?.name ?? 'Item'}</td>
                <td className="py-2 text-center text-sage-600">{it.quantity}</td>
                <td className="py-2 text-right text-sage-600">₹{it.unit_price.toFixed(2)}</td>
                <td className="py-2 text-right text-sage-700 font-medium">₹{(it.unit_price * it.quantity).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex justify-end">
          <div className="w-64 space-y-1.5 text-sm">
            <div className="flex justify-between text-sage-600"><span>Subtotal</span><span>₹{order.subtotal.toFixed(2)}</span></div>
            <div className="flex justify-between text-sage-600"><span>Tax</span><span>₹{order.tax.toFixed(2)}</span></div>
            {order.delivery_charge > 0 && <div className="flex justify-between text-sage-600"><span>Delivery Charge</span><span>₹{order.delivery_charge.toFixed(2)}</span></div>}
            {order.discount_amount > 0 && <div className="flex justify-between text-green-600"><span>Discount</span><span>-₹{order.discount_amount.toFixed(2)}</span></div>}
            <div className="flex justify-between font-bold text-lg text-sage-700 border-t-2 border-sage-100 pt-2 mt-2">
              <span>Total</span><span>₹{order.total.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-sage-100 text-center text-xs text-sage-400">
          Thank you for ordering with {settings.cafe_name ?? 'Saffron & Sage'}! · {settings.tagline ?? 'Eat Healthy, Stay Healthy'}
        </div>
      </div>
    </div>
  )
}
