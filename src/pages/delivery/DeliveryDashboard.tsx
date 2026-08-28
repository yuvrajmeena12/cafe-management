import { useEffect, useMemo, useState } from 'react'
import {
  Package, MapPin, CheckCircle2, LogOut, Bike, Phone, Mail, Star, TrendingUp,
  Wallet, Navigation, Route, Truck, Shield, Circle, Send,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'
import { useCafeSettings } from '../../context/CafeSettingsContext'
import { distanceKm } from '../../lib/distance'
import AnimatedPage from '../../components/AnimatedPage'
import AnimatedCounter from '../../components/AnimatedCounter'
import type { Order } from '../../types'

type Tab = 'ready' | 'ongoing' | 'past'

const STAGE_FLOW: Record<string, { next: string; label: string } | null> = {
  assigned: { next: 'picked_up', label: 'Order Picked' },
  picked_up: { next: 'on_the_way', label: 'On the Way' },
  on_the_way: { next: 'reached', label: 'Reached Location' },
  reached: { next: 'delivered', label: 'Delivered' },
  delivered: null,
}

export default function DeliveryDashboard() {
  const { profile, signOut } = useAuth()
  const { settings } = useCafeSettings()
  const [tab, setTab] = useState<Tab>('ready')
  const [readyOrders, setReadyOrders] = useState<Order[]>([])
  const [myOngoing, setMyOngoing] = useState<Order[]>([])
  const [myPast, setMyPast] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [riderLocation, setRiderLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [emailStatus, setEmailStatus] = useState<Record<string, string>>({})

  const [vehicleType, setVehicleType] = useState('')
  const [vehicleNumber, setVehicleNumber] = useState('')
  const [insuranceExpiry, setInsuranceExpiry] = useState('')
  const [savingVehicle, setSavingVehicle] = useState(false)

  async function load() {
    const { data: ready } = await supabase
      .from('orders')
      .select('*, items:order_items(*, menu_item:menu_items(*))')
      .eq('status', 'ready')
      .eq('order_type', 'delivery')
      .order('placed_at')

    const { data: ongoing } = await supabase
      .from('orders')
      .select('*, items:order_items(*, menu_item:menu_items(*))')
      .eq('status', 'out_for_delivery')
      .eq('assigned_delivery_id', profile?.id)
      .order('placed_at')

    const { data: past } = await supabase
      .from('orders')
      .select('*, items:order_items(*, menu_item:menu_items(*))')
      .eq('status', 'delivered')
      .eq('assigned_delivery_id', profile?.id)
      .order('delivered_at', { ascending: false })
      .limit(50)

    setReadyOrders((ready as Order[]) ?? [])
    setMyOngoing((ongoing as Order[]) ?? [])
    setMyPast((past as Order[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
    if (profile) {
      setVehicleType(profile.vehicle_type ?? '')
      setVehicleNumber(profile.vehicle_number ?? '')
      setInsuranceExpiry(profile.vehicle_insurance_expiry ?? '')
    }
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setRiderLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => {}
      )
    }
    const channel = supabase
      .channel('delivery-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, load)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile])

  const stats = useMemo(() => {
    const today = new Date().toDateString()
    const thisMonth = new Date().getMonth()
    const thisYear = new Date().getFullYear()

    const todaysEarnings = myPast.filter((o) => o.delivered_at && new Date(o.delivered_at).toDateString() === today)
      .reduce((s, o) => s + Number(o.delivery_charge || 0), 0)
    const monthlyEarnings = myPast.filter((o) => {
      if (!o.delivered_at) return false
      const d = new Date(o.delivered_at)
      return d.getMonth() === thisMonth && d.getFullYear() === thisYear
    }).reduce((s, o) => s + Number(o.delivery_charge || 0), 0)

    const ratedOrders = myPast.filter((o) => o.delivery_rating != null)
    const avgRating = ratedOrders.length
      ? (ratedOrders.reduce((s, o) => s + (o.delivery_rating ?? 0), 0) / ratedOrders.length).toFixed(1)
      : '—'

    const cashCollected = myPast.filter((o) => o.payment_method === 'cod' && o.payment_status === 'paid').reduce((s, o) => s + Number(o.total), 0)
    const onlineOrdersTotal = myPast.filter((o) => o.payment_method === 'online' && o.payment_status === 'paid').reduce((s, o) => s + Number(o.total), 0)
    const cashPendingDeposit = myPast.filter((o) => o.payment_method === 'cod' && o.payment_status === 'paid' && !o.is_cash_deposited).reduce((s, o) => s + Number(o.total), 0)

    return { totalDeliveries: myPast.length, avgRating, todaysEarnings, monthlyEarnings, cashCollected, onlineOrdersTotal, cashPendingDeposit }
  }, [myPast])

  const optimizedRoute = useMemo(() => {
    if (!riderLocation || myOngoing.length < 2) return null
    const withCoords = myOngoing.filter((o) => o.delivery_lat && o.delivery_lng)
    if (withCoords.length < 2) return null

    const remaining = [...withCoords]
    const sequence: { order: Order; distance: number }[] = []
    let current = riderLocation
    let naiveTotal = 0
    withCoords.forEach((o) => { naiveTotal += distanceKm(riderLocation.lat, riderLocation.lng, o.delivery_lat!, o.delivery_lng!) })

    while (remaining.length > 0) {
      let nearestIdx = 0
      let nearestDist = Infinity
      remaining.forEach((o, i) => {
        const d = distanceKm(current.lat, current.lng, o.delivery_lat!, o.delivery_lng!)
        if (d < nearestDist) { nearestDist = d; nearestIdx = i }
      })
      const chosen = remaining.splice(nearestIdx, 1)[0]
      sequence.push({ order: chosen, distance: nearestDist })
      current = { lat: chosen.delivery_lat!, lng: chosen.delivery_lng! }
    }

    const optimizedTotal = sequence.reduce((s, x) => s + x.distance, 0)
    return { sequence, optimizedTotal, naiveTotal, savedKm: Math.max(0, naiveTotal - optimizedTotal) }
  }, [riderLocation, myOngoing])

  async function claimOrder(orderId: string) {
    await supabase.from('orders').update({ status: 'out_for_delivery', assigned_delivery_id: profile?.id, delivery_stage: 'assigned' }).eq('id', orderId)
    supabase.functions.invoke('send-order-email', { body: { orderId } }).catch(() => {})
  }

  async function advanceStage(order: Order) {
    const flow = STAGE_FLOW[order.delivery_stage ?? 'assigned']
    if (!flow) return

    const updates: Record<string, any> = { delivery_stage: flow.next }
    if (flow.next === 'delivered') {
      updates.status = 'delivered'
      updates.delivered_at = new Date().toISOString()
      if (order.payment_method === 'cod') updates.payment_status = 'paid'
    }
    await supabase.from('orders').update(updates).eq('id', order.id)
    supabase.functions.invoke('send-order-email', { body: { orderId: order.id } }).catch(() => {})
  }

  async function sendCustomerEmailNotification(orderId: string) {
    setEmailStatus((prev) => ({ ...prev, [orderId]: 'Sending...' }))
    try {
      await supabase.functions.invoke('send-order-email', { body: { orderId } })
      setEmailStatus((prev) => ({ ...prev, [orderId]: 'Status Email Sent!' }))
      setTimeout(() => {
        setEmailStatus((prev) => {
          const copy = { ...prev }
          delete copy[orderId]
          return copy
        })
      }, 3000)
    } catch {
      setEmailStatus((prev) => ({ ...prev, [orderId]: 'Failed to send' }))
    }
  }

  async function markCashDeposited() {
    const idsToUpdate = myPast.filter((o) => o.payment_method === 'cod' && o.payment_status === 'paid' && !o.is_cash_deposited).map((o) => o.id)
    if (idsToUpdate.length === 0) return
    await supabase.from('orders').update({ is_cash_deposited: true }).in('id', idsToUpdate)
    load()
  }

  async function saveVehicleDetails() {
    setSavingVehicle(true)
    await supabase.from('profiles').update({
      vehicle_type: vehicleType,
      vehicle_number: vehicleNumber,
      vehicle_insurance_expiry: insuranceExpiry || null,
    }).eq('id', profile?.id)
    setSavingVehicle(false)
  }

  const insuranceDaysLeft = insuranceExpiry
    ? Math.ceil((new Date(insuranceExpiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null

  if (loading) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-saffron-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const TABS: { key: Tab; label: string; count: number }[] = [
    { key: 'ready', label: 'Ready for Pickup', count: readyOrders.length },
    { key: 'ongoing', label: 'Ongoing', count: myOngoing.length },
    { key: 'past', label: 'Past Deliveries', count: myPast.length },
  ]
  const activeList = tab === 'ready' ? readyOrders : tab === 'ongoing' ? myOngoing : myPast

  return (
    <AnimatedPage className="min-h-screen bg-cream">
      <div className="bg-sage-800 text-white px-6 py-4 flex justify-between items-center shadow-md">
        <div className="flex items-center gap-3 font-display font-bold text-lg">
          {settings.logo_url ? (
            <img src={settings.logo_url} className="w-8 h-8 rounded-lg object-cover" />
          ) : (
            <div className="w-8 h-8 rounded-lg bg-saffron-500 flex items-center justify-center">
              <Bike size={18} />
            </div>
          )}
          <span>{settings.cafe_name ?? 'Saffron & Sage'} <span className="text-saffron-400 font-normal">| Delivery Portal</span></span>
        </div>
        <button onClick={signOut} className="flex items-center gap-1.5 text-sm text-sage-200 hover:text-white px-3 py-1.5 rounded-lg hover:bg-white/10 transition-colors">
          <LogOut size={16} /> Logout
        </button>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-6 space-y-6">
        {/* Stats bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="card p-4">
            <Package size={18} className="text-saffron-500 mb-1" />
            <div className="text-xs text-sage-500">Total Deliveries</div>
            <div className="font-bold text-2xl text-sage-800">
              <AnimatedCounter value={stats.totalDeliveries} />
            </div>
          </div>
          <div className="card p-4">
            <Star size={18} className="text-saffron-500 mb-1" />
            <div className="text-xs text-sage-500">Your Rating</div>
            <div className="font-bold text-2xl text-sage-800">{stats.avgRating} / 5</div>
          </div>
          <div className="card p-4">
            <TrendingUp size={18} className="text-saffron-500 mb-1" />
            <div className="text-xs text-sage-500">Today's Earnings</div>
            <div className="font-bold text-2xl text-sage-800">
              <AnimatedCounter value={stats.todaysEarnings} prefix="₹" />
            </div>
          </div>
          <div className="card p-4">
            <Wallet size={18} className="text-saffron-500 mb-1" />
            <div className="text-xs text-sage-500">This Month</div>
            <div className="font-bold text-2xl text-sage-800">
              <AnimatedCounter value={stats.monthlyEarnings} prefix="₹" />
            </div>
          </div>
        </div>

        {/* Cash tracking */}
        <div className="card p-5">
          <div className="grid grid-cols-3 gap-4 text-center mb-3">
            <div>
              <div className="text-xs text-sage-500">Cash Collected</div>
              <div className="font-bold text-lg text-sage-800">₹{stats.cashCollected.toFixed(0)}</div>
            </div>
            <div>
              <div className="text-xs text-sage-500">Online Orders</div>
              <div className="font-bold text-lg text-sage-800">₹{stats.onlineOrdersTotal.toFixed(0)}</div>
            </div>
            <div>
              <div className="text-xs text-sage-500">Cash Pending Deposit</div>
              <div className={`font-bold text-lg ${stats.cashPendingDeposit > 0 ? 'text-red-500' : 'text-green-600'}`}>
                ₹{stats.cashPendingDeposit.toFixed(0)}
              </div>
            </div>
          </div>
          {stats.cashPendingDeposit > 0 && (
            <button onClick={markCashDeposited} className="btn-secondary text-sm w-full">
              Mark All Cash as Deposited to Cafe
            </button>
          )}
        </div>

        {/* Vehicle details */}
        <div className="card p-5">
          <h3 className="font-bold text-sage-800 flex items-center gap-2 mb-3">
            <Truck size={18} className="text-saffron-500" /> Vehicle & Compliance
          </h3>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <input
              value={vehicleType}
              onChange={(e) => setVehicleType(e.target.value)}
              placeholder="e.g. Electric Scooter / Motorcycle"
              className="px-3.5 py-2.5 rounded-xl border border-sage-200/80 text-sm focus:ring-2 focus:ring-saffron-400 focus:outline-none"
            />
            <input
              value={vehicleNumber}
              onChange={(e) => setVehicleNumber(e.target.value)}
              placeholder="e.g. RJ14 AB 1234"
              className="px-3.5 py-2.5 rounded-xl border border-sage-200/80 text-sm focus:ring-2 focus:ring-saffron-400 focus:outline-none uppercase"
            />
          </div>
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <label className="text-xs text-sage-500 flex items-center gap-1 mb-1">
                <Shield size={13} /> Insurance Expiry Date
              </label>
              <input
                type="date"
                value={insuranceExpiry}
                onChange={(e) => setInsuranceExpiry(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-sage-200/80 text-sm focus:ring-2 focus:ring-saffron-400 focus:outline-none"
              />
            </div>
            <button
              onClick={saveVehicleDetails}
              disabled={savingVehicle}
              className="btn-secondary text-sm mt-5"
            >
              {savingVehicle ? 'Saving...' : 'Save Vehicle'}
            </button>
          </div>
          {insuranceDaysLeft != null && (
            <p className={`text-xs mt-2 ${insuranceDaysLeft < 45 ? 'text-red-500 font-medium' : 'text-sage-400'}`}>
              {insuranceDaysLeft > 0 ? `Expires in ${insuranceDaysLeft} days` : 'Expired — please renew'}
              {insuranceDaysLeft < 45 && insuranceDaysLeft > 0 && ' — reminder: renew soon!'}
            </p>
          )}
        </div>

        {/* AI Route Optimization */}
        {tab === 'ongoing' && optimizedRoute && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-sage-800 text-white rounded-2xl p-5 shadow-lg"
          >
            <h3 className="font-bold flex items-center gap-2 mb-2 text-saffron-300">
              <Route size={18} /> AI Route Optimization
            </h3>
            <p className="text-xs text-sage-300 mb-3 leading-relaxed">
              Optimal sequential dispatch order from your current location — saves ~{optimizedRoute.savedKm.toFixed(1)} km.
            </p>
            <ol className="space-y-2 text-sm">
              {optimizedRoute.sequence.map((s, i) => (
                <li key={s.order.id} className="flex justify-between items-center bg-white/10 backdrop-blur rounded-xl px-4 py-2.5">
                  <span className="font-medium">{i + 1}. Order #{s.order.id.slice(0, 8)}</span>
                  <span className="text-saffron-300 font-bold">{s.distance.toFixed(1)} km away</span>
                </li>
              ))}
            </ol>
          </motion.div>
        )}

        {/* Tabs */}
        <div className="flex gap-2">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                tab === t.key
                  ? 'bg-saffron-500 text-white shadow-md'
                  : 'bg-white border border-sage-100 text-sage-600 hover:bg-sage-50'
              }`}
            >
              {t.label} ({t.count})
            </button>
          ))}
        </div>

        {activeList.length === 0 ? (
          <div className="card p-12 text-center text-sage-400">
            <Bike size={36} className="mx-auto mb-2 opacity-40 animate-float" />
            <p>No orders in this section right now.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <AnimatePresence>
              {activeList.map((order) => {
                const dist = riderLocation && order.delivery_lat && order.delivery_lng
                  ? distanceKm(riderLocation.lat, riderLocation.lng, order.delivery_lat, order.delivery_lng)
                  : null
                const etaMin = dist != null ? Math.round((dist / 20) * 60) : null
                const stage = order.delivery_stage ?? 'assigned'
                const flow = STAGE_FLOW[stage]

                return (
                  <motion.div
                    key={order.id}
                    layout
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className={`card p-5 ${tab === 'ongoing' ? 'border-2 border-saffron-400 shadow-lg' : ''}`}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <div className="font-bold text-sage-800 text-lg">Order #{order.id.slice(0, 8)}</div>
                        {order.customer_name && (
                          <div className="text-sm font-medium text-sage-600">{order.customer_name}</div>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-lg text-saffron-600">₹{order.total.toFixed(2)}</div>
                        <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${
                          order.payment_method === 'cod' ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'
                        }`}>
                          {order.payment_method === 'cod' ? 'Cash on Delivery' : 'Paid Online'}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-3 mb-3 pt-1">
                      {order.customer_phone && (
                        <a
                          href={`tel:${order.customer_phone}`}
                          className="flex items-center gap-1.5 text-xs bg-sage-50 hover:bg-sage-100 text-sage-700 px-3 py-1.5 rounded-lg font-medium transition-colors"
                        >
                          <Phone size={13} className="text-saffron-500" /> Call {order.customer_phone}
                        </a>
                      )}
                      {order.customer_email && (
                        <button
                          onClick={() => sendCustomerEmailNotification(order.id)}
                          className="flex items-center gap-1.5 text-xs bg-sage-50 hover:bg-sage-100 text-sage-700 px-3 py-1.5 rounded-lg font-medium transition-colors"
                        >
                          <Mail size={13} className="text-saffron-500" />
                          {emailStatus[order.id] ?? 'Send Email Update'}
                        </button>
                      )}
                    </div>

                    <ul className="text-sm text-sage-600 bg-sage-50/70 rounded-xl p-3 mb-3 space-y-1">
                      {order.items?.map((it) => (
                        <li key={it.id} className="flex justify-between">
                          <span>{it.quantity}× {it.menu_item?.name ?? 'Item'}</span>
                          <span className="text-sage-400">₹{(it.unit_price * it.quantity).toFixed(2)}</span>
                        </li>
                      ))}
                    </ul>

                    {order.delivery_address && (
                      <div className="flex items-start gap-1.5 text-xs text-sage-600 mb-2">
                        <MapPin size={14} className="text-saffron-500 shrink-0 mt-0.5" />
                        <span>{order.delivery_address}</span>
                      </div>
                    )}

                    {(dist != null || etaMin != null) && (
                      <div className="flex gap-4 text-xs font-medium text-sage-500 mb-3">
                        {dist != null && <span>Distance: {dist.toFixed(1)} km</span>}
                        {etaMin != null && <span>Est. Arrival: {etaMin} mins</span>}
                      </div>
                    )}

                    {order.delivery_lat && order.delivery_lng && tab === 'ongoing' && (
                      <a
                        href={`https://www.google.com/maps/dir/?api=1&destination=${order.delivery_lat},${order.delivery_lng}&travelmode=driving`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-center gap-2 text-sm bg-sage-700 text-white py-2.5 rounded-xl font-medium mb-3 hover:bg-sage-800 shadow-sm transition-colors"
                      >
                        <Navigation size={15} /> Open Navigation in Google Maps
                      </a>
                    )}

                    {order.delivery_charge > 0 && (
                      <div className="text-xs text-sage-500 mb-3">
                        Rider Earning: <strong className="text-sage-700">₹{order.delivery_charge}</strong>
                      </div>
                    )}

                    {tab === 'ready' && (
                      <button
                        onClick={() => claimOrder(order.id)}
                        className="btn-primary w-full text-sm py-2.5"
                      >
                        Accept & Start Delivery
                      </button>
                    )}

                    {tab === 'ongoing' && (
                      <div className="space-y-3">
                        <div className="flex items-center gap-1">
                          {['assigned', 'picked_up', 'on_the_way', 'reached', 'delivered'].map((s, i) => (
                            <div key={s} className="flex items-center flex-1">
                              {i > 0 && (
                                <div className={`h-1 flex-1 rounded-full ${
                                  ['picked_up', 'on_the_way', 'reached', 'delivered'].indexOf(stage) + 1 >= i
                                    ? 'bg-saffron-500'
                                    : 'bg-sage-100'
                                }`} />
                              )}
                              <Circle
                                size={12}
                                className={
                                  s === stage || ['picked_up', 'on_the_way', 'reached', 'delivered'].indexOf(stage) + 1 > i
                                    ? 'fill-saffron-500 text-saffron-500'
                                    : 'text-sage-200'
                                }
                              />
                            </div>
                          ))}
                        </div>
                        {flow && (
                          <button
                            onClick={() => advanceStage(order)}
                            className="btn-primary w-full text-sm py-2.5 flex items-center justify-center gap-2"
                          >
                            <CheckCircle2 size={16} />
                            {order.payment_method === 'cod' && flow.next === 'delivered'
                              ? `Collect ₹${order.total.toFixed(0)} Cash & Mark Delivered`
                              : `Mark: ${flow.label}`}
                          </button>
                        )}
                      </div>
                    )}

                    {tab === 'past' && order.delivery_rating && (
                      <div className="flex items-center gap-1.5 text-sm text-sage-600 bg-sage-50 p-2.5 rounded-xl">
                        <span className="text-xs text-sage-400">Customer Rating:</span>
                        <div className="flex">
                          {[...Array(5)].map((_, i) => (
                            <Star
                              key={i}
                              size={14}
                              className={i < order.delivery_rating! ? 'fill-saffron-500 text-saffron-500' : 'text-sage-200'}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </div>
        )}
      </div>
    </AnimatedPage>
  )
}
