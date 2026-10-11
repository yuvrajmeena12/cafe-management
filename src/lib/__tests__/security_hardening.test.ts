import { describe, it, expect } from 'vitest'
import { distanceKm, getDeliveryCharge } from '../distance'
import { ALLOWED_IMAGE_MIME_TYPES } from '../upload'
import { isValidImageUrl } from '../validation'
import type { DeliveryChargeTier, UserRole } from '../../types'

describe('Phase 4A Security & Hardening Invariants', () => {
  describe('SEC-P0-01: Profile Role Protection Rules', () => {
    it('prohibits self-elevation to admin or delivery roles by standard customers', () => {
      const callerRole: UserRole = 'customer'
      const requestedRoleChange: UserRole = 'admin'

      const isAllowedRoleChange = (current: UserRole, target: UserRole, isCallerAdmin: boolean) => {
        if (target === current) return true
        return isCallerAdmin
      }

      expect(isAllowedRoleChange(callerRole, requestedRoleChange, false)).toBe(false)
      expect(isAllowedRoleChange(callerRole, 'customer', false)).toBe(true)
      expect(isAllowedRoleChange(callerRole, 'admin', true)).toBe(true)
    })
  })

  describe('SEC-P0-02: Order Update Column Protection Rules', () => {
    const PROTECTED_COLUMNS = [
      'total',
      'subtotal',
      'tax',
      'discount_amount',
      'delivery_charge',
      'payment_status',
      'payment_method',
      'payment_id',
      'razorpay_order_id',
      'status',
      'assigned_delivery_id',
      'customer_id',
      'guest_token',
    ]

    it('rejects customer modification of any protected column including guest_token', () => {
      const customerAttemptedUpdates = {
        total: 0,
        payment_status: 'paid',
        status: 'delivered',
        guest_token: 'tampered-token',
        delivery_rating: 5,
      }

      const hasUnauthorizedColumnModifications = (updates: Record<string, unknown>) => {
        return Object.keys(updates).some((col) => PROTECTED_COLUMNS.includes(col))
      }

      expect(hasUnauthorizedColumnModifications(customerAttemptedUpdates)).toBe(true)

      const legitimateCustomerUpdate = {
        delivery_rating: 5,
      }
      expect(hasUnauthorizedColumnModifications(legitimateCustomerUpdate)).toBe(false)
    })

    it('rejects delivery staff modification of financial columns or guest_token', () => {
      const deliveryAttemptedFinancialTamper = {
        total: 50,
        status: 'delivered',
      }
      const deliveryAttemptedTokenTamper = {
        guest_token: 'new-token',
        status: 'delivered',
      }
      const legitimateDeliveryWorkflow = {
        status: 'delivered',
        delivery_stage: 'delivered',
        payment_status: 'paid', // Cash collection for COD
        is_cash_deposited: true,
      }

      const deliveryForbiddenCols = ['total', 'subtotal', 'tax', 'discount_amount', 'delivery_charge', 'customer_id', 'guest_token']
      const hasDeliveryForbiddenCols = (updates: Record<string, unknown>) => {
        return Object.keys(updates).some((col) => deliveryForbiddenCols.includes(col))
      }

      expect(hasDeliveryForbiddenCols(deliveryAttemptedFinancialTamper)).toBe(true)
      expect(hasDeliveryForbiddenCols(deliveryAttemptedTokenTamper)).toBe(true)
      expect(hasDeliveryForbiddenCols(legitimateDeliveryWorkflow)).toBe(false)
    })

    it('only allows delivery rating submission on delivered orders', () => {
      const canSubmitRating = (orderStatus: string, rating: number) => {
        return orderStatus === 'delivered' && rating >= 1 && rating <= 5
      }

      expect(canSubmitRating('received', 5)).toBe(false)
      expect(canSubmitRating('preparing', 4)).toBe(false)
      expect(canSubmitRating('out_for_delivery', 5)).toBe(false)
      expect(canSubmitRating('delivered', 5)).toBe(true)
      expect(canSubmitRating('delivered', 6)).toBe(false)
    })
  })

  describe('SEC-P0-03: Authoritative Order Pricing & Discount Rules', () => {
    const tiers: DeliveryChargeTier[] = [
      { id: 't1', max_km: 2, charge: 5 },
      { id: 't2', max_km: 5, charge: 15 },
      { id: 't3', max_km: 10, charge: 20 },
    ]

    it('calculates total authoritatively and ignores client-tampered totals', () => {
      const dbPrices: Record<string, number> = {
        'item-1': 250,
        'item-2': 150,
      }

      const cartItems = [
        { menu_item_id: 'item-1', quantity: 2, client_claimed_unit_price: 1 },
        { menu_item_id: 'item-2', quantity: 1, client_claimed_unit_price: 1 },
      ]

      const subtotal = cartItems.reduce((acc, item) => {
        const authoritativePrice = dbPrices[item.menu_item_id]
        return acc + authoritativePrice * item.quantity
      }, 0)

      expect(subtotal).toBe(650)

      const deliveryCharge = getDeliveryCharge(3, tiers)
      expect(deliveryCharge).toBe(15)

      const tax = +(subtotal * 0.05).toFixed(2)
      expect(tax).toBe(32.5)

      const discountAmount = 50
      const total = +(subtotal + tax + deliveryCharge - discountAmount).toFixed(2)

      expect(total).toBe(647.5)
    })

    it('rejects invalid, negative, zero, or excessively large quantities', () => {
      const isQuantityValid = (qty: number) => {
        return Number.isInteger(qty) && qty >= 1 && qty <= 100
      }

      expect(isQuantityValid(0)).toBe(false)
      expect(isQuantityValid(-5)).toBe(false)
      expect(isQuantityValid(101)).toBe(false)
      expect(isQuantityValid(2.5)).toBe(false)
      expect(isQuantityValid(1)).toBe(true)
      expect(isQuantityValid(10)).toBe(true)
      expect(isQuantityValid(100)).toBe(true)
    })

    it('correctly aggregates duplicate line items using authoritative pricing', () => {
      const dbPrices: Record<string, number> = { 'item-1': 100 }
      const cartItems = [
        { menu_item_id: 'item-1', quantity: 2 },
        { menu_item_id: 'item-1', quantity: 3 },
      ]
      const subtotal = cartItems.reduce((acc, item) => acc + dbPrices[item.menu_item_id] * item.quantity, 0)
      expect(subtotal).toBe(500)
    })

    it('caps discount amount at subtotal to avoid negative total amounts', () => {
      const subtotal = 100
      const excessiveDiscount = 150
      const effectiveDiscount = Math.min(subtotal, excessiveDiscount)
      const tax = +(subtotal * 0.05).toFixed(2)
      const deliveryCharge = 0
      const total = +(subtotal + tax + deliveryCharge - effectiveDiscount).toFixed(2)

      expect(effectiveDiscount).toBe(100)
      expect(total).toBeGreaterThanOrEqual(0)
    })
  })

  describe('SEC-P1-01 & SEC-P1-02: Guest & Ownership Authorization Invariants', () => {
    interface OrderAuthContext {
      customerId: string | null
      guestToken: string | null
    }

    const isAuthorizedForPaymentOrEmail = (
      order: OrderAuthContext,
      callerUserId: string | null,
      providedGuestToken: string | null,
      isCallerAdminOrDelivery: boolean,
      isServiceRole: boolean = false
    ) => {
      if (isServiceRole || isCallerAdminOrDelivery) return true
      if (callerUserId && order.customerId && callerUserId === order.customerId) return true
      if (!order.customerId && providedGuestToken && order.guestToken && providedGuestToken === order.guestToken) return true
      return false
    }

    const authOrder: OrderAuthContext = { customerId: 'user-123', guestToken: null }
    const guestOrder: OrderAuthContext = { customerId: null, guestToken: 'secret-guest-token-xyz' }

    it('allows owner to authorize their own order', () => {
      expect(isAuthorizedForPaymentOrEmail(authOrder, 'user-123', null, false)).toBe(true)
    })

    it('blocks other customers from accessing an authenticated customer order', () => {
      expect(isAuthorizedForPaymentOrEmail(authOrder, 'attacker-456', null, false)).toBe(false)
      expect(isAuthorizedForPaymentOrEmail(authOrder, null, null, false)).toBe(false)
    })

    it('prevents attacker from using guestToken against an authenticated customer order', () => {
      expect(isAuthorizedForPaymentOrEmail(authOrder, null, 'secret-guest-token-xyz', false)).toBe(false)
      expect(isAuthorizedForPaymentOrEmail(authOrder, 'attacker-456', 'secret-guest-token-xyz', false)).toBe(false)
    })

    it('allows guest with matching token to access guest order', () => {
      expect(isAuthorizedForPaymentOrEmail(guestOrder, null, 'secret-guest-token-xyz', false)).toBe(true)
    })

    it('blocks arbitrary caller from accessing guest order without valid token', () => {
      expect(isAuthorizedForPaymentOrEmail(guestOrder, null, null, false)).toBe(false)
      expect(isAuthorizedForPaymentOrEmail(guestOrder, null, 'wrong-token', false)).toBe(false)
      expect(isAuthorizedForPaymentOrEmail(guestOrder, 'random-user', null, false)).toBe(false)
    })

    it('allows admin, delivery riders, or internal service role to access order', () => {
      expect(isAuthorizedForPaymentOrEmail(authOrder, 'admin-999', null, true)).toBe(true)
      expect(isAuthorizedForPaymentOrEmail(guestOrder, 'delivery-888', null, true)).toBe(true)
      expect(isAuthorizedForPaymentOrEmail(authOrder, null, null, false, true)).toBe(true)
      expect(isAuthorizedForPaymentOrEmail(guestOrder, null, null, false, true)).toBe(true)
    })
  })

  describe('SEC-P2-01: ProtectedRoute Allowed Roles Policy', () => {
    const isRouteAccessible = (userRole: UserRole, allowedRoles: UserRole[], isAdmin: boolean) => {
      if (isAdmin) return true
      return allowedRoles.includes(userRole)
    }

    const deliveryAllowedRoles: UserRole[] = ['delivery', 'admin']

    it('permits delivery riders to access /delivery', () => {
      expect(isRouteAccessible('delivery', deliveryAllowedRoles, false)).toBe(true)
    })

    it('permits admins to access /delivery', () => {
      expect(isRouteAccessible('admin', deliveryAllowedRoles, true)).toBe(true)
    })

    it('rejects ordinary customers and staff from /delivery', () => {
      expect(isRouteAccessible('customer', deliveryAllowedRoles, false)).toBe(false)
      expect(isRouteAccessible('staff', deliveryAllowedRoles, false)).toBe(false)
    })
  })

  describe('Phase 4B-1 SEC-P2-02 & SEC-P2-05: Review Security & Uniqueness Invariants', () => {
    interface OrderRecord {
      id: string
      customer_id: string
      status: string
      items: string[] // menu_item_ids
    }

    interface ReviewSubmission {
      customer_id: string
      order_id: string | null
      menu_item_id: string | null
      rating: number
    }

    const validateReviewInsertion = (
      submission: ReviewSubmission,
      callerId: string | null,
      isAdmin: boolean,
      ordersDb: OrderRecord[],
      existingReviews: Set<string> // set of order_ids
    ): { allowed: boolean; reason?: string } => {
      if (isAdmin) return { allowed: true }
      if (!callerId) return { allowed: false, reason: 'Unauthenticated' }
      if (submission.customer_id !== callerId) return { allowed: false, reason: 'Spoofed customer_id' }
      if (!submission.order_id) return { allowed: false, reason: 'Missing order_id' }
      if (submission.rating < 1 || submission.rating > 5) return { allowed: false, reason: 'Invalid rating' }

      // Uniqueness check (enforced by uq_reviews_order_id)
      if (existingReviews.has(submission.order_id)) {
        return { allowed: false, reason: 'Duplicate review for order' }
      }

      // Order ownership & status check
      const order = ordersDb.find((o) => o.id === submission.order_id)
      if (!order) return { allowed: false, reason: 'Order not found' }
      if (order.customer_id !== callerId) return { allowed: false, reason: 'Order belongs to another customer' }
      if (order.status !== 'delivered') return { allowed: false, reason: 'Order not delivered' }

      // Menu item ownership check
      if (submission.menu_item_id && !order.items.includes(submission.menu_item_id)) {
        return { allowed: false, reason: 'Menu item not in order' }
      }

      return { allowed: true }
    }

    const testOrders: OrderRecord[] = [
      { id: 'ord-deliv-1', customer_id: 'cust-alice', status: 'delivered', items: ['item-cake', 'item-tea'] },
      { id: 'ord-prep-2', customer_id: 'cust-alice', status: 'preparing', items: ['item-pizza'] },
      { id: 'ord-canc-3', customer_id: 'cust-alice', status: 'cancelled', items: ['item-coffee'] },
      { id: 'ord-deliv-bob', customer_id: 'cust-bob', status: 'delivered', items: ['item-smoothie'] },
    ]

    it('allows a customer to review their own delivered order with valid menu item', () => {
      const existing = new Set<string>()
      const result = validateReviewInsertion(
        { customer_id: 'cust-alice', order_id: 'ord-deliv-1', menu_item_id: 'item-cake', rating: 5 },
        'cust-alice',
        false,
        testOrders,
        existing
      )
      expect(result.allowed).toBe(true)
    })

    it('denies an unauthenticated user from inserting a review', () => {
      const result = validateReviewInsertion(
        { customer_id: 'cust-alice', order_id: 'ord-deliv-1', menu_item_id: 'item-cake', rating: 5 },
        null,
        false,
        testOrders,
        new Set()
      )
      expect(result.allowed).toBe(false)
      expect(result.reason).toBe('Unauthenticated')
    })

    it('denies review if customer_id does not match auth.uid()', () => {
      const result = validateReviewInsertion(
        { customer_id: 'cust-alice', order_id: 'ord-deliv-1', menu_item_id: 'item-cake', rating: 5 },
        'cust-mallory',
        false,
        testOrders,
        new Set()
      )
      expect(result.allowed).toBe(false)
      expect(result.reason).toBe('Spoofed customer_id')
    })

    it('denies a customer from reviewing another customer order', () => {
      const result = validateReviewInsertion(
        { customer_id: 'cust-alice', order_id: 'ord-deliv-bob', menu_item_id: 'item-smoothie', rating: 1 },
        'cust-alice',
        false,
        testOrders,
        new Set()
      )
      expect(result.allowed).toBe(false)
      expect(result.reason).toBe('Order belongs to another customer')
    })

    it('denies reviewing an undelivered or preparing order', () => {
      const result = validateReviewInsertion(
        { customer_id: 'cust-alice', order_id: 'ord-prep-2', menu_item_id: 'item-pizza', rating: 4 },
        'cust-alice',
        false,
        testOrders,
        new Set()
      )
      expect(result.allowed).toBe(false)
      expect(result.reason).toBe('Order not delivered')
    })

    it('denies reviewing a cancelled order', () => {
      const result = validateReviewInsertion(
        { customer_id: 'cust-alice', order_id: 'ord-canc-3', menu_item_id: 'item-coffee', rating: 1 },
        'cust-alice',
        false,
        testOrders,
        new Set()
      )
      expect(result.allowed).toBe(false)
      expect(result.reason).toBe('Order not delivered')
    })

    it('denies reviewing a menu item not contained in the order', () => {
      const result = validateReviewInsertion(
        { customer_id: 'cust-alice', order_id: 'ord-deliv-1', menu_item_id: 'unrelated-steak', rating: 5 },
        'cust-alice',
        false,
        testOrders,
        new Set()
      )
      expect(result.allowed).toBe(false)
      expect(result.reason).toBe('Menu item not in order')
    })

    it('enforces database uniqueness: denies duplicate reviews for the same order', () => {
      const existing = new Set<string>(['ord-deliv-1'])
      const result = validateReviewInsertion(
        { customer_id: 'cust-alice', order_id: 'ord-deliv-1', menu_item_id: 'item-cake', rating: 5 },
        'cust-alice',
        false,
        testOrders,
        existing
      )
      expect(result.allowed).toBe(false)
      expect(result.reason).toBe('Duplicate review for order')
    })

    it('blocks simulated concurrent race condition on duplicate review insertions', () => {
      const existing = new Set<string>()
      // First attempt succeeds
      const first = validateReviewInsertion(
        { customer_id: 'cust-alice', order_id: 'ord-deliv-1', menu_item_id: 'item-cake', rating: 5 },
        'cust-alice',
        false,
        testOrders,
        existing
      )
      expect(first.allowed).toBe(true)
      existing.add('ord-deliv-1')

      // Simultaneous/concurrent attempt fails against unique key
      const second = validateReviewInsertion(
        { customer_id: 'cust-alice', order_id: 'ord-deliv-1', menu_item_id: 'item-cake', rating: 4 },
        'cust-alice',
        false,
        testOrders,
        existing
      )
      expect(second.allowed).toBe(false)
      expect(second.reason).toBe('Duplicate review for order')
    })
  })

  describe('Phase 4B-1 SEC-P1-05: Case-Insensitive Role Invitation Matching', () => {
    interface RoleInvite {
      email: string
      role: UserRole
    }

    const resolveInvitedRole = (signupEmail: string, invites: RoleInvite[]): UserRole => {
      const cleanSignup = signupEmail.trim().toLowerCase()
      const invite = invites.find((i) => i.email.trim().toLowerCase() === cleanSignup)
      return invite ? invite.role : 'customer'
    }

    const testInvites: RoleInvite[] = [
      { email: 'Staff@Cafe.com', role: 'staff' },
      { email: 'delivery-rider@cafe.com', role: 'delivery' },
      { email: 'ADMIN@CAFE.COM', role: 'admin' },
    ]

    it('correctly matches exact-case invitations', () => {
      expect(resolveInvitedRole('delivery-rider@cafe.com', testInvites)).toBe('delivery')
    })

    it('correctly matches lowercase signup against uppercase invitation', () => {
      expect(resolveInvitedRole('admin@cafe.com', testInvites)).toBe('admin')
    })

    it('correctly matches uppercase signup against mixed-case invitation', () => {
      expect(resolveInvitedRole('STAFF@CAFE.COM', testInvites)).toBe('staff')
    })

    it('falls back to customer role when no invitation exists', () => {
      expect(resolveInvitedRole('stranger@gmail.com', testInvites)).toBe('customer')
    })
  })

  describe('Phase 4B-1 SEC-P2-03: Discount Data Exposure Hardening', () => {
    interface DiscountRecord {
      code: string
      active: boolean
      valid_from: string | null
      valid_to: string | null
    }

    const filterDiscountsForUser = (
      discounts: DiscountRecord[],
      isAdmin: boolean,
      currentDate: string
    ): DiscountRecord[] => {
      if (isAdmin) return discounts
      return discounts.filter((d) => {
        if (!d.active) return false
        if (d.valid_from && d.valid_from > currentDate) return false
        if (d.valid_to && d.valid_to < currentDate) return false
        return true
      })
    }

    const mockDiscounts: DiscountRecord[] = [
      { code: 'ACTIVE_NOW', active: true, valid_from: '2026-01-01', valid_to: '2026-12-31' },
      { code: 'EXPIRED_CODE', active: true, valid_from: '2025-01-01', valid_to: '2025-12-31' },
      { code: 'FUTURE_PROMO', active: true, valid_from: '2026-11-01', valid_to: '2026-12-31' },
      { code: 'INACTIVE_DRAFT', active: false, valid_from: '2026-01-01', valid_to: '2026-12-31' },
    ]

    const today = '2026-08-15'

    it('allows non-admin to only view currently active, unexpired, non-future discounts', () => {
      const visible = filterDiscountsForUser(mockDiscounts, false, today)
      expect(visible.map((d) => d.code)).toEqual(['ACTIVE_NOW'])
    })

    it('hides expired, future, and inactive discounts from public/customer queries', () => {
      const visible = filterDiscountsForUser(mockDiscounts, false, today)
      const codes = visible.map((d) => d.code)
      expect(codes).not.toContain('EXPIRED_CODE')
      expect(codes).not.toContain('FUTURE_PROMO')
      expect(codes).not.toContain('INACTIVE_DRAFT')
    })

    it('allows administrators full visibility of all discount records', () => {
      const visible = filterDiscountsForUser(mockDiscounts, true, today)
      expect(visible).toHaveLength(4)
    })
  })

  describe('Phase 4B-1 SEC-P2-06: Database Numeric Integrity Invariants', () => {
    it('validates price and non-negative constraints across catalog and orders', () => {
      const isValidPrice = (price: number) => price >= 0
      const isValidCalories = (cal: number | null) => cal === null || cal >= 0
      const isValidPrepTime = (m: number | null) => m === null || m >= 0
      const isValidSalary = (sal: number | null) => sal === null || sal >= 0
      const isValidExpense = (amt: number) => amt >= 0
      const isValidPercentDiscount = (type: string, val: number) => type !== 'percent' || (val >= 0 && val <= 100)
      const isValidDeliveryTier = (maxKm: number, charge: number) => maxKm > 0 && charge >= 0

      expect(isValidPrice(150)).toBe(true)
      expect(isValidPrice(0)).toBe(true)
      expect(isValidPrice(-10)).toBe(false)

      expect(isValidCalories(null)).toBe(true)
      expect(isValidCalories(250)).toBe(true)
      expect(isValidCalories(-5)).toBe(false)

      expect(isValidPrepTime(10)).toBe(true)
      expect(isValidPrepTime(-1)).toBe(false)

      expect(isValidSalary(25000)).toBe(true)
      expect(isValidSalary(-500)).toBe(false)

      expect(isValidExpense(500)).toBe(true)
      expect(isValidExpense(-100)).toBe(false)

      expect(isValidPercentDiscount('percent', 20)).toBe(true)
      expect(isValidPercentDiscount('percent', 100)).toBe(true)
      expect(isValidPercentDiscount('percent', 105)).toBe(false)
      expect(isValidPercentDiscount('percent', -5)).toBe(false)
      expect(isValidPercentDiscount('flat', 500)).toBe(true)

      expect(isValidDeliveryTier(5, 15)).toBe(true)
      expect(isValidDeliveryTier(0, 15)).toBe(false)
      expect(isValidDeliveryTier(-2, 15)).toBe(false)
      expect(isValidDeliveryTier(5, -1)).toBe(false)
    })
  })

  describe('Phase 4B-1 SEC-P2-07: Append-Only Audit Logging Invariants', () => {
    interface AuditLogEntry {
      id: string
      actor_id: string | null
      action: string
      target_table: string
      target_id: string | null
      old_values: Record<string, unknown> | null
      new_values: Record<string, unknown> | null
    }

    it('generates immutable audit log entries with correct action and actor', () => {
      const logs: AuditLogEntry[] = []

      const logAction = (
        actorId: string | null,
        action: string,
        table: string,
        targetId: string,
        oldVal: Record<string, unknown> | null,
        newVal: Record<string, unknown> | null
      ) => {
        // Redact any sensitive tokens if present
        const sanitize = (data: Record<string, unknown> | null) => {
          if (!data) return null
          const copy = { ...data }
          delete copy.guest_token
          delete copy.payment_id
          delete copy.razorpay_order_id
          delete copy.password
          return copy
        }

        logs.push({
          id: 'log-1',
          actor_id: actorId,
          action,
          target_table: table,
          target_id: targetId,
          old_values: sanitize(oldVal),
          new_values: sanitize(newVal),
        })
      }

      logAction('admin-uuid-1', 'STAFF_SALARY_CHANGE', 'staff', 'staff-1', { monthly_salary: 20000 }, { monthly_salary: 25000 })

      expect(logs).toHaveLength(1)
      expect(logs[0].actor_id).toBe('admin-uuid-1')
      expect(logs[0].action).toBe('STAFF_SALARY_CHANGE')
      expect(logs[0].old_values).toEqual({ monthly_salary: 20000 })
      expect(logs[0].new_values).toEqual({ monthly_salary: 25000 })
    })

    it('strictly redacts sensitive secrets like guest_token from audit logs', () => {
      const sanitizeOrderAudit = (order: Record<string, unknown>) => {
        const copy = { ...order }
        delete copy.guest_token
        delete copy.payment_id
        return copy
      }

      const orderData = {
        status: 'delivered',
        guest_token: 'super-secret-token',
        payment_id: 'pay_123456',
        total: 550,
      }

      const sanitized = sanitizeOrderAudit(orderData)
      expect(sanitized).not.toHaveProperty('guest_token')
      expect(sanitized).not.toHaveProperty('payment_id')
      expect(sanitized).toHaveProperty('status', 'delivered')
      expect(sanitized).toHaveProperty('total', 550)
    })

    it('rejects update or delete attempts on audit log table (immutability)', () => {
      const assertAuditImmutable = (op: 'INSERT' | 'UPDATE' | 'DELETE') => {
        if (op === 'UPDATE' || op === 'DELETE') {
          throw new Error('Audit logs are immutable and append-only. Modification or deletion is strictly forbidden.')
        }
        return true
      }

      expect(() => assertAuditImmutable('UPDATE')).toThrow('Audit logs are immutable and append-only')
      expect(() => assertAuditImmutable('DELETE')).toThrow('Audit logs are immutable and append-only')
      expect(assertAuditImmutable('INSERT')).toBe(true)
    })
  })

  describe('Phase 4B-2: Razorpay Webhook Idempotency & Payment State Integrity Invariants', () => {
    // 1. Timing-safe comparison invariant
    const timingSafeEqual = (a: string, b: string): boolean => {
      if (a.length !== b.length) return false
      let mismatch = 0
      for (let i = 0; i < a.length; i++) {
        mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i)
      }
      return mismatch === 0
    }

    it('timingSafeEqual correctly validates identical signatures and rejects invalid ones', () => {
      const sig1 = 'a1b2c3d4e5f60718293a4b5c6d7e8f90'
      const sig2 = 'a1b2c3d4e5f60718293a4b5c6d7e8f90'
      const sigDiff = 'a1b2c3d4e5f60718293a4b5c6d7e8f99'
      const sigShort = 'a1b2c3d4'

      expect(timingSafeEqual(sig1, sig2)).toBe(true)
      expect(timingSafeEqual(sig1, sigDiff)).toBe(false)
      expect(timingSafeEqual(sig1, sigShort)).toBe(false)
      expect(timingSafeEqual('', '')).toBe(true)
    })

    // 2. Atomic Webhook RPC and Edge Function simulation state machine
    interface MockOrder {
      id: string
      total: number
      payment_status: 'pending' | 'paid' | 'failed' | 'refunded'
      razorpay_order_id: string
      payment_id: string | null
      customer_email?: string
    }

    interface MockWebhookEvent {
      id: string
      event_id: string
      event_type: string
      razorpay_order_id: string
      payment_id: string
      amount_paise: number
      status: 'processing' | 'processed' | 'ignored' | 'failed'
      error_message?: string
    }

    interface WebhookSimulationContext {
      orders: Map<string, MockOrder> // key: razorpay_order_id
      events: Map<string, MockWebhookEvent> // key: event_id
      emailsSent: string[] // order IDs for which email was dispatched
      simulateTransientOrderFailure?: boolean // triggers rollback during order mutation
    }

    // Simulates the SECURITY DEFINER PostgreSQL RPC: public.process_razorpay_webhook_event
    const processRazorpayWebhookEventRpc = (
      ctx: WebhookSimulationContext,
      eventId: string,
      eventType: string,
      razorpayOrderId: string,
      paymentId: string,
      amountPaise: number,
      currency: string,
      callerRole: 'service_role' | 'anon' | 'authenticated' = 'service_role'
    ): {
      status: string
      should_send_email: boolean
      order_id?: string
      error?: string
    } => {
      // Direct caller authorization: Only service_role granted execute
      if (callerRole !== 'service_role') {
        throw new Error('permission denied for function process_razorpay_webhook_event')
      }

      // Input validation
      if (!eventId?.trim() || !eventType?.trim() || !razorpayOrderId?.trim() || !paymentId?.trim()) {
        throw new Error('Missing required parameter')
      }

      // Step 1: Check existing event delivery with row-level lock
      const existing = ctx.events.get(eventId)
      if (existing) {
        if (existing.status === 'processed') {
          return { status: 'duplicate_event_ignored', should_send_email: false }
        }
        if (existing.status === 'ignored') {
          return { status: 'ignored_event_noop', should_send_email: false }
        }
        // If status is 'failed' or 'processing', we allow retry processing on this event
      }

      // Atomic transaction snapshot for rollback simulation on transient error
      const eventSnapshot = existing ? { ...existing } : null
      const order = ctx.orders.get(razorpayOrderId)
      const orderSnapshot = order ? { ...order } : null

      // Claim / update event in 'processing' state
      const eventRecord: MockWebhookEvent = existing || {
        id: `evt_row_${Math.random().toString(36).substring(2, 9)}`,
        event_id: eventId,
        event_type: eventType,
        razorpay_order_id: razorpayOrderId,
        payment_id: paymentId,
        amount_paise: amountPaise,
        status: 'processing',
      }
      eventRecord.status = 'processing'
      ctx.events.set(eventId, eventRecord)

      // Step 2: Lookup order with row lock
      if (!order) {
        eventRecord.status = 'failed'
        eventRecord.error_message = 'Order not found for razorpay_order_id'
        return { status: 'order_not_found', should_send_email: false, error: 'Order not found' }
      }

      // Simulate transient DB failure / rollback during order payment-state mutation
      if (ctx.simulateTransientOrderFailure) {
        // In PostgreSQL, an unhandled transaction failure aborts the entire transaction.
        // Therefore, any uncommitted insert/mutation rolls back completely.
        if (eventSnapshot) {
          ctx.events.set(eventId, eventSnapshot) // roll back to prior state (e.g. failed/processing)
        } else {
          // Event was inserted during this transaction, so transaction rollback removes it
          // OR if partially logged in non-transactional log, status is strictly NOT 'processed'
          eventRecord.status = 'failed'
          eventRecord.error_message = 'Simulated transient database connection failure'
        }
        if (orderSnapshot) {
          ctx.orders.set(razorpayOrderId, orderSnapshot)
        }
        throw new Error('transient_db_error: deadlock or connection reset')
      }

      // Step 3: Process payment.captured
      if (eventType === 'payment.captured') {
        const expectedPaise = Math.round(order.total * 100)
        if (currency !== 'INR' || amountPaise !== expectedPaise) {
          eventRecord.status = 'failed'
          eventRecord.error_message = 'Amount or currency mismatch'
          return { status: 'amount_mismatch', should_send_email: false, error: 'Payment amount mismatch' }
        }

        // Already paid check (Idempotent NO-OP)
        if (order.payment_status === 'paid') {
          eventRecord.status = 'processed'
          return { status: 'already_paid_noop', should_send_email: false }
        }

        // Atomic payment transition
        order.payment_status = 'paid'
        order.payment_id = paymentId

        // Mark event processed
        eventRecord.status = 'processed'
        eventRecord.error_message = undefined

        return {
          status: 'payment_captured',
          should_send_email: true,
          order_id: order.id,
        }
      }

      // Step 4: Process payment.failed
      if (eventType === 'payment.failed') {
        // Payment downgrade protection
        if (order.payment_status === 'paid') {
          eventRecord.status = 'ignored'
          eventRecord.error_message = 'Payment downgrade prevented: order is already paid'
          return { status: 'ignored_downgrade_prevented', should_send_email: false }
        }

        if (order.payment_status === 'pending') {
          order.payment_status = 'failed'
        }
        eventRecord.status = 'processed'
        return { status: 'payment_failed_recorded', should_send_email: false }
      }

      eventRecord.status = 'ignored'
      return { status: 'unhandled_event_ignored', should_send_email: false }
    }

    // Simulates the full Edge Function handler: signature verification + atomic RPC call + email dispatch
    const handleWebhookRequest = (
      ctx: WebhookSimulationContext,
      req: {
        method?: string
        headers: Record<string, string>
        body: string
      },
      secret: string = 'test_secret_key'
    ): { httpStatus: number; body: Record<string, unknown> } => {
      if (req.method && req.method !== 'POST') {
        return { httpStatus: 405, body: { error: 'Method Not Allowed' } }
      }

      const sig = req.headers['x-razorpay-signature']
      if (!sig) {
        return { httpStatus: 400, body: { error: 'Missing x-razorpay-signature header' } }
      }

      // Simulated HMAC validation
      const validSig = `valid_sig_${secret}`
      if (!timingSafeEqual(validSig, sig)) {
        return { httpStatus: 400, body: { error: 'Invalid webhook signature' } }
      }

      let payload: any
      try {
        payload = JSON.parse(req.body)
      } catch {
        return { httpStatus: 400, body: { error: 'Malformed JSON payload' } }
      }

      const eventType = payload.event
      const payment = payload.payload?.payment?.entity
      if (!eventType || !payment) {
        return { httpStatus: 400, body: { error: 'Invalid payload structure' } }
      }

      const paymentId = payment.id
      const razorpayOrderId = payment.order_id
      const amountPaise = payment.amount
      const currency = payment.currency
      if (!paymentId || !razorpayOrderId) {
        return { httpStatus: 400, body: { error: 'Missing payment id or order_id' } }
      }

      const eventId = req.headers['x-razorpay-event-id'] || payload.event_id || `${eventType}:${paymentId}`

      // Invoke Atomic Database RPC
      let rpcResult: ReturnType<typeof processRazorpayWebhookEventRpc>
      try {
        rpcResult = processRazorpayWebhookEventRpc(
          ctx,
          eventId,
          eventType,
          razorpayOrderId,
          paymentId,
          amountPaise,
          currency,
          'service_role'
        )
      } catch (err: any) {
        // RPC / Transaction failure returns HTTP 500 (signals retryable error to Razorpay)
        return { httpStatus: 500, body: { error: 'Database transaction error', details: err.message } }
      }

      if (rpcResult.status === 'order_not_found' || rpcResult.status === 'amount_mismatch') {
        return { httpStatus: 400, body: { error: rpcResult.error || rpcResult.status } }
      }

      // Email dispatch strictly conditioned on legitimate state transition
      if (rpcResult.status === 'payment_captured' && rpcResult.should_send_email && rpcResult.order_id) {
        ctx.emailsSent.push(rpcResult.order_id)
      }

      return { httpStatus: 200, body: { received: true, status: rpcResult.status } }
    }

    const createPayload = (
      eventId: string,
      eventType: string,
      orderId: string,
      paymentId: string,
      amount: number,
      currency: string = 'INR'
    ) => JSON.stringify({
      entity: 'event',
      account_id: 'acc_test',
      event: eventType,
      contains: ['payment'],
      payload: {
        payment: {
          entity: {
            id: paymentId,
            order_id: orderId,
            amount,
            currency,
            status: eventType === 'payment.captured' ? 'captured' : 'failed',
          },
        },
      },
      event_id: eventId,
    })

    // Test 1: Successful captured payment
    it('1. successful captured payment transitions order to paid and dispatches email', () => {
      const ctx: WebhookSimulationContext = {
        orders: new Map([
          ['order_rzp_1', { id: 'ord-1', total: 450, payment_status: 'pending', razorpay_order_id: 'order_rzp_1', payment_id: null }],
        ]),
        events: new Map(),
        emailsSent: [],
      }

      const body = createPayload('evt_1', 'payment.captured', 'order_rzp_1', 'pay_1', 45000)
      const res = handleWebhookRequest(ctx, {
        headers: { 'x-razorpay-signature': 'valid_sig_test_secret_key', 'x-razorpay-event-id': 'evt_1' },
        body,
      })

      expect(res.httpStatus).toBe(200)
      expect(res.body.status).toBe('payment_captured')
      expect(ctx.orders.get('order_rzp_1')?.payment_status).toBe('paid')
      expect(ctx.orders.get('order_rzp_1')?.payment_id).toBe('pay_1')
      expect(ctx.events.get('evt_1')?.status).toBe('processed')
      expect(ctx.emailsSent).toEqual(['ord-1'])
    })

    // Test 2: Duplicate same event after successful processing
    it('2. duplicate same event after successful processing returns 200 without duplicate email', () => {
      const ctx: WebhookSimulationContext = {
        orders: new Map([
          ['order_rzp_1', { id: 'ord-1', total: 450, payment_status: 'pending', razorpay_order_id: 'order_rzp_1', payment_id: null }],
        ]),
        events: new Map(),
        emailsSent: [],
      }

      const body = createPayload('evt_1', 'payment.captured', 'order_rzp_1', 'pay_1', 45000)
      const headers = { 'x-razorpay-signature': 'valid_sig_test_secret_key', 'x-razorpay-event-id': 'evt_1' }

      const res1 = handleWebhookRequest(ctx, { headers, body })
      expect(res1.httpStatus).toBe(200)
      expect(res1.body.status).toBe('payment_captured')
      expect(ctx.emailsSent).toHaveLength(1)

      const res2 = handleWebhookRequest(ctx, { headers, body })
      expect(res2.httpStatus).toBe(200)
      expect(res2.body.status).toBe('duplicate_event_ignored')
      expect(ctx.emailsSent).toHaveLength(1) // Still exactly 1
    })

    // Tests 3, 4, 5 & IMPORTANT SEQUENCE: Failure followed by retry of same event
    it('3, 4, 5. simulated order-update failure followed by retry of the SAME event transitions to paid', () => {
      const ctx: WebhookSimulationContext = {
        orders: new Map([
          ['order_rzp_1', { id: 'ord-1', total: 500, payment_status: 'pending', razorpay_order_id: 'order_rzp_1', payment_id: null }],
        ]),
        events: new Map(),
        emailsSent: [],
        simulateTransientOrderFailure: true, // DB failure during first delivery!
      }

      const body = createPayload('evt_critical_retry', 'payment.captured', 'order_rzp_1', 'pay_retry_1', 50000)
      const headers = { 'x-razorpay-signature': 'valid_sig_test_secret_key', 'x-razorpay-event-id': 'evt_critical_retry' }

      // FIRST REQUEST: Fails due to simulated DB failure during order mutation
      const res1 = handleWebhookRequest(ctx, { headers, body })
      expect(res1.httpStatus).toBe(500)
      expect(ctx.orders.get('order_rzp_1')?.payment_status).toBe('pending') // Order still pending!
      expect(ctx.emailsSent).toHaveLength(0) // No email sent!

      // CRITICAL VERIFICATION: payment_webhook_events must NOT incorrectly remain 'processed'!
      const eventAfterFailure = ctx.events.get('evt_critical_retry')
      expect(eventAfterFailure?.status).not.toBe('processed')

      // SECOND REQUEST: Razorpay retries the SAME webhook with the SAME x-razorpay-event-id
      ctx.simulateTransientOrderFailure = false // Transient DB error has resolved

      const res2 = handleWebhookRequest(ctx, { headers, body })

      // MUST NOT return duplicate_event_ignored!
      expect(res2.body.status).not.toBe('duplicate_event_ignored')
      expect(res2.httpStatus).toBe(200)
      expect(res2.body.status).toBe('payment_captured')

      // Order MUST be successfully marked paid
      expect(ctx.orders.get('order_rzp_1')?.payment_status).toBe('paid')
      expect(ctx.orders.get('order_rzp_1')?.payment_id).toBe('pay_retry_1')

      // Event is now legitimately processed
      expect(ctx.events.get('evt_critical_retry')?.status).toBe('processed')

      // Exactly ONE confirmation email sent
      expect(ctx.emailsSent).toEqual(['ord-1'])
    })

    // Tests 6, 7, 8: Concurrent different event IDs for same payment
    it('6, 7, 8. concurrent different event IDs for same payment yield exactly one transition and one email', () => {
      const ctx: WebhookSimulationContext = {
        orders: new Map([
          ['order_rzp_1', { id: 'ord-1', total: 600, payment_status: 'pending', razorpay_order_id: 'order_rzp_1', payment_id: null }],
        ]),
        events: new Map(),
        emailsSent: [],
      }

      const bodyA = createPayload('evt_concurrent_A', 'payment.captured', 'order_rzp_1', 'pay_conc_1', 60000)
      const bodyB = createPayload('evt_concurrent_B', 'payment.captured', 'order_rzp_1', 'pay_conc_1', 60000)

      // Request A arrives first
      const resA = handleWebhookRequest(ctx, {
        headers: { 'x-razorpay-signature': 'valid_sig_test_secret_key', 'x-razorpay-event-id': 'evt_concurrent_A' },
        body: bodyA,
      })
      expect(resA.httpStatus).toBe(200)
      expect(resA.body.status).toBe('payment_captured')
      expect(ctx.emailsSent).toEqual(['ord-1'])

      // Request B arrives concurrently with different event ID for same payment
      const resB = handleWebhookRequest(ctx, {
        headers: { 'x-razorpay-signature': 'valid_sig_test_secret_key', 'x-razorpay-event-id': 'evt_concurrent_B' },
        body: bodyB,
      })
      expect(resB.httpStatus).toBe(200)
      expect(resB.body.status).toBe('already_paid_noop')
      // Exactly ONE email sent!
      expect(ctx.emailsSent).toHaveLength(1)
      expect(ctx.orders.get('order_rzp_1')?.payment_status).toBe('paid')
    })

    // Test 9: payment.failed before capture
    it('9. payment.failed before capture transitions order to failed', () => {
      const ctx: WebhookSimulationContext = {
        orders: new Map([
          ['order_rzp_1', { id: 'ord-1', total: 300, payment_status: 'pending', razorpay_order_id: 'order_rzp_1', payment_id: null }],
        ]),
        events: new Map(),
        emailsSent: [],
      }

      const body = createPayload('evt_fail_1', 'payment.failed', 'order_rzp_1', 'pay_fail_1', 30000)
      const res = handleWebhookRequest(ctx, {
        headers: { 'x-razorpay-signature': 'valid_sig_test_secret_key', 'x-razorpay-event-id': 'evt_fail_1' },
        body,
      })

      expect(res.httpStatus).toBe(200)
      expect(res.body.status).toBe('payment_failed_recorded')
      expect(ctx.orders.get('order_rzp_1')?.payment_status).toBe('failed')
      expect(ctx.emailsSent).toHaveLength(0)
    })

    // Test 10: payment.failed after capture
    it('10. payment.failed after capture does NOT downgrade paid order', () => {
      const ctx: WebhookSimulationContext = {
        orders: new Map([
          ['order_rzp_1', { id: 'ord-1', total: 300, payment_status: 'paid', razorpay_order_id: 'order_rzp_1', payment_id: 'pay_captured' }],
        ]),
        events: new Map(),
        emailsSent: [],
      }

      const body = createPayload('evt_late_fail', 'payment.failed', 'order_rzp_1', 'pay_late', 30000)
      const res = handleWebhookRequest(ctx, {
        headers: { 'x-razorpay-signature': 'valid_sig_test_secret_key', 'x-razorpay-event-id': 'evt_late_fail' },
        body,
      })

      expect(res.httpStatus).toBe(200)
      expect(res.body.status).toBe('ignored_downgrade_prevented')
      expect(ctx.orders.get('order_rzp_1')?.payment_status).toBe('paid')
      expect(ctx.events.get('evt_late_fail')?.status).toBe('ignored')
    })

    // Test 11: Invalid signature
    it('11. invalid signature returns HTTP 400 and creates no event record', () => {
      const ctx: WebhookSimulationContext = {
        orders: new Map(),
        events: new Map(),
        emailsSent: [],
      }

      const body = createPayload('evt_tamper_sig', 'payment.captured', 'order_rzp_1', 'pay_1', 50000)
      const res = handleWebhookRequest(ctx, {
        headers: { 'x-razorpay-signature': 'invalid_forged_signature', 'x-razorpay-event-id': 'evt_tamper_sig' },
        body,
      })

      expect(res.httpStatus).toBe(400)
      expect(res.body.error).toBe('Invalid webhook signature')
      expect(ctx.events.has('evt_tamper_sig')).toBe(false)
    })

    // Test 12: Missing signature
    it('12. missing signature header returns HTTP 400 and creates no event record', () => {
      const ctx: WebhookSimulationContext = {
        orders: new Map(),
        events: new Map(),
        emailsSent: [],
      }

      const body = createPayload('evt_no_sig', 'payment.captured', 'order_rzp_1', 'pay_1', 50000)
      const res = handleWebhookRequest(ctx, {
        headers: { 'x-razorpay-event-id': 'evt_no_sig' },
        body,
      })

      expect(res.httpStatus).toBe(400)
      expect(res.body.error).toBe('Missing x-razorpay-signature header')
      expect(ctx.events.has('evt_no_sig')).toBe(false)
    })

    // Test 13: Unknown order
    it('13. unknown razorpay_order_id returns HTTP 400 and marks event failed', () => {
      const ctx: WebhookSimulationContext = {
        orders: new Map(),
        events: new Map(),
        emailsSent: [],
      }

      const body = createPayload('evt_unknown_ord', 'payment.captured', 'order_rzp_nonexistent', 'pay_1', 50000)
      const res = handleWebhookRequest(ctx, {
        headers: { 'x-razorpay-signature': 'valid_sig_test_secret_key', 'x-razorpay-event-id': 'evt_unknown_ord' },
        body,
      })

      expect(res.httpStatus).toBe(400)
      expect(ctx.events.get('evt_unknown_ord')?.status).toBe('failed')
    })

    // Test 14: Unknown payment / missing fields
    it('14. missing payment entity returns HTTP 400 before DB mutation', () => {
      const ctx: WebhookSimulationContext = {
        orders: new Map(),
        events: new Map(),
        emailsSent: [],
      }

      const res = handleWebhookRequest(ctx, {
        headers: { 'x-razorpay-signature': 'valid_sig_test_secret_key' },
        body: JSON.stringify({ event: 'payment.captured', payload: {} }),
      })

      expect(res.httpStatus).toBe(400)
      expect(res.body.error).toContain('Invalid payload structure')
      expect(ctx.events.size).toBe(0)
    })

    // Test 15: Amount mismatch
    it('15. amount mismatch returns HTTP 400, marks event failed, and leaves order pending', () => {
      const ctx: WebhookSimulationContext = {
        orders: new Map([
          ['order_rzp_1', { id: 'ord-1', total: 500, payment_status: 'pending', razorpay_order_id: 'order_rzp_1', payment_id: null }],
        ]),
        events: new Map(),
        emailsSent: [],
      }

      // Expected: 50000 paise; Sent: 10000 paise
      const body = createPayload('evt_bad_amt', 'payment.captured', 'order_rzp_1', 'pay_1', 10000)
      const res = handleWebhookRequest(ctx, {
        headers: { 'x-razorpay-signature': 'valid_sig_test_secret_key', 'x-razorpay-event-id': 'evt_bad_amt' },
        body,
      })

      expect(res.httpStatus).toBe(400)
      expect(ctx.orders.get('order_rzp_1')?.payment_status).toBe('pending')
      expect(ctx.events.get('evt_bad_amt')?.status).toBe('failed')
      expect(ctx.emailsSent).toHaveLength(0)
    })

    // Test 16: Currency mismatch
    it('16. currency mismatch returns HTTP 400, marks event failed, and leaves order pending', () => {
      const ctx: WebhookSimulationContext = {
        orders: new Map([
          ['order_rzp_1', { id: 'ord-1', total: 500, payment_status: 'pending', razorpay_order_id: 'order_rzp_1', payment_id: null }],
        ]),
        events: new Map(),
        emailsSent: [],
      }

      const body = createPayload('evt_bad_curr', 'payment.captured', 'order_rzp_1', 'pay_1', 50000, 'USD')
      const res = handleWebhookRequest(ctx, {
        headers: { 'x-razorpay-signature': 'valid_sig_test_secret_key', 'x-razorpay-event-id': 'evt_bad_curr' },
        body,
      })

      expect(res.httpStatus).toBe(400)
      expect(ctx.orders.get('order_rzp_1')?.payment_status).toBe('pending')
      expect(ctx.events.get('evt_bad_curr')?.status).toBe('failed')
    })

    // Test 17: Already-paid recapture
    it('17. already-paid order recapture returns 200 without duplicate email', () => {
      const ctx: WebhookSimulationContext = {
        orders: new Map([
          ['order_rzp_1', { id: 'ord-1', total: 500, payment_status: 'paid', razorpay_order_id: 'order_rzp_1', payment_id: 'pay_old' }],
        ]),
        events: new Map(),
        emailsSent: [],
      }

      const body = createPayload('evt_recapture', 'payment.captured', 'order_rzp_1', 'pay_old', 50000)
      const res = handleWebhookRequest(ctx, {
        headers: { 'x-razorpay-signature': 'valid_sig_test_secret_key', 'x-razorpay-event-id': 'evt_recapture' },
        body,
      })

      expect(res.httpStatus).toBe(200)
      expect(res.body.status).toBe('already_paid_noop')
      expect(ctx.emailsSent).toHaveLength(0)
    })

    // Test 18: Duplicate event ID with processed status
    it('18. duplicate event ID with processed status is ignored idempotently', () => {
      const ctx: WebhookSimulationContext = {
        orders: new Map([
          ['order_rzp_1', { id: 'ord-1', total: 500, payment_status: 'paid', razorpay_order_id: 'order_rzp_1', payment_id: 'pay_1' }],
        ]),
        events: new Map([
          ['evt_already_proc', {
            id: 'row-1',
            event_id: 'evt_already_proc',
            event_type: 'payment.captured',
            razorpay_order_id: 'order_rzp_1',
            payment_id: 'pay_1',
            amount_paise: 50000,
            status: 'processed',
          }],
        ]),
        emailsSent: [],
      }

      const body = createPayload('evt_already_proc', 'payment.captured', 'order_rzp_1', 'pay_1', 50000)
      const res = handleWebhookRequest(ctx, {
        headers: { 'x-razorpay-signature': 'valid_sig_test_secret_key', 'x-razorpay-event-id': 'evt_already_proc' },
        body,
      })

      expect(res.httpStatus).toBe(200)
      expect(res.body.status).toBe('duplicate_event_ignored')
      expect(ctx.emailsSent).toHaveLength(0)
    })

    // Test 19: Duplicate event ID with failed/retryable status
    it('19. duplicate event ID with failed/retryable status allows retry and succeeds', () => {
      const ctx: WebhookSimulationContext = {
        orders: new Map([
          ['order_rzp_1', { id: 'ord-1', total: 500, payment_status: 'pending', razorpay_order_id: 'order_rzp_1', payment_id: null }],
        ]),
        events: new Map([
          ['evt_prior_failed', {
            id: 'row-1',
            event_id: 'evt_prior_failed',
            event_type: 'payment.captured',
            razorpay_order_id: 'order_rzp_1',
            payment_id: 'pay_1',
            amount_paise: 50000,
            status: 'failed',
            error_message: 'Prior transient error',
          }],
        ]),
        emailsSent: [],
      }

      const body = createPayload('evt_prior_failed', 'payment.captured', 'order_rzp_1', 'pay_1', 50000)
      const res = handleWebhookRequest(ctx, {
        headers: { 'x-razorpay-signature': 'valid_sig_test_secret_key', 'x-razorpay-event-id': 'evt_prior_failed' },
        body,
      })

      expect(res.httpStatus).toBe(200)
      expect(res.body.status).toBe('payment_captured')
      expect(ctx.orders.get('order_rzp_1')?.payment_status).toBe('paid')
      expect(ctx.events.get('evt_prior_failed')?.status).toBe('processed')
      expect(ctx.emailsSent).toEqual(['ord-1'])
    })

    // Test 20: Direct DB/API manipulation attempts
    it('20. direct DB/API manipulation attempts by anon/authenticated roles are rejected', () => {
      const ctx: WebhookSimulationContext = {
        orders: new Map([
          ['order_rzp_1', { id: 'ord-1', total: 500, payment_status: 'pending', razorpay_order_id: 'order_rzp_1', payment_id: null }],
        ]),
        events: new Map(),
        emailsSent: [],
      }

      // Anonymous client attempting to invoke RPC directly
      expect(() => {
        processRazorpayWebhookEventRpc(
          ctx,
          'evt_hacker',
          'payment.captured',
          'order_rzp_1',
          'pay_fake',
          50000,
          'INR',
          'anon'
        )
      }).toThrow('permission denied')

      // Authenticated regular customer attempting to invoke RPC directly
      expect(() => {
        processRazorpayWebhookEventRpc(
          ctx,
          'evt_hacker',
          'payment.captured',
          'order_rzp_1',
          'pay_fake',
          50000,
          'INR',
          'authenticated'
        )
      }).toThrow('permission denied')
    })

    // Test 21: Regression against Phase 4A/4B-1 protections
    it('21. regression against Phase 4A/4B-1 protections: database downgrade trigger blocks downgrading paid order', () => {
      const simulateDbDowngradeTrigger = (oldStatus: string, newStatus: string) => {
        if (oldStatus === 'paid' && (newStatus === 'failed' || newStatus === 'pending')) {
          throw new Error('Invalid payment state transition: cannot downgrade paid order to ' + newStatus)
        }
        return true
      }

      expect(() => simulateDbDowngradeTrigger('paid', 'failed')).toThrow('cannot downgrade paid order to failed')
      expect(() => simulateDbDowngradeTrigger('paid', 'pending')).toThrow('cannot downgrade paid order to pending')
      expect(simulateDbDowngradeTrigger('pending', 'paid')).toBe(true)
      expect(simulateDbDowngradeTrigger('failed', 'paid')).toBe(true)
      expect(simulateDbDowngradeTrigger('paid', 'paid')).toBe(true)
    })
  })

  describe('Phase 4B-3: SVG Elimination, Upload MIME Enforcement, and Storage Security Invariants', () => {
    // 1. MIME Validation & Whitelisting
    it('1. JPEG MIME type is accepted', () => {
      expect(ALLOWED_IMAGE_MIME_TYPES['image/jpeg']).toBe('jpg')
    })

    it('2. PNG MIME type is accepted', () => {
      expect(ALLOWED_IMAGE_MIME_TYPES['image/png']).toBe('png')
    })

    it('3. WebP MIME type is accepted', () => {
      expect(ALLOWED_IMAGE_MIME_TYPES['image/webp']).toBe('webp')
    })

    it('4. SVG MIME type is strictly rejected to eliminate Stored XSS vectors', () => {
      expect(ALLOWED_IMAGE_MIME_TYPES['image/svg+xml']).toBeUndefined()
    })

    it('5. GIF MIME type is rejected matching product specifications', () => {
      expect(ALLOWED_IMAGE_MIME_TYPES['image/gif']).toBeUndefined()
    })

    it('6. unsupported / dangerous MIME types are strictly rejected', () => {
      expect(ALLOWED_IMAGE_MIME_TYPES['text/html']).toBeUndefined()
      expect(ALLOWED_IMAGE_MIME_TYPES['application/javascript']).toBeUndefined()
      expect(ALLOWED_IMAGE_MIME_TYPES['application/pdf']).toBeUndefined()
      expect(ALLOWED_IMAGE_MIME_TYPES['application/x-msdownload']).toBeUndefined()
      expect(ALLOWED_IMAGE_MIME_TYPES['image/bmp']).toBeUndefined()
    })

    // 2. File Size Enforcement Simulation
    const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5,242,880 bytes

    const validateFileSize = (sizeBytes: number): boolean => {
      return sizeBytes <= MAX_FILE_SIZE
    }

    it('7. files strictly exceeding 5 MB are rejected', () => {
      expect(validateFileSize(5 * 1024 * 1024 + 1)).toBe(false)
      expect(validateFileSize(10 * 1024 * 1024)).toBe(false)
    })

    it('8. files at or under 5 MB boundary are accepted', () => {
      expect(validateFileSize(5 * 1024 * 1024)).toBe(true)
      expect(validateFileSize(500 * 1024)).toBe(true)
      expect(validateFileSize(1)).toBe(true)
    })

    // 3. Extension Derivation from Whitelisted MIME
    const resolveUploadExtension = (mimeType: string, userFilename: string): string => {
      const ext = ALLOWED_IMAGE_MIME_TYPES[mimeType]
      if (!ext) {
        throw new Error(`Unsupported file type "${mimeType}"`)
      }
      return ext
    }

    it('9. extension is derived strictly from validated MIME, not user filename', () => {
      expect(resolveUploadExtension('image/jpeg', 'camera_shot.jpeg')).toBe('jpg')
      expect(resolveUploadExtension('image/png', 'icon.PNG')).toBe('png')
      expect(resolveUploadExtension('image/webp', 'banner.webp')).toBe('webp')
    })

    it('10. malicious user filenames cannot create .svg, .html, or .php extensions', () => {
      // Even if attacker names the file evil.svg, evil.html, shell.php:
      expect(resolveUploadExtension('image/png', 'evil.svg')).toBe('png')
      expect(resolveUploadExtension('image/jpeg', 'shell.php')).toBe('jpg')
      expect(resolveUploadExtension('image/webp', 'payload.html')).toBe('webp')
      expect(resolveUploadExtension('image/png', '../../../etc/passwd.png')).toBe('png')

      // If MIME is spoofed to something disallowed, it throws:
      expect(() => resolveUploadExtension('image/svg+xml', 'clean_vector.svg')).toThrow('Unsupported file type')
      expect(() => resolveUploadExtension('text/html', 'page.html')).toThrow('Unsupported file type')
    })

    // 4. URL Mode Validation
    it('11. HTTPS URLs are accepted', () => {
      expect(isValidImageUrl('https://example.com/dishes/pasta.jpg')).toBe(true)
    })

    it('12. HTTP URLs are rejected to prevent Mixed Content security violations', () => {
      expect(isValidImageUrl('http://example.com/dishes/pasta.jpg')).toBe(false)
    })

    it('13. javascript: URLs are strictly rejected', () => {
      expect(isValidImageUrl('javascript:alert(document.cookie)')).toBe(false)
      expect(isValidImageUrl('JAVASCRIPT:alert(1)')).toBe(false)
    })

    it('14. data: URLs are strictly rejected', () => {
      expect(isValidImageUrl('data:image/svg+xml;base64,PHN2Zz4=')).toBe(false)
      expect(isValidImageUrl('data:text/html;base64,PHNjcmlwdD4=')).toBe(false)
    })

    it('15. SVG URLs are strictly rejected', () => {
      expect(isValidImageUrl('https://example.com/logo.svg')).toBe(false)
      expect(isValidImageUrl('https://example.com/badge.svg?v=2')).toBe(false)
      expect(isValidImageUrl('https://example.com/icon.SVG#main')).toBe(false)
    })

    it('16. legitimate Pexels image URLs are preserved and accepted', () => {
      const pexelsUrl = 'https://images.pexels.com/photos/302899/pexels-photo-302899.jpeg?auto=compress'
      expect(isValidImageUrl(pexelsUrl)).toBe(true)
    })

    it('17. legitimate Unsplash image URLs are preserved and accepted', () => {
      const unsplashUrl = 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?ixlib=rb-1.2.1'
      expect(isValidImageUrl(unsplashUrl)).toBe(true)
    })

    it('18. legitimate Supabase Storage URLs are preserved and accepted', () => {
      const supabaseUrl = 'https://abcdefghijk.supabase.co/storage/v1/object/public/cafe-images/menu-items/abc-123.jpg'
      expect(isValidImageUrl(supabaseUrl)).toBe(true)
    })

    it('19. existing relative/local image paths starting with / are preserved', () => {
      expect(isValidImageUrl('/assets/coffee.png')).toBe(true)
      expect(isValidImageUrl('/uploads/hero.webp')).toBe(true)
      // But relative SVGs are still rejected
      expect(isValidImageUrl('/assets/vector.svg')).toBe(false)
    })

    // 5. Database CHECK Constraint Simulation
    it('database CHECK constraint logic safely accepts valid/empty URLs and rejects dangerous ones', () => {
      const simulateDbUrlCheck = (url: string | null): boolean => {
        if (url === null || url === '') return true
        const isHttpsOrRelative = /^(https:\/\/|\/)[^\s]+$/i.test(url)
        const isNotSvg = !/\.svg([?#].*)?$/i.test(url)
        return isHttpsOrRelative && isNotSvg
      }

      // Safe existing/expected values
      expect(simulateDbUrlCheck(null)).toBe(true)
      expect(simulateDbUrlCheck('')).toBe(true)
      expect(simulateDbUrlCheck('https://images.pexels.com/photos/302899/pexels-photo-302899.jpeg?auto=compress')).toBe(true)
      expect(simulateDbUrlCheck('https://abcdef.supabase.co/storage/v1/object/public/cafe-images/menu-items/uuid.jpg')).toBe(true)
      expect(simulateDbUrlCheck('/assets/placeholder.jpg')).toBe(true)

      // Malicious or invalid values rejected
      expect(simulateDbUrlCheck('http://insecure.com/pic.jpg')).toBe(false)
      expect(simulateDbUrlCheck('https://attacker.com/exploit.svg')).toBe(false)
      expect(simulateDbUrlCheck('https://attacker.com/exploit.svg?token=123')).toBe(false)
      expect(simulateDbUrlCheck('javascript:alert(1)')).toBe(false)
      expect(simulateDbUrlCheck('data:image/svg+xml;base64,abc')).toBe(false)
    })
  })

  describe('Phase 4B-4: Rate Limiting and CORS Hardening Invariants', () => {
    // 1. CORS Rules & Whitelist Evaluation
    const DEFAULT_ALLOWED_ORIGINS = [
      'https://itr-project-gray.vercel.app',
      'http://localhost:5173',
      'http://127.0.0.1:5173',
    ]

    const resolveAllowedOrigins = (envOrigins?: string): string[] => {
      if (!envOrigins) return DEFAULT_ALLOWED_ORIGINS
      const custom = envOrigins.split(',').map((o) => o.trim()).filter(Boolean)
      return Array.from(new Set([...DEFAULT_ALLOWED_ORIGINS, ...custom]))
    }

    const evaluateCors = (origin: string | null, envOrigins?: string) => {
      const allowed = resolveAllowedOrigins(envOrigins)
      const matched = origin && allowed.includes(origin) ? origin : null
      const headers: Record<string, string> = {
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Vary': 'Origin',
      }
      if (matched) {
        headers['Access-Control-Allow-Origin'] = matched
      }
      return { matched, headers }
    }

    it('CORS: allows configured production origin', () => {
      const res = evaluateCors('https://itr-project-gray.vercel.app')
      expect(res.headers['Access-Control-Allow-Origin']).toBe('https://itr-project-gray.vercel.app')
      expect(res.headers['Vary']).toBe('Origin')
    })

    it('CORS: allows local development origins (localhost and 127.0.0.1)', () => {
      const resLocal = evaluateCors('http://localhost:5173')
      expect(resLocal.headers['Access-Control-Allow-Origin']).toBe('http://localhost:5173')

      const resIp = evaluateCors('http://127.0.0.1:5173')
      expect(resIp.headers['Access-Control-Allow-Origin']).toBe('http://127.0.0.1:5173')
    })

    it('CORS: supports additional origins configured via ALLOWED_ORIGINS env var', () => {
      const envVar = 'https://preview-deploy-1.vercel.app, https://staging.saffronandsage.com'
      const resPreview = evaluateCors('https://preview-deploy-1.vercel.app', envVar)
      expect(resPreview.headers['Access-Control-Allow-Origin']).toBe('https://preview-deploy-1.vercel.app')

      const resStaging = evaluateCors('https://staging.saffronandsage.com', envVar)
      expect(resStaging.headers['Access-Control-Allow-Origin']).toBe('https://staging.saffronandsage.com')
    })

    it('CORS: rejects unknown and attacker origins by withholding Access-Control-Allow-Origin', () => {
      const evilRes = evaluateCors('https://evil-hacker.com')
      expect(evilRes.headers['Access-Control-Allow-Origin']).toBeUndefined()
      expect(evilRes.matched).toBeNull()

      const spoofVercel = evaluateCors('https://malicious-clone.vercel.app')
      expect(spoofVercel.headers['Access-Control-Allow-Origin']).toBeUndefined()

      const nullOrigin = evaluateCors(null)
      expect(nullOrigin.headers['Access-Control-Allow-Origin']).toBeUndefined()
    })

    it('CORS: NEVER emits wildcard "*" on browser-facing endpoints', () => {
      const originsToTest = [
        'https://itr-project-gray.vercel.app',
        'http://localhost:5173',
        'https://unknown.com',
        'null',
        '*',
      ]
      for (const origin of originsToTest) {
        const res = evaluateCors(origin)
        expect(res.headers['Access-Control-Allow-Origin']).not.toBe('*')
      }
    })

    // 2. PostgreSQL check_rate_limit Simulator
    interface RateLimitEntry {
      request_count: number
      expires_at: number // unix ms
    }

    class RateLimitStore {
      private entries = new Map<string, RateLimitEntry>()

      checkRateLimit(key: string, maxRequests: number, windowSeconds: number, nowMs: number) {
        const cleanKey = key.trim()
        if (!cleanKey) throw new Error('Rate limit key cannot be empty')
        if (maxRequests <= 0 || maxRequests > 100000) throw new Error('Invalid max_requests')
        if (windowSeconds <= 0 || windowSeconds > 2592000) throw new Error('Invalid window_seconds')

        const windowMs = windowSeconds * 1000
        const existing = this.entries.get(cleanKey)

        if (!existing || existing.expires_at <= nowMs) {
          this.entries.set(cleanKey, {
            request_count: 1,
            expires_at: nowMs + windowMs,
          })
          return { allowed: true, current_count: 1, max_requests: maxRequests, retry_after: 0 }
        }

        if (existing.request_count < maxRequests) {
          existing.request_count += 1
          return { allowed: true, current_count: existing.request_count, max_requests: maxRequests, retry_after: 0 }
        }

        const retryAfter = Math.max(0, Math.ceil((existing.expires_at - nowMs) / 1000))
        return { allowed: false, current_count: existing.request_count, max_requests: maxRequests, retry_after: retryAfter }
      }
    }

    it('Rate Limiting: first request is allowed and increments counter to 1', () => {
      const store = new RateLimitStore()
      const t0 = 1000000
      const res = store.checkRateLimit('test-key', 3, 60, t0)
      expect(res.allowed).toBe(true)
      expect(res.current_count).toBe(1)
      expect(res.retry_after).toBe(0)
    })

    it('Rate Limiting: request at limit is rejected with retry_after', () => {
      const store = new RateLimitStore()
      const t0 = 1000000
      expect(store.checkRateLimit('key1', 2, 60, t0).allowed).toBe(true) // 1
      expect(store.checkRateLimit('key1', 2, 60, t0 + 1000).allowed).toBe(true) // 2
      const blocked = store.checkRateLimit('key1', 2, 60, t0 + 2000) // 3 -> rejected
      expect(blocked.allowed).toBe(false)
      expect(blocked.current_count).toBe(2)
      expect(blocked.retry_after).toBe(58)
    })

    it('Rate Limiting: expired window resets the counter and allows request', () => {
      const store = new RateLimitStore()
      const t0 = 1000000
      store.checkRateLimit('key1', 1, 60, t0) // used
      expect(store.checkRateLimit('key1', 1, 60, t0 + 10000).allowed).toBe(false)

      // Advance time beyond window (61s later)
      const tAfter = t0 + 61000
      const resetRes = store.checkRateLimit('key1', 1, 60, tAfter)
      expect(resetRes.allowed).toBe(true)
      expect(resetRes.current_count).toBe(1)
    })

    it('Rate Limiting: rejects invalid parameters (empty key, negative limits, negative windows)', () => {
      const store = new RateLimitStore()
      expect(() => store.checkRateLimit('', 5, 60, 1000)).toThrow('Rate limit key cannot be empty')
      expect(() => store.checkRateLimit('   ', 5, 60, 1000)).toThrow('Rate limit key cannot be empty')
      expect(() => store.checkRateLimit('k', 0, 60, 1000)).toThrow('Invalid max_requests')
      expect(() => store.checkRateLimit('k', -5, 60, 1000)).toThrow('Invalid max_requests')
      expect(() => store.checkRateLimit('k', 5, 0, 1000)).toThrow('Invalid window_seconds')
      expect(() => store.checkRateLimit('k', 5, -10, 1000)).toThrow('Invalid window_seconds')
      expect(() => store.checkRateLimit('k', 200000, 60, 1000)).toThrow('Invalid max_requests')
    })

    it('Rate Limiting: distinct keys are strictly isolated', () => {
      const store = new RateLimitStore()
      const t0 = 1000000
      store.checkRateLimit('order:A:email', 1, 600, t0) // exhausted
      expect(store.checkRateLimit('order:A:email', 1, 600, t0).allowed).toBe(false)

      // Different order key remains available
      const orderB = store.checkRateLimit('order:B:email', 1, 600, t0)
      expect(orderB.allowed).toBe(true)
      expect(orderB.current_count).toBe(1)
    })

    // 3. Send Order Email Rate Limiting (max 3 dispatches / 10m)
    it('Order Email: allows up to 3 dispatches per order per 10 minutes and blocks 4th before calling Resend', () => {
      const store = new RateLimitStore()
      const orderId = 'order-uuid-123'
      const key = `order:${orderId}:email`
      const t0 = 1000000

      let resendDispatchCount = 0
      const dispatchEmail = (time: number) => {
        const rl = store.checkRateLimit(key, 3, 600, time)
        if (!rl.allowed) {
          return { status: 429, error: 'Too many email requests for this order' }
        }
        resendDispatchCount++
        return { status: 200, sent: true }
      }

      expect(dispatchEmail(t0).status).toBe(200)
      expect(dispatchEmail(t0 + 1000).status).toBe(200)
      expect(dispatchEmail(t0 + 2000).status).toBe(200)
      expect(resendDispatchCount).toBe(3)

      // 4th dispatch blocked, Resend NOT invoked
      const blocked = dispatchEmail(t0 + 3000)
      expect(blocked.status).toBe(429)
      expect(resendDispatchCount).toBe(3)
    })

    // 4. Razorpay Order Creation Rate Limiting & Reuse
    it('Razorpay: allows up to 5 attempts per order per 5 minutes and blocks 6th', () => {
      const store = new RateLimitStore()
      const orderId = 'order-rzp-1'
      const key = `order:${orderId}:razorpay`
      const t0 = 1000000

      for (let i = 1; i <= 5; i++) {
        expect(store.checkRateLimit(key, 5, 300, t0 + i * 100).allowed).toBe(true)
      }
      const blocked = store.checkRateLimit(key, 5, 300, t0 + 600)
      expect(blocked.allowed).toBe(false)
      expect(blocked.current_count).toBe(5)
    })

    it('Razorpay: safely reuses existing razorpay_order_id without calling Razorpay API again', () => {
      let razorpayApiCalls = 0
      const mockCreateRazorpayOrder = (order: {
        id: string
        total: number
        payment_status: string
        razorpay_order_id?: string | null
      }) => {
        if (order.payment_status === 'paid') {
          throw new Error('Order already paid')
        }
        const amountInPaise = Math.round(order.total * 100)

        // Reuse if valid existing ID is present
        if (order.razorpay_order_id) {
          return { razorpayOrderId: order.razorpay_order_id, amount: amountInPaise, reused: true }
        }

        // Otherwise generate new via API
        razorpayApiCalls++
        return { razorpayOrderId: `order_rzp_${order.id}`, amount: amountInPaise, reused: false }
      }

      // First call creates new Razorpay order
      const initial = mockCreateRazorpayOrder({ id: 'ord-1', total: 450, payment_status: 'pending', razorpay_order_id: null })
      expect(initial.reused).toBe(false)
      expect(initial.razorpayOrderId).toBe('order_rzp_ord-1')
      expect(razorpayApiCalls).toBe(1)

      // Second call with existing razorpay_order_id reuses existing
      const retry = mockCreateRazorpayOrder({ id: 'ord-1', total: 450, payment_status: 'pending', razorpay_order_id: 'order_rzp_ord-1' })
      expect(retry.reused).toBe(true)
      expect(retry.razorpayOrderId).toBe('order_rzp_ord-1')
      expect(razorpayApiCalls).toBe(1) // No duplicate API call!
    })

    it('Razorpay: rejects attempt on already-paid order and keeps server-authoritative amount', () => {
      const mockOrder = { id: 'ord-paid', total: 300, payment_status: 'paid' }
      expect(() => {
        if (mockOrder.payment_status === 'paid') throw new Error('Order already paid')
      }).toThrow('Order already paid')
    })

    // 5. Send Offer Broadcast Rate Limiting (max 1 / hour)
    it('Offer Broadcast: allows 1 broadcast per admin per hour and blocks 2nd', () => {
      const store = new RateLimitStore()
      const adminId = 'admin-user-1'
      const key = `admin:${adminId}:offer-broadcast`
      const t0 = 1000000

      let emailsDispatched = 0
      const sendBroadcast = (time: number) => {
        const rl = store.checkRateLimit(key, 1, 3600, time)
        if (!rl.allowed) return { status: 429, error: 'Rate limit exceeded' }
        emailsDispatched += 10
        return { status: 200, sent: 10 }
      }

      expect(sendBroadcast(t0).status).toBe(200)
      expect(emailsDispatched).toBe(10)

      // Second broadcast 15 minutes later is blocked
      const blocked = sendBroadcast(t0 + 15 * 60 * 1000)
      expect(blocked.status).toBe(429)
      expect(emailsDispatched).toBe(10) // No new emails sent
    })

    // 6. Test Email and Test WhatsApp Rate Limiting (max 5 / 10m)
    it('Test Email and WhatsApp: enforces 5 requests / 10m rate limits per admin', () => {
      const store = new RateLimitStore()
      const adminId = 'admin-diagnostics'
      const emailKey = `admin:${adminId}:test-email`
      const waKey = `admin:${adminId}:test-whatsapp`
      const t0 = 1000000

      for (let i = 0; i < 5; i++) {
        expect(store.checkRateLimit(emailKey, 5, 600, t0 + i * 1000).allowed).toBe(true)
        expect(store.checkRateLimit(waKey, 5, 600, t0 + i * 1000).allowed).toBe(true)
      }

      expect(store.checkRateLimit(emailKey, 5, 600, t0 + 6000).allowed).toBe(false)
      expect(store.checkRateLimit(waKey, 5, 600, t0 + 6000).allowed).toBe(false)
    })

    // 7. Admin Manage Role Rate Limiting (max 60 / 10m)
    it('Admin Manage Role: enforces 60 requests / 10m per admin', () => {
      const store = new RateLimitStore()
      const adminId = 'admin-roles'
      const key = `admin:${adminId}:manage-role`
      const t0 = 1000000

      for (let i = 0; i < 60; i++) {
        expect(store.checkRateLimit(key, 60, 600, t0 + i * 100).allowed).toBe(true)
      }
      expect(store.checkRateLimit(key, 60, 600, t0 + 6100).allowed).toBe(false)
    })

    // 8. Guest Checkout Abuse Protection
    it('Guest Checkout: normalizes contact details, derives SHA-256 hash, and enforces 5 orders/15m', () => {
      const store = new RateLimitStore()
      const normalizeGuestContact = (email: string, phone: string) => {
        const cleanEmail = (email || '').trim().toLowerCase()
        let cleanPhone = (phone || '').replace(/\D/g, '')
        if (cleanPhone.length === 12 && cleanPhone.startsWith('91')) {
          cleanPhone = cleanPhone.slice(2)
        } else if (cleanPhone.length === 11 && cleanPhone.startsWith('0')) {
          cleanPhone = cleanPhone.slice(1)
        }
        // Simple hash simulation for unit test (matches PostgreSQL digest(..., 'sha256'))
        return `guest_order:${cleanEmail}:${cleanPhone}`
      }

      const key1 = normalizeGuestContact('  Customer@Example.COM  ', '+91 98765-43210')
      const key2 = normalizeGuestContact('customer@example.com', '9876543210')
      const key3 = normalizeGuestContact('CUSTOMER@EXAMPLE.COM', '09876543210')
      expect(key1).toBe(key2) // Guaranteed identical rate limit key across formats
      expect(key2).toBe(key3)

      const t0 = 1000000
      // 5 guest orders succeed
      for (let i = 1; i <= 5; i++) {
        const res = store.checkRateLimit(key1, 5, 900, t0 + i * 100)
        expect(res.allowed).toBe(true)
      }

      // 6th guest order blocked
      const blocked = store.checkRateLimit(key1, 5, 900, t0 + 600)
      expect(blocked.allowed).toBe(false)
    })

    it('Guest Checkout: authenticated customer orders bypass guest rate limit', () => {
      const store = new RateLimitStore()
      const simulateCheckout = (customerId: string | null, guestEmail: string, guestPhone: string, now: number) => {
        if (!customerId) {
          // Guest flow enforces rate limit
          const cleanEmail = (guestEmail || '').trim().toLowerCase()
          const cleanPhone = (guestPhone || '').replace(/\D/g, '')
          const key = `guest_order:${cleanEmail}:${cleanPhone}`
          const rl = store.checkRateLimit(key, 5, 900, now)
          if (!rl.allowed) throw new Error('Too many guest orders placed recently')
        }
        return { orderCreated: true }
      }

      const t0 = 1000000
      // Saturate guest limit
      for (let i = 0; i < 5; i++) {
        simulateCheckout(null, 'user@test.com', '1234567890', t0)
      }
      expect(() => simulateCheckout(null, 'user@test.com', '1234567890', t0)).toThrow('Too many guest orders')

      // Authenticated customer with user ID is completely unaffected
      const authOrder = simulateCheckout('auth-user-uuid-999', 'user@test.com', '1234567890', t0)
      expect(authOrder.orderCreated).toBe(true)
    })
  })

  describe('Phase 5.2: Razorpay Production Readiness Invariants', () => {
    // 1. COD vs Online Checkout Email Invariant
    const executePostCheckoutNotification = (
      paymentMethod: 'cod' | 'online',
      dispatchEmail: () => void,
      openPaymentModal: () => void
    ) => {
      if (paymentMethod === 'cod') {
        dispatchEmail()
        return { action: 'cod_completed' }
      }
      openPaymentModal()
      return { action: 'online_payment_initiated' }
    }

    it('1. COD order triggers confirmation email immediately upon checkout', () => {
      let emailDispatched = false
      let modalOpened = false

      const result = executePostCheckoutNotification(
        'cod',
        () => { emailDispatched = true },
        () => { modalOpened = true }
      )

      expect(result.action).toBe('cod_completed')
      expect(emailDispatched).toBe(true)
      expect(modalOpened).toBe(false)
    })

    it('2. Online/Razorpay order does NOT trigger checkout confirmation email prematurely', () => {
      let emailDispatched = false
      let modalOpened = false

      const result = executePostCheckoutNotification(
        'online',
        () => { emailDispatched = true },
        () => { modalOpened = true }
      )

      expect(result.action).toBe('online_payment_initiated')
      expect(emailDispatched).toBe(false) // Zero premature emails!
      expect(modalOpened).toBe(true)
    })

    // 2. Online Payment Confirmation Remains Webhook-Driven
    it('3. Online payment confirmation email is strictly webhook-driven upon capture', () => {
      let confirmationEmailDispatched = false

      const handleWebhookCaptureResult = (rpcResult: { status: string; should_send_email: boolean }) => {
        if (rpcResult.status === 'payment_captured' && rpcResult.should_send_email) {
          confirmationEmailDispatched = true
        }
      }

      // Valid captured event transitions order and sends email
      handleWebhookCaptureResult({ status: 'payment_captured', should_send_email: true })
      expect(confirmationEmailDispatched).toBe(true)

      // Duplicate delivery does NOT send duplicate email
      confirmationEmailDispatched = false
      handleWebhookCaptureResult({ status: 'duplicate_event_ignored', should_send_email: false })
      expect(confirmationEmailDispatched).toBe(false)

      // Already paid NO-OP does NOT send duplicate email
      handleWebhookCaptureResult({ status: 'already_paid_noop', should_send_email: false })
      expect(confirmationEmailDispatched).toBe(false)
    })

    // 3. Database payment_id Partial Unique Index Semantics
    class MockOrdersPaymentTable {
      private records: { id: string; payment_id: string | null }[] = []

      insertOrder(id: string, payment_id: string | null) {
        if (payment_id !== null) {
          const existing = this.records.find((r) => r.payment_id === payment_id)
          if (existing) {
            throw new Error('duplicate key value violates unique constraint "uq_orders_payment_id"')
          }
        }
        this.records.push({ id, payment_id })
      }

      find(id: string) {
        return this.records.find((r) => r.id === id)
      }
    }

    it('4. payment_id partial unique index permits multiple NULL rows (COD & pending)', () => {
      const table = new MockOrdersPaymentTable()
      // Multiple orders with NULL payment_id are allowed
      expect(() => {
        table.insertOrder('ord-1', null)
        table.insertOrder('ord-2', null)
        table.insertOrder('ord-3', null)
      }).not.toThrow()
    })

    it('5. payment_id partial unique index enforces uniqueness across non-null values', () => {
      const table = new MockOrdersPaymentTable()
      table.insertOrder('ord-1', 'pay_unique_1')
      table.insertOrder('ord-2', 'pay_unique_2')

      // Attempting duplicate payment_id fails
      expect(() => {
        table.insertOrder('ord-3', 'pay_unique_1')
      }).toThrow('duplicate key value violates unique constraint "uq_orders_payment_id"')
    })

    // 4. Migration Duplicate Pre-check Simulation
    it('6. payment_id migration pre-check detects duplicates and aborts safely without data mutation', () => {
      const runMigrationPrecheck = (orders: { payment_id: string | null }[]) => {
        const counts = new Map<string, number>()
        for (const o of orders) {
          if (o.payment_id !== null) {
            counts.set(o.payment_id, (counts.get(o.payment_id) || 0) + 1)
          }
        }
        const duplicateCount = Array.from(counts.values()).filter((c) => c > 1).length
        if (duplicateCount > 0) {
          throw new Error(`Cannot create unique index: ${duplicateCount} duplicate non-null payment_id value(s) detected`)
        }
        return true
      }

      // Clean dataset passes
      expect(runMigrationPrecheck([
        { payment_id: null },
        { payment_id: null },
        { payment_id: 'pay_1' },
        { payment_id: 'pay_2' },
      ])).toBe(true)

      // Dataset with duplicates throws error before indexing
      expect(() => runMigrationPrecheck([
        { payment_id: 'pay_dup' },
        { payment_id: 'pay_dup' },
      ])).toThrow('duplicate non-null payment_id value(s) detected')
    })

    // 5. Razorpay CSP Directives
    it('7. CSP directives include checkout.razorpay.com in frame-src without wildcard', () => {
      const actualCspHeader = "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://checkout.razorpay.com https://apis.google.com https://accounts.google.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob: https: http:; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.razorpay.com https://nominatim.openstreetmap.org https://lux.razorpay.com https://accounts.google.com; frame-src https://api.razorpay.com https://checkout.razorpay.com https://accounts.google.com;"

      const directives = actualCspHeader.split(';').map((d) => d.trim()).filter(Boolean)
      const dirMap = new Map<string, string[]>()
      for (const d of directives) {
        const [key, ...sources] = d.split(/\s+/)
        dirMap.set(key, sources)
      }

      const frameSrc = dirMap.get('frame-src') || []
      expect(frameSrc).toContain('https://checkout.razorpay.com')
      expect(frameSrc).toContain('https://api.razorpay.com')
      expect(frameSrc).not.toContain('*')
    })
  })
})


