import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MapPin, User, Mail, Phone, Wallet, CreditCard } from 'lucide-react'
import { useCart } from '../context/CartContext'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabaseClient'
import { openRazorpayCheckout } from '../lib/razorpay'
import { isValidEmail, isValidPhone } from '../lib/validation'
import { distanceKm, getDeliveryCharge } from '../lib/distance'
import AddressMapPicker from '../components/AddressMapPicker'
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

  // Prefill from the logged-in account once it loads — but only into
  // fields the customer hasn't already typed something into themselves,
  // so editing here always remains their choice.
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

  // Recalculate delivery charge automatically whenever the pinned address moves
  useEffect(() => {
    if (orderType !== 'delivery' || !addressLat || !addressLng || !cafeLocation) {
      setDeliveryCharge(0)
      return
    }
    const km = distanceKm(cafeLocation.lat, cafeLocation.lng, addressLat, addressLng)
    setDeliveryCharge(getDeliveryCharge(km, tiers))
  }, [orderType, addressLat, addressLng, cafeLocation, tiers])

  const tax = +(subtotal * 0.05).toFixed(2) // 5% GST placeholder — adjust to your actual rate
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
      setError('Invalid or expired discount code.')
      return
    }
    if (subtotal < data.min_order_value) {
      setError(`Minimum order value for this code is ₹${data.min_order_value}.`)
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
      return 'Please enter a valid email address (must include @) — this is where your order confirmation will be sent.'
    }
    if (!customerPhone.trim() || !isValidPhone(customerPhone)) {
      return 'Please enter a valid contact phone number — our delivery team uses this to reach you.'
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

    // Cash on Delivery — no payment gateway needed, order goes straight to
    // the kitchen. The delivery rider collects cash and marks it paid at
    // the moment they mark the order delivered.
    if (paymentMethod === 'cod') {
      clearCart()
      navigate(`/track?order=${order.id}`)
      setPlacing(false)
      return
    }

    // Online payment — create a matching Razorpay order server-side (it
    // re-reads the total from the database itself, so a tampered browser
    // request can't create a cheaper payment).
    const { data: rzp, error: rzpError } = await supabase.functions.invoke('create-razorpay-order', {
      body: { orderId: order.id },
    })

    if (rzpError || !rzp?.razorpayOrderId) {
      setError('Could not start payment. Please try again.')
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
        setError(e.message || 'Payment was not completed.')
        setPlacing(false)
      },
    })
    setPlacing(false)
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-10">
      <h1 className="font-display text-3xl font-bold text-sage-700 mb-6">Checkout</h1>

      <div className="card p-5 mb-5 space-y-4">
        <h2 className="font-semibold text-sage-700 flex items-center gap-2"><User size={18} /> Your Details</h2>
        <div>
          <label className="text-sm font-medium text-sage-700 block mb-1">Full Name</label>
          <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="e.g. Priya Sharma" className="w-full px-4 py-3 rounded-lg border border-sage-100" />
        </div>
        <div>
          <label className="text-sm font-medium text-sage-700 block mb-1 flex items-center gap-1"><Mail size={14} /> Email Address</label>
          <input type="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} placeholder="e.g. priya@example.com" className="w-full px-4 py-3 rounded-lg border border-sage-100" />
          <p className="text-xs text-sage-400 mt-1">We'll send your order confirmation and receipt here.</p>
        </div>
        <div>
          <label className="text-sm font-medium text-sage-700 block mb-1 flex items-center gap-1"><Phone size={14} /> Contact Phone Number</label>
          <input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="e.g. +91 98765 43210" className="w-full px-4 py-3 rounded-lg border border-sage-100" />
          <p className="text-xs text-sage-400 mt-1">Our delivery rider will call this number if they can't find you.</p>
        </div>
      </div>

      <div className="card p-5 mb-5">
        <h2 className="font-semibold text-sage-700 mb-3">Order Type</h2>
        <div className="flex gap-2">
          {(['dine_in', 'pickup', 'delivery'] as OrderType[]).map((t) => (
            <button key={t} onClick={() => setOrderType(t)} className={`px-4 py-2 rounded-lg text-sm font-medium capitalize ${orderType === t ? 'bg-saffron-500 text-white' : 'bg-sage-50 text-sage-600'}`}>
              {t.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {orderType === 'delivery' && (
        <div className="card p-5 mb-5">
          <h2 className="font-semibold text-sage-700 mb-3 flex items-center gap-2"><MapPin size={18} /> Delivery Address</h2>
          <AddressMapPicker
            address={address}
            lat={addressLat}
            lng={addressLng}
            onChange={(addr, lat, lng) => { setAddress(addr); setAddressLat(lat); setAddressLng(lng) }}
          />
          {deliveryCharge > 0 && (
            <p className="text-sm text-sage-600 mt-3 bg-sage-50 rounded-lg p-2">
              📍 Delivery charge for this location: <strong>₹{deliveryCharge}</strong>
            </p>
          )}
        </div>
      )}

      <div className="card p-5 mb-5">
        <h2 className="font-semibold text-sage-700 mb-3">Payment Method</h2>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setPaymentMethod('online')}
            className={`flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-medium border-2 ${paymentMethod === 'online' ? 'border-saffron-500 bg-saffron-50 text-saffron-700' : 'border-sage-100 text-sage-600'}`}
          >
            <CreditCard size={16} /> Pay Now Online
          </button>
          <button
            onClick={() => setPaymentMethod('cod')}
            className={`flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-medium border-2 ${paymentMethod === 'cod' ? 'border-saffron-500 bg-saffron-50 text-saffron-700' : 'border-sage-100 text-sage-600'}`}
          >
            <Wallet size={16} /> Cash on Delivery
          </button>
        </div>
      </div>

      <div className="card p-5 mb-5">
        <h2 className="font-semibold text-sage-700 mb-3">Discount Code</h2>
        {availableOffers.length > 0 && (
          <div className="mb-3 space-y-2">
            <p className="text-xs text-sage-400">Available offers — tap to apply:</p>
            {availableOffers.map((offer) => (
              <button
                key={offer.id}
                onClick={() => applyDiscount(offer.code)}
                className="w-full flex justify-between items-center bg-sage-50 hover:bg-sage-100 rounded-lg px-4 py-2.5 text-left"
              >
                <div>
                  <span className="font-bold text-sage-700">{offer.code}</span>
                  <span className="text-sm text-sage-500 ml-2">
                    {offer.type === 'percent' ? `${offer.value}% off` : `₹${offer.value} off`}
                    {offer.min_order_value > 0 && ` on orders above ₹${offer.min_order_value}`}
                  </span>
                </div>
                <span className="text-xs text-saffron-600">Apply →</span>
              </button>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <input value={discountCode} onChange={(e) => setDiscountCode(e.target.value)} placeholder="Or enter a code manually" className="flex-1 px-4 py-3 rounded-lg border border-sage-100" />
          <button onClick={applyDiscount} className="btn-secondary">Apply</button>
        </div>
      </div>

      <div className="card p-5 space-y-2">
        <div className="flex justify-between text-sage-600"><span>Subtotal</span><span>₹{subtotal.toFixed(2)}</span></div>
        <div className="flex justify-between text-sage-600"><span>Tax (5%)</span><span>₹{tax.toFixed(2)}</span></div>
        {orderType === 'delivery' && <div className="flex justify-between text-sage-600"><span>Delivery Charge</span><span>₹{deliveryCharge.toFixed(2)}</span></div>}
        {discountAmount > 0 && <div className="flex justify-between text-green-600"><span>Discount</span><span>-₹{discountAmount.toFixed(2)}</span></div>}
        <div className="flex justify-between font-bold text-lg text-sage-700 border-t border-sage-100 pt-2">
          <span>Total</span><span>₹{total.toFixed(2)}</span>
        </div>
      </div>

      {error && <p className="text-red-500 text-sm mt-3">{error}</p>}

      <button onClick={placeOrder} disabled={placing} className="btn-primary w-full mt-5">
        {placing ? 'Placing order...' : paymentMethod === 'cod' ? `Place Order — Pay ₹${total.toFixed(2)} on Delivery` : `Pay ₹${total.toFixed(2)} & Place Order`}
      </button>
    </div>
  )
}
