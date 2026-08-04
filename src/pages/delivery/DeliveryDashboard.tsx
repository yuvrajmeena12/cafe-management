import { useEffect, useMemo, useState } from 'react'
import {
  Package, MapPin, CheckCircle2, LogOut, Bike, Phone, MessageCircle, Star, TrendingUp,
  Wallet, Navigation, Route, Truck, Shield, Circle,
} from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'
import { useCafeSettings } from '../../context/CafeSettingsContext'
import { distanceKm } from '../../lib/distance'
import type { Order } from '../../types'

type Tab = 'ready' | 'ongoing' | 'past'

const STAGE_FLOW: Record<string, { next: string; label: string } | null> = {
  assigned: { next: 'picked_up', label: 'Order Picked' },
  picked_up: { next: 'on_the_way', label: 'On the Way' },
  on_the_way: { next: 'reached', label: 'Reached Location' },
  reached: { next: 'delivered', label: 'Delivered' },
  delivered: null,
}

function whatsappLink(phone: string, message: string) {
  let digits = phone.replace(/[^\d]/g, '')
  if (digits.length === 10) digits = `91${digits}`
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`
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

  // AI Route Optimization — simple nearest-neighbor ordering from the
  // rider's current location. Deterministic and explainable: it always
  // just picks the closest remaining stop, not a black-box routing engine.
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
    if (flow.next === 'delivered') {
      supabase.functions.invoke('send-order-email', { body: { orderId: order.id } }).catch(() => {})
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

  if (loading) return <div className="p-10 text-center text-sage-500">Loading...</div>

  const TABS: { key: Tab; label: string; count: number }[] = [
    { key: 'ready', label: 'Ready for Pickup', count: readyOrders.length },
    { key: 'ongoing', label: 'Ongoing', count: myOngoing.length },
    { key: 'past', label: 'Past Deliveries', count: myPast.length },
  ]
  const activeList = tab === 'ready' ? readyOrders : tab === 'ongoing' ? myOngoing : myPast

  return (
    <div className="min-h-screen bg-cream">
      <div className="bg-sage-700 text-white px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-2 font-display font-bold text-lg">
          {settings.logo_url ? (
            <img src={settings.logo_url} className="w-7 h-7 rounded-md object-cover" />
          ) : (
            <Bike size={22} />
          )}
          {settings.cafe_name ?? 'Saffron & Sage'} — Delivery
        </div>
        <button onClick={signOut} className="flex items-center gap-1.5 text-sm text-sage-100 hover:text-white">
          <LogOut size={16} /> Logout
        </button>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-6">
        {/* Stats bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <div className="card p-4"><Package size={16} className="text-saffron-500 mb-1" /><div className="text-xs text-sage-500">Total Deliveries</div><div className="font-bold text-xl text-sage-700">{stats.totalDeliveries}</div></div>
          <div className="card p-4"><Star size={16} className="text-saffron-500 mb-1" /><div className="text-xs text-sage-500">Your Rating</div><div className="font-bold text-xl text-sage-700">{stats.avgRating} / 5</div></div>
          <div className="card p-4"><TrendingUp size={16} className="text-saffron-500 mb-1" /><div className="text-xs text-sage-500">Today's Earnings</div><div className="font-bold text-xl text-sage-700">₹{stats.todaysEarnings.toFixed(0)}</div></div>
          <div className="card p-4"><Wallet size={16} className="text-saffron-500 mb-1" /><div className="text-xs text-sage-500">This Month</div><div className="font-bold text-xl text-sage-700">₹{stats.monthlyEarnings.toFixed(0)}</div></div>
        </div>

        {/* Cash tracking */}
        <div className="card p-4 mb-6">
          <div className="grid grid-cols-3 gap-4 text-center mb-3">
            <div><div className="text-xs text-sage-500">Cash Collected</div><div className="font-bold text-sage-700">₹{stats.cashCollected.toFixed(0)}</div></div>
            <div><div className="text-xs text-sage-500">Online Orders</div><div className="font-bold text-sage-700">₹{stats.onlineOrdersTotal.toFixed(0)}</div></div>
            <div><div className="text-xs text-sage-500">Cash Pending Deposit</div><div className={`font-bold ${stats.cashPendingDeposit > 0 ? 'text-red-500' : 'text-green-600'}`}>₹{stats.cashPendingDeposit.toFixed(0)}</div></div>
          </div>
          {stats.cashPendingDeposit > 0 && (
            <button onClick={markCashDeposited} className="btn-secondary text-sm w-full">Mark All Cash as Deposited to Cafe</button>
          )}
        </div>

        {/* Vehicle details */}
        <div className="card p-4 mb-6">
          <h3 className="font-bold text-sage-700 flex items-center gap-2 mb-3"><Truck size={16} className="text-saffron-500" /> My Vehicle</h3>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <input value={vehicleType} onChange={(e) => setVehicleType(e.target.value)} placeholder="e.g. Bike" className="px-3 py-2 rounded-lg border border-sage-100 text-sm" />
            <input value={vehicleNumber} onChange={(e) => setVehicleNumber(e.target.value)} placeholder="e.g. RJ14 AB 1234" className="px-3 py-2 rounded-lg border border-sage-100 text-sm" />
          </div>
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <label className="text-xs text-sage-500 flex items-center gap-1 mb-1"><Shield size={12} /> Insurance Expiry</label>
              <input type="date" value={insuranceExpiry} onChange={(e) => setInsuranceExpiry(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-sage-100 text-sm" />
            </div>
            <button onClick={saveVehicleDetails} disabled={savingVehicle} className="btn-secondary text-sm mt-5">Save</button>
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
          <div className="bg-sage-700 text-white rounded-xl p-4 mb-6">
            <h3 className="font-bold flex items-center gap-2 mb-2"><Route size={16} /> AI Route Optimization</h3>
            <p className="text-xs text-sage-300 mb-3">
              Suggested delivery order from your current location — saves ~{optimizedRoute.savedKm.toFixed(1)} km vs delivering in list order.
            </p>
            <ol className="space-y-1.5 text-sm">
              {optimizedRoute.sequence.map((s, i) => (
                <li key={s.order.id} className="flex justify-between bg-sage-600/50 rounded-lg px-3 py-1.5">
                  <span>{i + 1}. Order #{s.order.id.slice(0, 8)}</span>
                  <span className="text-sage-300">{s.distance.toFixed(1)} km</span>
                </li>
              ))}
            </ol>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-5">
          {TABS.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)} className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === t.key ? 'bg-saffron-500 text-white' : 'bg-white border border-sage-100 text-sage-600'}`}>
              {t.label} ({t.count})
            </button>
          ))}
        </div>

        {activeList.length === 0 ? (
          <p className="text-sage-400 text-sm text-center py-10">Nothing here right now.</p>
        ) : (
          <div className="space-y-3">
            {activeList.map((order) => {
              const dist = riderLocation && order.delivery_lat && order.delivery_lng
                ? distanceKm(riderLocation.lat, riderLocation.lng, order.delivery_lat, order.delivery_lng)
                : null
              const etaMin = dist != null ? Math.round((dist / 20) * 60) : null // assumes ~20km/h average
              const stage = order.delivery_stage ?? 'assigned'
              const flow = STAGE_FLOW[stage]

              return (
                <div key={order.id} className={`card p-4 ${tab === 'ongoing' ? 'border-2 border-saffron-200' : ''}`}>
                  <div className="flex justify-between items-start mb-2">
                    <div className="font-semibold text-sage-700">Order #{order.id.slice(0, 8)}</div>
                    <div className="text-right">
                      <div className="font-bold text-saffron-600">₹{order.total.toFixed(2)}</div>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${order.payment_method === 'cod' ? 'bg-amber-50 text-amber-700' : 'bg-green-50 text-green-600'}`}>
                        {order.payment_method === 'cod' ? 'Cash on Delivery' : 'Paid Online'}
                      </span>
                    </div>
                  </div>

                  {order.customer_name && <div className="text-sm text-sage-700 font-medium mb-1">{order.customer_name}</div>}

                  {order.customer_phone && (
                    <div className="flex gap-3 mb-2">
                      <a href={`tel:${order.customer_phone}`} className="flex items-center gap-1 text-sm text-saffron-600 hover:underline">
                        <Phone size={13} /> Call
                      </a>
                      <a href={whatsappLink(order.customer_phone, `Hi ${order.customer_name ?? ''}, this is your delivery rider for order #${order.id.slice(0, 8)}.`)} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-sm text-green-600 hover:underline">
                        <MessageCircle size={13} /> WhatsApp
                      </a>
                    </div>
                  )}

                  <ul className="text-sm text-sage-600 mb-2">
                    {order.items?.map((it) => <li key={it.id}>{it.quantity}× {it.menu_item?.name ?? 'Item'}</li>)}
                  </ul>

                  {order.delivery_address && (
                    <div className="flex items-center gap-1 text-xs text-sage-500 mb-1">
                      <MapPin size={12} /> {order.delivery_address}
                    </div>
                  )}

                  {(dist != null || etaMin != null) && (
                    <div className="flex gap-4 text-xs text-sage-400 mb-3">
                      {dist != null && <span>Distance: {dist.toFixed(1)} km</span>}
                      {etaMin != null && <span>Est. Time: {etaMin} min</span>}
                    </div>
                  )}

                  {order.delivery_lat && order.delivery_lng && tab === 'ongoing' && (
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${order.delivery_lat},${order.delivery_lng}&travelmode=driving`}
                      target="_blank" rel="noreferrer"
                      className="flex items-center justify-center gap-1.5 text-sm bg-sage-50 text-sage-700 py-2 rounded-lg font-medium mb-2 hover:bg-sage-100"
                    >
                      <Navigation size={14} /> Start Navigation
                    </a>
                  )}

                  {order.delivery_charge > 0 && (
                    <div className="text-xs text-sage-400 mb-2">Your earning for this delivery: ₹{order.delivery_charge}</div>
                  )}

                  {tab === 'ready' && (
                    <button onClick={() => claimOrder(order.id)} className="btn-primary w-full text-sm">Accept & Start Delivery</button>
                  )}

                  {tab === 'ongoing' && (
                    <div>
                      <div className="flex items-center gap-1 mb-2">
                        {['assigned', 'picked_up', 'on_the_way', 'reached', 'delivered'].map((s, i) => (
                          <div key={s} className="flex items-center flex-1">
                            {i > 0 && <div className={`h-0.5 flex-1 ${['picked_up','on_the_way','reached','delivered'].indexOf(stage) + 1 >= i ? 'bg-saffron-500' : 'bg-sage-100'}`} />}
                            <Circle size={10} className={s === stage || ['picked_up','on_the_way','reached','delivered'].indexOf(stage) + 1 > i ? 'fill-saffron-500 text-saffron-500' : 'text-sage-200'} />
                          </div>
                        ))}
                      </div>
                      {flow && (
                        <button onClick={() => advanceStage(order)} className="btn-primary w-full text-sm flex items-center justify-center gap-1.5">
                          <CheckCircle2 size={16} /> {order.payment_method === 'cod' && flow.next === 'delivered' ? `Collect ₹${order.total.toFixed(0)} Cash & Mark ${flow.label}` : `Mark: ${flow.label}`}
                        </button>
                      )}
                    </div>
                  )}

                  {tab === 'past' && order.delivery_rating && (
                    <div className="flex items-center gap-1 text-sm text-sage-500">
                      Customer rated you: {[...Array(5)].map((_, i) => (
                        <Star key={i} size={14} className={i < order.delivery_rating! ? 'fill-saffron-500 text-saffron-500' : 'text-sage-200'} />
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
