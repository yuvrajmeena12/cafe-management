import { describe, it, expect } from 'vitest'
import type { Order, OrderStatus } from '../../types'

/**
 * Pure functions embodying the lifecycle, filtering, and revenue rules
 * implemented in useOrders, OrdersKitchen, and get_admin_dashboard_stats.
 */

export function prepareDeliveryUpdates(
  order: Partial<Order>,
  newStatus: OrderStatus,
  nowIso: string = new Date().toISOString()
): Record<string, any> {
  const updates: Record<string, any> = {
    status: newStatus,
    updated_at: nowIso,
  }

  if (newStatus === 'delivered') {
    updates.delivered_at = nowIso
    if (order.order_type === 'delivery') {
      updates.delivery_stage = 'delivered'
    }
    // COD orders: cash collection is confirmed upon completed delivery
    if (order.payment_method === 'cod') {
      updates.payment_status = 'paid'
      updates.is_cash_deposited = true
    }
    // Online orders: payment_status must NOT be altered
  }

  return updates
}

export function isMatchingOrderFilter(
  orderStatus: OrderStatus | string | undefined,
  filter: OrderStatus | 'pending' | 'all' | undefined
): boolean {
  if (!filter || filter === 'all') return true
  if (filter === 'pending') return !['delivered', 'cancelled'].includes(orderStatus || '')
  return orderStatus === filter
}

export function filterOrdersList(
  orders: Order[],
  filter: OrderStatus | 'pending' | 'all'
): Order[] {
  return orders.filter((o) => isMatchingOrderFilter(o.status, filter))
}

export function calculateDashboardRevenue(
  orders: Pick<Order, 'total' | 'payment_method' | 'payment_status' | 'status'>[]
): number {
  return orders
    .filter(
      (o) =>
        (o.payment_method === 'online' && o.payment_status === 'paid') ||
        (o.payment_method === 'cod' && o.status === 'delivered' && o.payment_status === 'paid')
    )
    .reduce((sum, o) => sum + Number(o.total), 0)
}

export function getNextOrderStatus(order: { status: OrderStatus; order_type: string }): OrderStatus | null {
  if (order.status === 'received') return 'preparing'
  if (order.status === 'preparing') return 'ready'
  if (order.status === 'ready') {
    return order.order_type === 'delivery' ? 'out_for_delivery' : 'delivered'
  }
  if (order.status === 'out_for_delivery') return 'delivered'
  return null
}

