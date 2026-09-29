import { useEffect, useState, useMemo } from 'react'
import {
  ChefHat, Package, AlertTriangle, CheckCircle2, Clock, Flame,
  LogOut, Plus, Minus, Search, ArrowRight, Utensils, Sparkles, RefreshCw, Send, Check
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'
import { useCafeSettings } from '../../context/CafeSettingsContext'
import AnimatedPage from '../../components/AnimatedPage'
import AnimatedCounter from '../../components/AnimatedCounter'
import type { Order, InventoryItem, OrderStatus } from '../../types'

type ActiveTab = 'orders' | 'inventory'

export default function StaffDashboard() {
  const { profile, signOut } = useAuth()
  const { settings } = useCafeSettings()

  const [tab, setTab] = useState<ActiveTab>('orders')
  const [orders, setOrders] = useState<Order[]>([])
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)

  // Order filters
  const [orderFilter, setOrderFilter] = useState<'all' | 'received' | 'preparing' | 'ready'>('all')

  // Inventory usage logger state
  const [selectedItem, setSelectedItem] = useState<string>('')
  const [usedQuantity, setUsedQuantity] = useState<string>('1')
  const [usageNote, setUsageNote] = useState<string>('')
  const [inventorySearch, setInventorySearch] = useState<string>('')
  const [loggingStock, setLoggingStock] = useState(false)
  const [stockSuccessMsg, setStockSuccessMsg] = useState<string | null>(null)

  // Staff shift attendance
  const [checkedIn, setCheckedIn] = useState(false)
  const [shiftStart, setShiftStart] = useState<Date | null>(null)

  async function loadData() {
    try {
      const [{ data: orderData }, { data: invData }] = await Promise.all([
        supabase
          .from('orders')
          .select('*, items:order_items(*, menu_item:menu_items(*))')
          .in('status', ['received', 'preparing', 'ready', 'out_for_delivery'])
          .order('placed_at', { ascending: false }),
        supabase
          .from('inventory_items')
          .select('*')
          .order('name'),
      ])

      setOrders((orderData as Order[]) ?? [])
      setInventory((invData as InventoryItem[]) ?? [])
    } catch (err) {
      console.error('Error loading staff dashboard data:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()

    // Real-time live subscriptions for both incoming orders and inventory changes
    const orderChannel = supabase
      .channel('staff-orders-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        loadData()
      })
      .subscribe()

    const invChannel = supabase
      .channel('staff-inventory-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory_items' }, () => {
        loadData()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(orderChannel)
      supabase.removeChannel(invChannel)
    }
  }, [])

  // Update order status in kitchen
  async function updateOrderStatus(orderId: string, nextStatus: OrderStatus) {
    try {
      await supabase.from('orders').update({ status: nextStatus }).eq('id', orderId)
      // Send customer notification email automatically
      supabase.functions.invoke('send-order-email', { body: { orderId } }).catch(() => {})
      loadData()
    } catch (err) {
      console.error('Failed to update order status:', err)
    }
  }

  // Deduct inventory usage
  async function handleLogInventoryUsage(e?: React.FormEvent) {
    if (e) e.preventDefault()
    if (!selectedItem) return
    const qty = parseFloat(usedQuantity)
    if (isNaN(qty) || qty <= 0) return

    setLoggingStock(true)
    const item = inventory.find((i) => i.id === selectedItem)
    if (!item) { setLoggingStock(false); return }

    const newQty = Math.max(0, Number(item.quantity) - qty)

    try {
      const { error } = await supabase
        .from('inventory_items')
        .update({ quantity: newQty, updated_at: new Date().toISOString() })
        .eq('id', item.id)

      if (!error) {
        setStockSuccessMsg(`Deducted ${qty} ${item.unit} of ${item.name}! Remaining: ${newQty} ${item.unit}`)
        setUsedQuantity('1')
        setUsageNote('')
        loadData()
        setTimeout(() => setStockSuccessMsg(null), 4000)
      }
    } catch (err) {
      console.error('Failed to log inventory:', err)
    } finally {
      setLoggingStock(false)
    }
  }

  // Quick adjust stock
  async function quickAdjustStock(id: string, delta: number) {
    const item = inventory.find((i) => i.id === id)
    if (!item) return
    const newQty = Math.max(0, Number(item.quantity) + delta)
    await supabase.from('inventory_items').update({ quantity: newQty }).eq('id', id)
    loadData()
  }

  function toggleShift() {
    if (!checkedIn) {
      setCheckedIn(true)
      setShiftStart(new Date())
    } else {
      setCheckedIn(false)
      setShiftStart(null)
    }
  }

  // Filtered orders & inventory
  const activeOrders = useMemo(() => {
    if (orderFilter === 'all') return orders
    return orders.filter((o) => o.status === orderFilter)
  }, [orders, orderFilter])

  const lowStockItems = useMemo(() => {
    return inventory.filter((i) => Number(i.quantity) <= Number(i.min_level))
  }, [inventory])

  const filteredInventory = useMemo(() => {
    if (!inventorySearch.trim()) return inventory
    return inventory.filter((i) => i.name.toLowerCase().includes(inventorySearch.toLowerCase()))
  }, [inventory, inventorySearch])

  const selectedInventoryObj = inventory.find((i) => i.id === selectedItem)

  if (loading) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-saffron-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <AnimatedPage className="min-h-screen bg-cream pb-16">
      {/* Top Staff App Bar */}
      <header className="bg-sage-900 text-white px-6 py-4 flex flex-wrap justify-between items-center shadow-md sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-saffron-500 to-saffron-600 flex items-center justify-center text-white text-xl shadow-md">
            👨‍🍳
          </div>
          <div>
            <div className="font-display font-bold text-lg leading-tight flex items-center gap-2">
              {settings.cafe_name ?? 'Saffron & Sage'}
              <span className="text-xs bg-saffron-500/20 text-saffron-400 font-sans font-semibold px-2 py-0.5 rounded-full border border-saffron-400/30">
                Staff Kitchen Portal
              </span>
            </div>
            <div className="text-xs text-sage-300">
              Welcome, <strong className="text-white">{profile?.full_name || 'Team Member'}</strong>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 mt-2 sm:mt-0">
          {/* Shift Check-In Button */}
          <button
            onClick={toggleShift}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm ${
              checkedIn
                ? 'bg-green-600 text-white'
                : 'bg-white/10 hover:bg-white/20 text-sage-200'
            }`}
          >
            <Clock size={14} />
            {checkedIn ? 'On Shift (Active)' : 'Clock In for Shift'}
          </button>

          <button
            onClick={signOut}
            className="flex items-center gap-1.5 text-xs text-sage-300 hover:text-white px-3 py-1.5 rounded-xl hover:bg-white/10 transition-colors"
          >
            <LogOut size={14} /> Logout
          </button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-6 space-y-6">
        {/* Critical Low Stock Warning Banner */}
        <AnimatePresence>
          {lowStockItems.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-red-500 text-white p-4 sm:p-5 rounded-2xl shadow-lg border border-red-400 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
            >
              <div className="flex items-start gap-3">
                <div className="p-2 bg-white/20 rounded-xl shrink-0 mt-0.5">
                  <AlertTriangle size={24} className="text-white animate-bounce" />
                </div>
                <div>
                  <h3 className="font-bold text-base flex items-center gap-2">
                    CRITICAL LOW STOCK ALERT ({lowStockItems.length} items below minimum level)
                  </h3>
                  <p className="text-xs text-red-100 mt-0.5">
                    The following ingredients require immediate kitchen restocking:
                  </p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {lowStockItems.map((item) => (
                      <span
                        key={item.id}
                        className="bg-white/20 text-white font-mono text-xs px-2.5 py-1 rounded-lg font-bold border border-white/30"
                      >
                        {item.name}: {item.quantity} {item.unit} (Min: {item.min_level} {item.unit})
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <button
                onClick={() => setTab('inventory')}
                className="bg-white text-red-600 hover:bg-red-50 text-xs font-bold px-4 py-2.5 rounded-xl shrink-0 shadow-sm transition-all"
              >
                Open Inventory Stock →
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Top Key Metrics Overview */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="card p-4">
            <div className="flex justify-between items-center text-sage-500 text-xs mb-1">
              <span>Kitchen Queue</span>
              <ChefHat size={16} className="text-saffron-500" />
            </div>
            <div className="text-2xl font-bold text-sage-800">
              <AnimatedCounter value={orders.filter((o) => o.status === 'received' || o.status === 'preparing').length} />
            </div>
            <span className="text-[11px] text-sage-400">Needs cooking</span>
          </div>

          <div className="card p-4">
            <div className="flex justify-between items-center text-sage-500 text-xs mb-1">
              <span>Ready for Dispatch</span>
              <CheckCircle2 size={16} className="text-green-500" />
            </div>
            <div className="text-2xl font-bold text-green-700">
              <AnimatedCounter value={orders.filter((o) => o.status === 'ready').length} />
            </div>
            <span className="text-[11px] text-green-600 font-medium">Ready at counter</span>
          </div>

          <div className="card p-4">
            <div className="flex justify-between items-center text-sage-500 text-xs mb-1">
              <span>Total Inventory Items</span>
              <Package size={16} className="text-saffron-500" />
            </div>
            <div className="text-2xl font-bold text-sage-800">
              <AnimatedCounter value={inventory.length} />
            </div>
            <span className="text-[11px] text-sage-400">Tracked supplies</span>
          </div>

          <div className="card p-4">
            <div className="flex justify-between items-center text-sage-500 text-xs mb-1">
              <span>Low Stock Warnings</span>
              <AlertTriangle size={16} className={lowStockItems.length > 0 ? 'text-red-500' : 'text-sage-400'} />
            </div>
            <div className={`text-2xl font-bold ${lowStockItems.length > 0 ? 'text-red-500' : 'text-sage-800'}`}>
              <AnimatedCounter value={lowStockItems.length} />
            </div>
            <span className="text-[11px] text-sage-400">{lowStockItems.length > 0 ? 'Restock urgently' : 'All stocks healthy'}</span>
          </div>
        </div>

        {/* Main Tabs Navigation */}
        <div className="flex border-b border-sage-200 gap-4">
          <button
            onClick={() => setTab('orders')}
            className={`pb-3 font-display font-bold text-base flex items-center gap-2 border-b-2 transition-all ${
              tab === 'orders'
                ? 'border-saffron-500 text-saffron-600'
                : 'border-transparent text-sage-500 hover:text-sage-800'
            }`}
          >
            <ChefHat size={18} /> Live Kitchen Orders ({orders.length})
          </button>
          <button
            onClick={() => setTab('inventory')}
            className={`pb-3 font-display font-bold text-base flex items-center gap-2 border-b-2 transition-all ${
              tab === 'inventory'
                ? 'border-saffron-500 text-saffron-600'
                : 'border-transparent text-sage-500 hover:text-sage-800'
            }`}
          >
            <Package size={18} /> Manage Inventory & Log Stock Used
          </button>
        </div>

        {/* TAB 1: KITCHEN ORDERS BOARD */}
        {tab === 'orders' && (
          <div className="space-y-6">
            {/* Filter Pills */}
            <div className="flex gap-2 flex-wrap items-center justify-between">
              <div className="flex gap-2 flex-wrap">
                {[
                  { key: 'all', label: 'All Orders' },
                  { key: 'received', label: 'Received / New' },
                  { key: 'preparing', label: 'In Preparation' },
                  { key: 'ready', label: 'Ready for Pickup / Rider' },
                ].map((f) => (
                  <button
                    key={f.key}
                    onClick={() => setOrderFilter(f.key as any)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                      orderFilter === f.key
                        ? 'bg-saffron-500 text-white shadow-sm'
                        : 'bg-white border border-sage-200 text-sage-600 hover:bg-sage-50'
                    }`}
                  >
                    {f.label} ({f.key === 'all' ? orders.length : orders.filter((o) => o.status === f.key).length})
                  </button>
                ))}
              </div>

              <button
                onClick={loadData}
                className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5"
              >
                <RefreshCw size={13} /> Refresh
              </button>
            </div>

            {/* Orders Cards Grid */}
            {activeOrders.length === 0 ? (
              <div className="card p-16 text-center text-sage-400 space-y-2">
                <ChefHat size={40} className="mx-auto text-sage-300 opacity-60 animate-float" />
                <h3 className="font-bold text-sage-700 text-lg">No orders in this queue</h3>
                <p className="text-xs">New customer orders will appear here automatically in real time.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <AnimatePresence>
                  {activeOrders.map((order) => {
                    const isReceived = order.status === 'received'
                    const isPreparing = order.status === 'preparing'
                    const isReady = order.status === 'ready'

                    return (
                      <motion.div
                        key={order.id}
                        layout
                        initial={{ opacity: 0, scale: 0.96 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className={`card p-5 space-y-4 border-2 transition-all shadow-md ${
                          isReceived
                            ? 'border-blue-400 bg-gradient-to-br from-white to-blue-50/20'
                            : isPreparing
                            ? 'border-amber-400 bg-gradient-to-br from-white to-amber-50/20'
                            : 'border-green-400 bg-gradient-to-br from-white to-green-50/20'
                        }`}
                      >
                        {/* Card Header */}
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-display font-extrabold text-lg text-sage-800">
                                Order #{order.id.slice(0, 8).toUpperCase()}
                              </span>
                              <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-bold uppercase ${
                                order.order_type === 'delivery'
                                  ? 'bg-saffron-100 text-saffron-800'
                                  : order.order_type === 'dine_in'
                                  ? 'bg-purple-100 text-purple-800'
                                  : 'bg-sage-100 text-sage-800'
                              }`}>
                                {order.order_type.replace('_', ' ')}
                              </span>
                            </div>
                            <div className="text-xs text-sage-500 mt-0.5 flex items-center gap-1.5">
                              <Clock size={12} />
                              Placed {new Date(order.placed_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                              {order.customer_name && <> · <strong>{order.customer_name}</strong></>}
                            </div>
                          </div>

                          <div className={`px-3 py-1 rounded-full text-xs font-extrabold uppercase ${
                            isReceived
                              ? 'bg-blue-100 text-blue-800'
                              : isPreparing
                              ? 'bg-amber-100 text-amber-800 animate-pulse'
                              : 'bg-green-100 text-green-800'
                          }`}>
                            {order.status.replace(/_/g, ' ')}
                          </div>
                        </div>

                        {/* Items List */}
                        <div className="bg-sage-50/80 rounded-xl p-3.5 space-y-2 text-xs">
                          <span className="text-[11px] font-bold text-sage-500 uppercase tracking-wider block">
                            Kitchen Recipe Items:
                          </span>
                          {order.items?.map((it) => (
                            <div key={it.id} className="flex justify-between items-center text-sage-800">
                              <span className="font-semibold text-sm">
                                <span className="text-saffron-600 font-extrabold mr-1.5">{it.quantity}×</span>
                                {it.menu_item?.name ?? 'Dish'}
                              </span>
                              {it.notes && (
                                <span className="text-[11px] text-saffron-700 bg-saffron-50 px-2 py-0.5 rounded-md italic">
                                  Note: {it.notes}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>

                        {/* Customer Delivery Address */}
                        {order.delivery_address && (
                          <div className="text-xs text-sage-600 flex items-start gap-1">
                            <span className="font-semibold text-sage-700">Delivery to:</span>
                            <span className="truncate">{order.delivery_address}</span>
                          </div>
                        )}

                        {/* Kitchen Workflow Actions */}
                        <div className="pt-2 flex gap-2">
                          {isReceived && (
                            <button
                              onClick={() => updateOrderStatus(order.id, 'preparing')}
                              className="btn-primary flex-1 py-3 text-xs font-bold flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700"
                            >
                              <Flame size={16} /> Start Cooking (Preparing)
                            </button>
                          )}

                          {isPreparing && (
                            <button
                              onClick={() => updateOrderStatus(order.id, 'ready')}
                              className="btn-primary flex-1 py-3 text-xs font-bold flex items-center justify-center gap-2 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800"
                            >
                              <CheckCircle2 size={16} /> Mark Ready for Pickup / Dispatch
                            </button>
                          )}

                          {isReady && (
                            <button
                              onClick={() => updateOrderStatus(order.id, 'out_for_delivery')}
                              className="btn-secondary flex-1 py-3 text-xs font-bold flex items-center justify-center gap-2"
                            >
                              <ArrowRight size={16} /> Hand Over to Delivery Rider
                            </button>
                          )}

                          <button
                            onClick={() => {
                              setTab('inventory')
                            }}
                            title="Log inventory ingredients used"
                            className="btn-secondary text-xs px-3 py-3 flex items-center gap-1 shrink-0"
                          >
                            <Package size={15} className="text-saffron-500" /> Log Stock
                          </button>
                        </div>
                      </motion.div>
                    )
                  })}
                </AnimatePresence>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: INVENTORY & STOCK USAGE LOGGER */}
        {tab === 'inventory' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column: Direct Ingredient Consumption Logger Form */}
            <div className="lg:col-span-1 space-y-4">
              <div className="card p-6 space-y-4 border-sage-200/80 shadow-md">
                <div className="flex items-center gap-2 text-saffron-600 font-bold text-xs uppercase tracking-wider">
                  <Flame size={16} /> Recipe Consumption Logger
                </div>
                <h3 className="font-display font-bold text-xl text-sage-800">
                  Deduct Ingredients Used
                </h3>
                <p className="text-xs text-sage-500 leading-relaxed">
                  Select an inventory ingredient and the quantity used during food preparation to update stock live.
                </p>

                {stockSuccessMsg && (
                  <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-green-50 border border-green-200 text-green-700 text-xs p-3 rounded-xl font-medium flex items-center gap-2"
                  >
                    <Check size={16} className="text-green-600 shrink-0" />
                    <span>{stockSuccessMsg}</span>
                  </motion.div>
                )}

                <form onSubmit={handleLogInventoryUsage} className="space-y-4 pt-1">
                  <div>
                    <label className="text-xs font-semibold uppercase text-sage-600 block mb-1">
                      Select Inventory Item (from Admin Panel)
                    </label>
                    <select
                      value={selectedItem}
                      onChange={(e) => setSelectedItem(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-sage-200 bg-white text-xs font-medium focus:ring-2 focus:ring-saffron-400 focus:outline-none"
                      required
                    >
                      <option value="" disabled>Choose ingredient...</option>
                      {inventory.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name} — Current Stock: {item.quantity} {item.unit} (Min: {item.min_level} {item.unit})
                        </option>
                      ))}
                    </select>
                  </div>

                  {selectedInventoryObj && (
                    <div className="bg-sage-50 p-3 rounded-xl text-xs space-y-1 text-sage-600">
                      <div className="flex justify-between">
                        <span>Current Stock:</span>
                        <strong className="text-sage-800">{selectedInventoryObj.quantity} {selectedInventoryObj.unit}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span>Safe Minimum Level:</span>
                        <span className="text-sage-700">{selectedInventoryObj.min_level} {selectedInventoryObj.unit}</span>
                      </div>
                      {Number(selectedInventoryObj.quantity) <= Number(selectedInventoryObj.min_level) && (
                        <p className="text-red-500 font-bold text-[11px] pt-1">
                          ⚠️ Warning: This item is currently at or below minimum level!
                        </p>
                      )}
                    </div>
                  )}

                  <div>
                    <label className="text-xs font-semibold uppercase text-sage-600 block mb-1">
                      Quantity Used ({selectedInventoryObj?.unit || 'Units'})
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        step="any"
                        min="0.01"
                        value={usedQuantity}
                        onChange={(e) => setUsedQuantity(e.target.value)}
                        placeholder="e.g. 0.5"
                        className="flex-1 px-4 py-2.5 rounded-xl border border-sage-200 text-sm focus:ring-2 focus:ring-saffron-400 focus:outline-none"
                        required
                      />
                      <div className="flex gap-1">
                        {['0.5', '1', '2', '5'].map((val) => (
                          <button
                            key={val}
                            type="button"
                            onClick={() => setUsedQuantity(val)}
                            className="px-2 py-1 bg-sage-100 hover:bg-sage-200 text-sage-700 text-xs font-bold rounded-lg transition-colors"
                          >
                            +{val}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold uppercase text-sage-600 block mb-1">
                      Cooking Reference / Dish Note (Optional)
                    </label>
                    <input
                      value={usageNote}
                      onChange={(e) => setUsageNote(e.target.value)}
                      placeholder="e.g. Used for 2x Chicken Salad Bowls"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-sage-200 text-xs focus:ring-2 focus:ring-saffron-400 focus:outline-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loggingStock || !selectedItem}
                    className="btn-primary w-full py-3 text-xs font-bold flex items-center justify-center gap-2 shadow-md shadow-saffron-500/20 disabled:opacity-50"
                  >
                    {loggingStock ? 'Updating Stock in Supabase...' : 'Deduct from Live Inventory'}
                  </button>
                </form>
              </div>
            </div>

            {/* Right Column: Full Live Inventory Table */}
            <div className="lg:col-span-2 space-y-4">
              <div className="card p-6 space-y-4 shadow-md border-sage-200/80">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div>
                    <h3 className="font-display font-bold text-xl text-sage-800">
                      Live Stock Status
                    </h3>
                    <p className="text-xs text-sage-500">
                      Changes here automatically sync to the Admin Panel in real time
                    </p>
                  </div>

                  <div className="relative w-full sm:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-sage-400" size={14} />
                    <input
                      value={inventorySearch}
                      onChange={(e) => setInventorySearch(e.target.value)}
                      placeholder="Search ingredients..."
                      className="w-full pl-9 pr-4 py-2 rounded-xl border border-sage-200 text-xs focus:ring-2 focus:ring-saffron-400 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-sage-50 text-sage-500 font-bold uppercase tracking-wider">
                      <tr>
                        <th className="p-3">Ingredient Name</th>
                        <th className="p-3 text-center">Current Stock</th>
                        <th className="p-3 text-center">Min Safe Level</th>
                        <th className="p-3 text-center">Status</th>
                        <th className="p-3 text-right">Quick Adjust</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-sage-100">
                      {filteredInventory.map((item) => {
                        const isLow = Number(item.quantity) <= Number(item.min_level)
                        return (
                          <tr
                            key={item.id}
                            className={`hover:bg-sage-50/60 transition-colors ${
                              isLow ? 'bg-red-50/50' : ''
                            }`}
                          >
                            <td className="p-3 font-bold text-sage-800">
                              {item.name}
                            </td>
                            <td className="p-3 text-center font-extrabold text-sm text-sage-800">
                              {item.quantity} <span className="text-xs font-normal text-sage-500">{item.unit}</span>
                            </td>
                            <td className="p-3 text-center text-sage-500">
                              {item.min_level} {item.unit}
                            </td>
                            <td className="p-3 text-center">
                              {isLow ? (
                                <span className="inline-flex items-center gap-1 bg-red-100 text-red-700 font-bold px-2.5 py-0.5 rounded-full text-[11px] animate-pulse">
                                  <AlertTriangle size={11} /> Low Stock Alert
                                </span>
                              ) : (
                                <span className="bg-green-100 text-green-800 font-bold px-2.5 py-0.5 rounded-full text-[11px]">
                                  Healthy Stock
                                </span>
                              )}
                            </td>
                            <td className="p-3 text-right">
                              <div className="inline-flex items-center gap-1 bg-sage-50 p-1 rounded-xl border border-sage-200/80">
                                <button
                                  onClick={() => quickAdjustStock(item.id, -1)}
                                  className="p-1 rounded-lg hover:bg-white text-sage-700 hover:text-red-500 transition-colors"
                                  title="Reduce 1 unit"
                                >
                                  <Minus size={13} />
                                </button>
                                <button
                                  onClick={() => {
                                    setSelectedItem(item.id)
                                    window.scrollTo({ top: 300, behavior: 'smooth' })
                                  }}
                                  className="px-2 py-0.5 text-[11px] font-bold text-saffron-600 hover:bg-saffron-50 rounded-lg transition-colors"
                                >
                                  Log
                                </button>
                                <button
                                  onClick={() => quickAdjustStock(item.id, 1)}
                                  className="p-1 rounded-lg hover:bg-white text-sage-700 hover:text-green-600 transition-colors"
                                  title="Add 1 unit"
                                >
                                  <Plus size={13} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AnimatedPage>
  )
}
