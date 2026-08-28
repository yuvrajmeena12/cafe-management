import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Printer, CheckCircle, Download } from 'lucide-react'
import { motion } from 'framer-motion'
import { supabase } from '../lib/supabaseClient'
import { useCafeSettings } from '../context/CafeSettingsContext'
import AnimatedPage from '../components/AnimatedPage'
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

  if (!order) {
    return (
      <div className="p-20 text-center text-sage-400">
        <div className="w-8 h-8 border-4 border-saffron-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        Generating official invoice...
      </div>
    )
  }

  return (
    <AnimatedPage className="max-w-2xl mx-auto px-6 py-12 print:p-0">
      <div className="flex justify-end mb-4 print:hidden">
        <button
          onClick={() => window.print()}
          className="btn-primary flex items-center gap-2 text-xs font-bold py-2.5 px-4 shadow-sm"
        >
          <Printer size={15} /> Print / Save as PDF
        </button>
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="card p-8 sm:p-10 print:shadow-none print:border-none shadow-xl border-sage-200/80 bg-white"
      >
        <div className="flex justify-between items-start mb-8 pb-6 border-b border-sage-100">
          <div>
            {settings.logo_url && (
              <img src={settings.logo_url} className="w-12 h-12 rounded-xl object-cover mb-2" />
            )}
            <h1 className="font-display text-2xl font-bold text-sage-800">{settings.cafe_name ?? 'Saffron & Sage'}</h1>
            <p className="text-xs text-sage-500 mt-0.5">{settings.address ?? 'Artisanal Cafe'}</p>
            <p className="text-xs text-sage-500">{settings.phone ?? ''} · {settings.email ?? ''}</p>
          </div>
          <div className="text-right">
            <h2 className="font-display font-extrabold text-2xl text-sage-800 tracking-wider">TAX INVOICE</h2>
            <p className="font-mono text-xs font-bold text-saffron-600 mt-1">#{order.id.slice(0, 8).toUpperCase()}</p>
            <p className="text-xs text-sage-400 mt-0.5">
              {new Date(order.placed_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6 mb-8 text-xs">
          <div>
            <div className="text-[11px] text-sage-400 uppercase font-bold tracking-wider mb-1.5">Billed To</div>
            <p className="font-bold text-sage-800 text-sm">{order.customer_name ?? 'Valued Customer'}</p>
            {order.customer_phone && <p className="text-sage-500 mt-0.5">{order.customer_phone}</p>}
            {order.customer_email && <p className="text-sage-500">{order.customer_email}</p>}
            {order.delivery_address && <p className="text-sage-500 mt-1">{order.delivery_address}</p>}
          </div>
          <div className="text-right">
            <div className="text-[11px] text-sage-400 uppercase font-bold tracking-wider mb-1.5">Payment Details</div>
            <p className="text-sage-800 font-semibold capitalize">{order.payment_method === 'cod' ? 'Cash on Delivery' : 'Online Payment'}</p>
            <p className={`font-bold text-xs uppercase mt-0.5 ${order.payment_status === 'paid' ? 'text-green-600' : 'text-amber-600'}`}>
              {order.payment_status === 'paid' ? '✓ PAID' : 'PENDING'}
            </p>
            <p className="text-sage-400 capitalize mt-1">Type: {order.order_type.replace('_', ' ')}</p>
          </div>
        </div>

        <table className="w-full mb-6 text-xs">
          <thead>
            <tr className="border-b-2 border-sage-100 text-left text-[11px] text-sage-400 uppercase font-bold">
              <th className="py-2.5">Item Description</th>
              <th className="py-2.5 text-center">Qty</th>
              <th className="py-2.5 text-right">Unit Price</th>
              <th className="py-2.5 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {order.items?.map((it) => (
              <tr key={it.id} className="border-b border-sage-50">
                <td className="py-3 text-sage-800 font-medium">{it.menu_item?.name ?? 'Item'}</td>
                <td className="py-3 text-center text-sage-600">{it.quantity}</td>
                <td className="py-3 text-right text-sage-600">₹{it.unit_price.toFixed(2)}</td>
                <td className="py-3 text-right text-sage-800 font-bold">₹{(it.unit_price * it.quantity).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex justify-end">
          <div className="w-64 space-y-2 text-xs">
            <div className="flex justify-between text-sage-600"><span>Subtotal</span><span>₹{order.subtotal.toFixed(2)}</span></div>
            <div className="flex justify-between text-sage-600"><span>Tax (GST 5%)</span><span>₹{order.tax.toFixed(2)}</span></div>
            {order.delivery_charge > 0 && <div className="flex justify-between text-sage-600"><span>Delivery Charge</span><span>₹{order.delivery_charge.toFixed(2)}</span></div>}
            {order.discount_amount > 0 && <div className="flex justify-between text-green-600 font-bold"><span>Discount</span><span>-₹{order.discount_amount.toFixed(2)}</span></div>}
            <div className="flex justify-between font-extrabold text-base text-sage-800 border-t-2 border-sage-200 pt-2 mt-2">
              <span>Total Paid</span><span className="text-saffron-600">₹{order.total.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div className="mt-12 pt-6 border-t border-sage-100 text-center text-[11px] text-sage-400">
          Thank you for dining with {settings.cafe_name ?? 'Saffron & Sage'}! · {settings.tagline ?? 'Eat Healthy, Stay Healthy'}
        </div>
      </motion.div>
    </AnimatedPage>
  )
}