describe('COD Order Lifecycle and Admin Revenue Calculation', () => {
  const mockTimestamp = '2026-10-11T12:00:00.000Z'

  describe('1. COD Delivery Status Action & Supabase Persistence', () => {
    it('sets status to delivered, delivered_at, delivery_stage, payment_status to paid, and cash deposited for COD delivery', () => {
      const codDeliveryOrder: Partial<Order> = {
        id: 'ord-cod-1',
        status: 'out_for_delivery',
        payment_method: 'cod',
        payment_status: 'pending',
        order_type: 'delivery',
      }

      const updates = prepareDeliveryUpdates(codDeliveryOrder, 'delivered', mockTimestamp)

      expect(updates.status).toBe('delivered')
      expect(updates.delivered_at).toBe(mockTimestamp)
      expect(updates.delivery_stage).toBe('delivered')
      expect(updates.payment_status).toBe('paid')
      expect(updates.is_cash_deposited).toBe(true)
    })

    it('sets status to delivered and payment_status to paid for COD pickup/dine-in order', () => {
      const codPickupOrder: Partial<Order> = {
        id: 'ord-cod-pickup',
        status: 'ready',
        payment_method: 'cod',
        payment_status: 'pending',
        order_type: 'pickup',
      }

      const updates = prepareDeliveryUpdates(codPickupOrder, 'delivered', mockTimestamp)

      expect(updates.status).toBe('delivered')
      expect(updates.delivered_at).toBe(mockTimestamp)
      expect(updates.payment_status).toBe('paid')
      expect(updates.is_cash_deposited).toBe(true)
      expect(updates.delivery_stage).toBeUndefined()
    })

    it('does NOT mark unpaid online order as paid when delivered', () => {
      const onlineUnpaidOrder: Partial<Order> = {
        id: 'ord-online-unpaid',
        status: 'ready',
        payment_method: 'online',
        payment_status: 'pending',
        order_type: 'pickup',
      }

      const updates = prepareDeliveryUpdates(onlineUnpaidOrder, 'delivered', mockTimestamp)

      expect(updates.status).toBe('delivered')
      expect(updates.delivered_at).toBe(mockTimestamp)
      // Must NOT set payment_status to paid — online orders require verified gateway payments
      expect(updates.payment_status).toBeUndefined()
      expect(updates.is_cash_deposited).toBeUndefined()
    })

    it('preserves existing paid status for verified online orders', () => {
      const onlinePaidOrder: Partial<Order> = {
        id: 'ord-online-paid',
        status: 'out_for_delivery',
        payment_method: 'online',
        payment_status: 'paid',
        order_type: 'delivery',
      }

      const updates = prepareDeliveryUpdates(onlinePaidOrder, 'delivered', mockTimestamp)

      expect(updates.status).toBe('delivered')
      expect(updates.delivered_at).toBe(mockTimestamp)
      expect(updates.delivery_stage).toBe('delivered')
      expect(updates.payment_status).toBeUndefined()
    })
  })

  describe('2. Order-List Filtering & Pending Queue Invalidation', () => {
    const sampleOrders: Order[] = [
      {
        id: 'o-1',
        status: 'received',
        payment_method: 'cod',
        payment_status: 'pending',
        order_type: 'delivery',
        total: 250,
        subtotal: 200,
        tax: 10,
        discount_amount: 0,
        delivery_charge: 40,
        customer_id: null,
        customer_name: 'John',
        customer_email: 'john@example.com',
        customer_phone: '9876543210',
        delivery_address: 'Main St',
        delivery_lat: null,
        delivery_lng: null,
        payment_id: null,
        razorpay_order_id: null,
        assigned_delivery_id: null,
        delivery_rating: null,
        delivered_at: null,
        delivery_stage: null,
        is_cash_deposited: false,
        placed_at: '2026-10-11T10:00:00Z',
      },
      {
        id: 'o-2',
        status: 'preparing',
        payment_method: 'online',
        payment_status: 'paid',
        order_type: 'delivery',
        total: 500,
        subtotal: 450,
        tax: 22.5,
        discount_amount: 0,
        delivery_charge: 27.5,
        customer_id: null,
        customer_name: 'Jane',
        customer_email: 'jane@example.com',
        customer_phone: '9876543211',
        delivery_address: 'Park Ave',
        delivery_lat: null,
        delivery_lng: null,
        payment_id: 'pay_123',
        razorpay_order_id: 'order_123',
        assigned_delivery_id: null,
        delivery_rating: null,
        delivered_at: null,
        delivery_stage: null,
        is_cash_deposited: false,
        placed_at: '2026-10-11T10:30:00Z',
      },
      {
        id: 'o-3',
        status: 'out_for_delivery',
        payment_method: 'cod',
        payment_status: 'pending',
        order_type: 'delivery',
        total: 350,
        subtotal: 300,
        tax: 15,
        discount_amount: 0,
        delivery_charge: 35,
        customer_id: null,
        customer_name: 'Bob',
        customer_email: 'bob@example.com',
        customer_phone: '9876543212',
        delivery_address: 'Beach Rd',
        delivery_lat: null,
        delivery_lng: null,
        payment_id: null,
        razorpay_order_id: null,
        assigned_delivery_id: null,
        delivery_rating: null,
        delivered_at: null,
        delivery_stage: 'on_the_way',
        is_cash_deposited: false,
        placed_at: '2026-10-11T11:00:00Z',
      },
      {
        id: 'o-4',
        status: 'delivered',
        payment_method: 'cod',
        payment_status: 'paid',
        order_type: 'delivery',
        total: 400,
        subtotal: 350,
        tax: 17.5,
        discount_amount: 0,
        delivery_charge: 32.5,
        customer_id: null,
        customer_name: 'Alice',
        customer_email: 'alice@example.com',
        customer_phone: '9876543213',
        delivery_address: 'Hill Rd',
        delivery_lat: null,
        delivery_lng: null,
        payment_id: null,
        razorpay_order_id: null,
        assigned_delivery_id: null,
        delivery_rating: null,
        delivered_at: '2026-10-11T11:30:00Z',
        delivery_stage: 'delivered',
        is_cash_deposited: true,
        placed_at: '2026-10-11T10:45:00Z',
      },
      {
        id: 'o-5',
        status: 'cancelled',
        payment_method: 'online',
        payment_status: 'failed',
        order_type: 'delivery',
        total: 150,
        subtotal: 120,
        tax: 6,
        discount_amount: 0,
        delivery_charge: 24,
        customer_id: null,
        customer_name: 'Charlie',
        customer_email: 'charlie@example.com',
        customer_phone: '9876543214',
        delivery_address: 'River St',
        delivery_lat: null,
        delivery_lng: null,
        payment_id: null,
        razorpay_order_id: null,
        assigned_delivery_id: null,
        delivery_rating: null,
        delivered_at: null,
        delivery_stage: null,
        is_cash_deposited: false,
        placed_at: '2026-10-11T09:00:00Z',
      },
    ]

    it('filters pending orders to exclude delivered and cancelled orders', () => {
      const pending = filterOrdersList(sampleOrders, 'pending')
      expect(pending.map((o) => o.id)).toEqual(['o-1', 'o-2', 'o-3'])
      expect(pending.map((o) => o.id)).not.toContain('o-4') // delivered
      expect(pending.map((o) => o.id)).not.toContain('o-5') // cancelled
    })

    it('immediately removes a COD order from the pending list when marked delivered', () => {
      // Simulate order o-3 delivered
      const updatedList = sampleOrders.map((o) =>
        o.id === 'o-3' ? { ...o, status: 'delivered' as OrderStatus, payment_status: 'paid' as const } : o
      )

      const pendingAfterDelivery = filterOrdersList(updatedList, 'pending')
      expect(pendingAfterDelivery.map((o) => o.id)).toEqual(['o-1', 'o-2'])
      expect(pendingAfterDelivery.map((o) => o.id)).not.toContain('o-3')
    })

    it('filters specific column statuses accurately', () => {
      expect(filterOrdersList(sampleOrders, 'received').map((o) => o.id)).toEqual(['o-1'])
      expect(filterOrdersList(sampleOrders, 'preparing').map((o) => o.id)).toEqual(['o-2'])
      expect(filterOrdersList(sampleOrders, 'out_for_delivery').map((o) => o.id)).toEqual(['o-3'])
      expect(filterOrdersList(sampleOrders, 'delivered').map((o) => o.id)).toEqual(['o-4'])
      expect(filterOrdersList(sampleOrders, 'all')).toHaveLength(5)
    })

    it('progresses next status correctly by order type', () => {
      // Delivery order progression
      expect(getNextOrderStatus({ status: 'received', order_type: 'delivery' })).toBe('preparing')
      expect(getNextOrderStatus({ status: 'preparing', order_type: 'delivery' })).toBe('ready')
      expect(getNextOrderStatus({ status: 'ready', order_type: 'delivery' })).toBe('out_for_delivery')
      expect(getNextOrderStatus({ status: 'out_for_delivery', order_type: 'delivery' })).toBe('delivered')
      expect(getNextOrderStatus({ status: 'delivered', order_type: 'delivery' })).toBeNull()

      // Dine-in order progression (skips out_for_delivery)
      expect(getNextOrderStatus({ status: 'ready', order_type: 'dine_in' })).toBe('delivered')

      // Pickup order progression (skips out_for_delivery)
      expect(getNextOrderStatus({ status: 'ready', order_type: 'pickup' })).toBe('delivered')
    })
  })

  describe('3. Admin Dashboard Revenue Calculation Rules', () => {
    it('counts verified online paid orders', () => {
      const orders = [
        { total: 500, payment_method: 'online' as const, payment_status: 'paid' as const, status: 'preparing' as const },
        { total: 300, payment_method: 'online' as const, payment_status: 'paid' as const, status: 'delivered' as const },
      ]
      expect(calculateDashboardRevenue(orders)).toBe(800)
    })

    it('counts COD revenue ONLY when delivery is completed and cash is paid', () => {
      const orders = [
        // Completed COD delivery
        { total: 400, payment_method: 'cod' as const, payment_status: 'paid' as const, status: 'delivered' as const },
        // Undelivered COD orders (MUST NOT BE COUNTED)
        { total: 250, payment_method: 'cod' as const, payment_status: 'pending' as const, status: 'received' as const },
        { total: 350, payment_method: 'cod' as const, payment_status: 'pending' as const, status: 'preparing' as const },
        { total: 450, payment_method: 'cod' as const, payment_status: 'pending' as const, status: 'ready' as const },
        { total: 550, payment_method: 'cod' as const, payment_status: 'pending' as const, status: 'out_for_delivery' as const },
        // Undelivered COD even if status erroneously had payment_status paid without delivery
        { total: 100, payment_method: 'cod' as const, payment_status: 'paid' as const, status: 'out_for_delivery' as const },
      ]
      // Only the delivered paid COD order should count
      expect(calculateDashboardRevenue(orders)).toBe(400)
    })

    it('excludes unpaid online orders regardless of fulfillment status', () => {
      const orders = [
        { total: 600, payment_method: 'online' as const, payment_status: 'pending' as const, status: 'received' as const },
        { total: 700, payment_method: 'online' as const, payment_status: 'pending' as const, status: 'delivered' as const },
        { total: 800, payment_method: 'online' as const, payment_status: 'failed' as const, status: 'cancelled' as const },
      ]
      expect(calculateDashboardRevenue(orders)).toBe(0)
    })

    it('prevents duplicate counting and accurately totals mixed orders', () => {
      const orders = [
        // Verified online paid (both preparing and delivered)
        { total: 500, payment_method: 'online' as const, payment_status: 'paid' as const, status: 'preparing' as const },
        { total: 300, payment_method: 'online' as const, payment_status: 'paid' as const, status: 'delivered' as const },
        // Delivered COD with cash collection confirmed
        { total: 400, payment_method: 'cod' as const, payment_status: 'paid' as const, status: 'delivered' as const },
        // In-flight COD orders (cash not collected)
        { total: 250, payment_method: 'cod' as const, payment_status: 'pending' as const, status: 'received' as const },
        { total: 350, payment_method: 'cod' as const, payment_status: 'pending' as const, status: 'out_for_delivery' as const },
        // Unpaid online
        { total: 600, payment_method: 'online' as const, payment_status: 'pending' as const, status: 'ready' as const },
        // Cancelled online refunded
        { total: 150, payment_method: 'online' as const, payment_status: 'refunded' as const, status: 'cancelled' as const },
      ]

      // Expected revenue: 500 (online) + 300 (online) + 400 (delivered COD) = 1200
      expect(calculateDashboardRevenue(orders)).toBe(1200)
    })
  })
})
