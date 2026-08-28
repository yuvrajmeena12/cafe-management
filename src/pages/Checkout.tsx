import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MapPin, User, Mail, Phone, Wallet, CreditCard, Sparkles, CheckCircle2, ShieldCheck, ArrowRight } from 'lucide-react'
import { motion } from 'framer-motion'
import { useCart } from '../context/CartContext'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabaseClient'
import { openRazorpayCheckout } from '../lib/razorpay'
import { isValidEmail, isValidPhone } from '../lib/validation'
import { distanceKm, getDeliveryCharge } from '../lib/distance'
import AddressMapPicker from '../components/AddressMapPicker'
import AnimatedPage from '../components/AnimatedPage'
import AnimatedCounter from '../components/AnimatedCounter'
import type { OrderType, DeliveryChargeTier, Discount } from '../types'

export default function Checkout() {
  const { lines, subtotal, clearCart } = useCart()
  const { profile, email } = useAuth()
  const navigate = useNavigate()

  const [customerName, setCustomerName] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [orderType, setOrderType] = useState<OrderType>('delivery')
  const [address, setAddress] = useState('')
  const [addressLat, setAddressLat] = useState<number | null>(null)
  const [addressLng, setAddressLng] = useState<number | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<'online' | 'cod'>('online')
  const [discountCode, setDiscountCode] = useState('')
  const [discountAmount, setDiscountAmount] = useState(0)
  const [placing, setPlacing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [deliveryCharge, setDeliveryCharge] = useState(0)
  const [cafeLocation, setCafeLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [tiers, setTiers] = useState<DeliveryChargeTier[]>([])
  const [availableOffers, setAvailableOffers] = useState<Discount[]>([])

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10)
    supabase
      .from('discounts')
      .select('*')
      .eq('active', true)
      .lte('valid_from', today)
      .gte('valid_to', today)
      .then(({ data }) => setAvailableOffers((data as Discount[]) ?? []))
  }, [])

  useEffect(() => {
    if (profile?.full_name) setCustomerName((prev) => prev || profile.full_name!)
    if (profile?.phone) setCustomerPhone((prev) => prev || profile.phone!)
    if (email) setCustomerEmail((prev) => prev || email)
  }, [profile, email])

  useEffect(() => {
    supabase.from('cafe_settings').select('address_lat, address_lng').eq('id', 1).single().then(({ data }) => {
      if (data?.address_lat && data?.address_lng) setCafeLocation({ lat: data.address_lat, lng: data.address_lng })
    })
    supabase.from('delivery_charge_tiers').select('*').order('max_km').then(({ data }) => {
      setTiers((data as DeliveryChargeTier[]) ?? [])
    })
  }, [])

  useEffect(() => {
    if (orderType !== 'delivery' || !addressLat || !addressLng || !cafeLocation) {
      setDeliveryCharge(0)
      return
    }
    const km = distanceKm(cafeLocation.lat, cafeLocation.lng, addressLat, addressLng)
    setDeliveryCharge(getDeliveryCharge(km, tiers))
  }, [orderType, addressLat, addressLng, cafeLocation, tiers])

  const tax = +(subtotal * 0.05).toFixed(2)
  const total = +(subtotal + tax + deliveryCharge - discountAmount).toFixed(2)

  async function applyDiscount(codeOverride?: string) {
    const codeToApply = codeOverride ?? discountCode
    if (!codeToApply.trim()) return
    const { data } = await supabase
      .from('discounts')
      .select('*')
      .eq('code', codeToApply.trim().toUpperCase())
      .eq('active', true)
      .single()

    if (!data) {
      setError('Invalid or expired promotional code.')
      return
    }
    if (subtotal < data.min_order_value) {
      setError(`Minimum order value for ${data.code} is ₹${data.min_order_value}.`)
      return
    }
    const amount = data.type === 'percent' ? (subtotal * data.value) / 100 : data.value
    setDiscountCode(codeToApply)
    setDiscountAmount(+amount.toFixed(2))
    setError(null)
  }

  function validateContactDetails(): string | null {
    if (!customerName.trim()) return 'Please enter your name.'
    if (!customerEmail.trim() || !isValidEmail(customerEmail)) {
      return 'Please enter a valid email address — this is where your order receipt and invoice will be sent.'
    }
    if (!customerPhone.trim() || !isValidPhone(customerPhone)) {
      return 'Please enter a valid contact phone number for delivery coordination.'
    }
    if (orderType === 'delivery' && !address.trim()) return 'Please enter a delivery address.'
    return null
  }

  async function placeOrder() {
    const validationError = validateContactDetails()
    if (validationError) {
      setError(validationError)
      return
    }

    setPlacing(true)
    setError(null)

    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .insert({
        customer_id: profile?.id ?? null,
        customer_name: customerName.trim(),
        customer_email: customerEmail.trim(),
        customer_phone: customerPhone.trim(),
        status: 'received',
        order_type: orderType,
        delivery_address: orderType === 'delivery' ? address : null,
        delivery_lat: orderType === 'delivery' ? addressLat : null,
        delivery_lng: orderType === 'delivery' ? addressLng : null,
        delivery_charge: deliveryCharge,
        subtotal,
        discount_amount: discountAmount,
        tax,
        total,
        payment_method: paymentMethod,
        payment_status: paymentMethod === 'cod' ? 'pending' : 'pending',
      })
      .select()
      .single()

    if (orderErr || !order) {
      setError(orderErr?.message ?? 'Could not create order.')
      setPlacing(false)
      return
    }

    await supabase.from('order_items').insert(
      lines.map((l) => ({
        order_id: order.id,
        menu_item_id: l.menu_item.id,
        quantity: l.quantity,
        unit_price: l.menu_item.price,
      }))
    )

    // Dispatch order confirmation email via edge function
    supabase.functions.invoke('send-order-email', {
      body: { orderId: order.id, isNewOrder: true },
    }).catch(() => {})

    if (paymentMethod === 'cod') {
      clearCart()
      navigate(`/track?order=${order.id}`)
      setPlacing(false)
      return
    }

    const { data: rzp, error: rzpError } = await supabase.functions.invoke('create-razorpay-order', {
      body: { orderId: order.id },
    })

    if (rzpError || !rzp?.razorpayOrderId) {
      setError('Could not initialize Razorpay payment. Please try again.')
      setPlacing(false)
      return
    }

    openRazorpayCheckout({
      razorpayOrderId: rzp.razorpayOrderId,
      amountInPaise: rzp.amount,
      cafeName: 'Saffron & Sage',
      customerName,
      customerEmail,
      customerPhone,
      onSuccess: () => {
        clearCart()
        navigate(`/track?order=${order.id}`)
      },
      onFailure: (e) => {
        setError(e.message || 'Payment was cancelled.')
        setPlacing(false)
      },
    })
    setPlacing(false)
  }

  return (
    <AnimatedPage className="max-w-3xl mx-auto px-6 py-12">
      <div className="mb-8">
        <h1 className="font-display text-3xl sm:text-4xl font-bold text-sage-800">Checkout</h1>
        <p className="text-sage-500 text-sm mt-0.5">Complete your details for dispatch & kitchen preparation</p>
      </div>

      <div className="space-y-5">
        {/* Step 1: Customer Contact Info */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="card p-6 space-y-4"
        >
          <h2 className="font-bold text-sage-800 flex items-center gap-2 text-base">
            <User size={18} className="text-saffron-500" /> Customer Information
          </h2>
          <div>
            <label className="text-xs font-semibold uppercase text-sage-600 block mb-1">Full Name</label>
            <input
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="e.g. Priya Sharma"
              className="w-full px-4 py-2.5 rounded-xl border border-sage-200 text-sm focus:ring-2 focus:ring-saffron-400 focus:outline-none"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold uppercase text-sage-600 block mb-1 flex items-center gap-1">
                <Mail size={13} /> Email Address (For Receipt & Invoice)
              </label>
              <input
                type="email"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                placeholder="e.g. priya@example.com"
                className="w-full px-4 py-2.5 rounded-xl border border-sage-200 text-sm focus:ring-2 focus:ring-saffron-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase text-sage-600 block mb-1 flex items-center gap-1">
                <Phone size={13} /> Contact Phone Number
              </label>
              <input
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="e.g. +91 98765 43210"
                className="w-full px-4 py-2.5 rounded-xl border border-sage-200 text-sm focus:ring-2 focus:ring-saffron-400 focus:outline-none"
              />
            </div>
          </div>
        </motion.div>

        {/* Step 2: Order Type */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="card p-6"
        >
          <h2 className="font-bold text-sage-800 mb-3 text-base">Dining Preference</h2>
          <div className="grid grid-cols-3 gap-2">
            {(['delivery', 'dine_in', 'pickup'] as OrderType[]).map((t) => (
              <button
                key={t}
                onClick={() => setOrderType(t)}
                className={`py-3 rounded-xl text-xs font-bold capitalize transition-all ${
                  orderType === t
                    ? 'bg-saffron-500 text-white shadow-md'
                    : 'bg-sage-50 text-sage-700 hover:bg-sage-100'
                }`}
              >
                {t.replace('_', ' ')}
              </button>
            ))}
          </div>
        </motion.div>

        {/* Step 3: Address Pinning for Delivery */}
        {orderType === 'delivery' && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="card p-6 space-y-3"
          >
            <h2 className="font-bold text-sage-800 flex items-center gap-2 text-base">
              <MapPin size={18} className="text-saffron-500" /> Delivery Address Pin
            </h2>
            <AddressMapPicker
              address={address}
              lat={addressLat}
              lng={addressLng}
              onChange={(addr, lat, lng) => {
                setAddress(addr)
                setAddressLat(lat)
                setAddressLng(lng)
              }}
            />
            {deliveryCharge > 0 && (
              <div className="bg-sage-50 border border-sage-200/80 rounded-xl p-3 text-xs text-sage-700 font-medium">
                📍 Calculated delivery fee for this distance: <strong>₹{deliveryCharge}</strong>
              </div>
            )}
          </motion.div>
        )}

        {/* Step 4: Payment Method */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="card p-6"
        >
          <h2 className="font-bold text-sage-800 mb-3 text-base">Payment Method</h2>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setPaymentMethod('online')}
              className={`flex items-center justify-center gap-2 py-3.5 rounded-xl text-xs font-bold border-2 transition-all ${
                paymentMethod === 'online'
                  ? 'border-saffron-500 bg-saffron-50/60 text-saffron-800 shadow-sm'
                  : 'border-sage-100 text-sage-600 hover:bg-sage-50'
              }`}
            >
              <CreditCard size={16} /> Pay Online (UPI / Cards / Netbanking)
            </button>
            <button
              onClick={() => setPaymentMethod('cod')}
              className={`flex items-center justify-center gap-2 py-3.5 rounded-xl text-xs font-bold border-2 transition-all ${
                paymentMethod === 'cod'
                  ? 'border-saffron-500 bg-saffron-50/60 text-saffron-800 shadow-sm'
                  : 'border-sage-100 text-sage-600 hover:bg-sage-50'
              }`}
            >
              <Wallet size={16} /> Cash on Delivery
            </button>
          </div>
        </motion.div>

        {/* Step 5: Coupons & Promo Codes */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="card p-6 space-y-3"
        >
          <h2 className="font-bold text-sage-800 text-base">Have a Promo Code?</h2>
          {availableOffers.length > 0 && (
            <div className="space-y-2">
              <span className="text-xs text-sage-400 font-medium">Available Offers:</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {availableOffers.map((offer) => (
                  <button
                    key={offer.id}
                    onClick={() => applyDiscount(offer.code)}
                    className="flex justify-between items-center bg-sage-50 hover:bg-sage-100/80 rounded-xl p-3 text-left border border-sage-100 transition-colors"
                  >
                    <div>
                      <span className="font-bold text-xs text-sage-800">{offer.code}</span>
                      <span className="text-[11px] text-sage-500 block">
                        {offer.type === 'percent' ? `${offer.value}% off` : `₹${offer.value} off`}
                        {offer.min_order_value > 0 && ` on ₹${offer.min_order_value}+`}
                      </span>
                    </div>
                    <span className="text-xs font-bold text-saffron-600">Apply →</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <input
              value={discountCode}
              onChange={(e) => setDiscountCode(e.target.value)}
              placeholder="Or enter custom promo code..."
              className="flex-1 px-4 py-2.5 rounded-xl border border-sage-200 text-xs font-medium focus:ring-2 focus:ring-saffron-400 focus:outline-none uppercase"
            />
            <button onClick={() => applyDiscount()} className="btn-secondary text-xs px-5">
              Apply Code
            </button>
          </div>
        </motion.div>

        {/* Step 6: Order Total Breakdown */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="card p-6 space-y-2.5 bg-gradient-to-br from-white to-sage-50/50 border-sage-200/80 shadow-lg"
        >
          <div className="flex justify-between text-xs text-sage-600">
            <span>Items Subtotal</span>
            <span className="font-semibold">₹{subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-xs text-sage-600">
            <span>GST & Service (5%)</span>
            <span className="font-semibold">₹{tax.toFixed(2)}</span>
          </div>
          {orderType === 'delivery' && (
            <div className="flex justify-between text-xs text-sage-600">
              <span>Delivery Charge</span>
              <span className="font-semibold">₹{deliveryCharge.toFixed(2)}</span>
            </div>
          )}
          {discountAmount > 0 && (
            <div className="flex justify-between text-xs text-green-600 font-bold">
              <span>Discount Applied</span>
              <span>-₹{discountAmount.toFixed(2)}</span>
            </div>
          )}

          <div className="flex justify-between items-center text-lg font-bold text-sage-800 border-t-2 border-sage-200/80 pt-3 mt-2">
            <span>Grand Total</span>
            <span className="text-2xl text-saffron-600">
              <AnimatedCounter value={total} prefix="₹" decimals={2} />
            </span>
          </div>
        </motion.div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 text-xs p-3.5 rounded-xl">
            {error}
          </div>
        )}

        <button
          onClick={placeOrder}
          disabled={placing}
          className="btn-primary w-full py-4 text-base font-bold shadow-lg shadow-saffron-500/25 flex items-center justify-center gap-2"
        >
          {placing ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              {paymentMethod === 'cod'
                ? `Place Order — Pay ₹${total.toFixed(2)} on Delivery`
                : `Pay ₹${total.toFixed(2)} & Place Order`}
              <ArrowRight size={18} />
            </>
          )}
        </button>
      </div>
    </AnimatedPage>
  )
}
