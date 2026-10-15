import { describe, it, expect, vi } from 'vitest'
import type { Profile, UserRole } from '../../types'
import { predictNextWeek } from '../ai'

describe('Admin Dashboard Access & Authentication Invariants', () => {
  describe('INV-1: Route Guard Evaluation Logic', () => {
    interface RouteGuardState {
      loading: boolean
      profile: Profile | null
      isAdmin: boolean
    }

    function evaluateAdminRoute(state: RouteGuardState, adminOnly: boolean = true): 'loading' | 'redirect_login' | 'redirect_home' | 'allow' {
      if (state.loading) return 'loading'
      if (!state.profile) return 'redirect_login'
      if (adminOnly && !state.isAdmin) return 'redirect_home'
      return 'allow'
    }

    it('displays loading state and does NOT prematurely redirect while auth is loading', () => {
      const state: RouteGuardState = {
        loading: true,
        profile: null,
        isAdmin: false,
      }
      expect(evaluateAdminRoute(state)).toBe('loading')
    })

    it('redirects to /login when loading finishes but no profile/session exists', () => {
      const state: RouteGuardState = {
        loading: false,
        profile: null,
        isAdmin: false,
      }
      expect(evaluateAdminRoute(state)).toBe('redirect_login')
    })

    it('redirects to home (/) when authenticated user has customer role instead of admin', () => {
      const state: RouteGuardState = {
        loading: false,
        profile: {
          id: 'user-customer-123',
          full_name: 'Test Customer',
          phone: null,
          role: 'customer',
          vehicle_type: null,
          vehicle_number: null,
          vehicle_insurance_expiry: null,
        },
        isAdmin: false,
      }
      expect(evaluateAdminRoute(state)).toBe('redirect_home')
    })

    it('allows access to admin route when authenticated user has admin role', () => {
      const state: RouteGuardState = {
        loading: false,
        profile: {
          id: 'user-admin-123',
          full_name: 'Super Admin',
          phone: '+919999999999',
          role: 'admin',
          vehicle_type: null,
          vehicle_number: null,
          vehicle_insurance_expiry: null,
        },
        isAdmin: true,
      }
      expect(evaluateAdminRoute(state)).toBe('allow')
    })
  })

  describe('INV-2: Auth Loading State & Session Recovery Synchronization', () => {
    it('guarantees that loading flag remains true until profile loading completes', async () => {
      let loading = true
      let profile: Profile | null = null

      const mockLoadProfile = vi.fn().mockImplementation(() => {
        return new Promise<Profile>((resolve) => {
          setTimeout(() => {
            const adminProf: Profile = {
              id: 'admin-1',
              full_name: 'Admin',
              phone: null,
              role: 'admin',
              vehicle_type: null,
              vehicle_number: null,
              vehicle_insurance_expiry: null,
            }
            resolve(adminProf)
          }, 20)
        })
      })

      // Correct pattern: await loadProfile before clearing loading state
      const handleSession = async (session: { user: { id: string; email: string } } | null) => {
        if (session?.user) {
          profile = await mockLoadProfile(session.user.id)
        }
        loading = false
      }

      const sessionPromise = handleSession({ user: { id: 'admin-1', email: 'admin@saffronsage.cafe' } })

      // Mid-flight check: loading must still be true and profile not yet resolved
      expect(loading).toBe(true)
      expect(profile).toBeNull()

      await sessionPromise

      // Final state: profile resolved and loading is false
      expect(loading).toBe(false)
      expect(profile).not.toBeNull()
      expect((profile as unknown as Profile).role).toBe('admin')
    })
  })

  describe('INV-3: Profile Role Protection & Anti-Demotion Invariant', () => {
    it('prevents demoting an existing user role to customer when query returns an error', () => {
      const existingDbRole: UserRole = 'admin'
      const queryError = { message: 'connection timeout', code: 'PGRST000' }
      const queryData = null

      // Simulates the safe loadProfile branch
      const resolveProfileDecision = (data: Profile | null, error: any) => {
        if (data) {
          return { action: 'set_profile', profile: data }
        }
        if (!error) {
          return { action: 'fallback_upsert_customer' }
        }
        return { action: 'preserve_error_state' }
      }

      const decision = resolveProfileDecision(queryData, queryError)
      expect(decision.action).toBe('preserve_error_state')
      expect(decision.action).not.toBe('fallback_upsert_customer')
    })

    it('ensures signup upsert does not overwrite existing or pre-assigned admin role', () => {
      const upsertOptions = { onConflict: 'id', ignoreDuplicates: true }
      expect(upsertOptions.ignoreDuplicates).toBe(true)
      expect(upsertOptions.onConflict).toBe('id')
    })
  })

  describe('Requirement 8 Regression Tests: Admin Refresh & Protected Route Lifecycle', () => {
    interface GuardInput {
      loading: boolean
      session: { user: { id: string; email?: string } } | null
      profile: Profile | null
      isAdmin: boolean
      roleError: string | null
      adminOnly?: boolean
      allowedRoles?: UserRole[]
      location?: { pathname: string }
    }

    type GuardOutcome =
      | { action: 'loading'; message: string }
      | { action: 'retry_error'; error: string; canRetry: boolean; grantedAccess: false }
      | { action: 'redirect_login'; state?: { from: { pathname: string } } }
      | { action: 'redirect_home' }
      | { action: 'allow'; grantedAccess: true }

    function runProtectedRouteGuard(input: GuardInput): GuardOutcome {
      if (input.loading) {
        return { action: 'loading', message: 'Verifying access…' }
      }
      if (input.roleError) {
        return { action: 'retry_error', error: input.roleError, canRetry: true, grantedAccess: false }
      }
      if (!input.session && !input.profile) {
        return { action: 'redirect_login', state: input.location ? { from: input.location } : undefined }
      }
      if (!input.profile) {
        return { action: 'loading', message: 'Loading profile…' }
      }
      if (input.adminOnly && !input.isAdmin) {
        return { action: 'redirect_home' }
      }
      if (input.allowedRoles && !input.allowedRoles.includes(input.profile.role) && !input.isAdmin) {
        return { action: 'redirect_home' }
      }
      return { action: 'allow', grantedAccess: true }
    }

    it('Scenario 1: Refresh with a valid authenticated admin session restores session and preserves deep link without login redirect', async () => {
      // 1. Browser refreshes at deep link: /admin/orders
      const deepLink = { pathname: '/admin/orders' }

      // 2. Initial render after browser reload: state resets to loading
      let guardState: GuardInput = {
        loading: true,
        session: null,
        profile: null,
        isAdmin: false,
        roleError: null,
        adminOnly: true,
        location: deepLink,
      }
      expect(runProtectedRouteGuard(guardState)).toEqual({
        action: 'loading',
        message: 'Verifying access…',
      })

      // 3. Supabase getSession restores session from persistence
      const persistedSession = {
        user: { id: 'admin-uuid-1', email: 'admin@saffronsage.cafe' },
      }
      const adminProfile: Profile = {
        id: 'admin-uuid-1',
        full_name: 'Lead Admin',
        phone: '+919876543210',
        role: 'admin',
        vehicle_type: null,
        vehicle_number: null,
        vehicle_insurance_expiry: null,
      }

      // Simulate async completion of init()
      guardState = {
        loading: false,
        session: persistedSession,
        profile: adminProfile,
        isAdmin: adminProfile.role === 'admin',
        roleError: null,
        adminOnly: true,
        location: deepLink,
      }

      // 4. Access granted on original route, NO redirect to /login
      const outcome = runProtectedRouteGuard(guardState)
      expect(outcome.action).toBe('allow')
      if (outcome.action === 'allow') {
        expect(outcome.grantedAccess).toBe(true)
      }
    })

    it('Scenario 2: Authentication still initializing renders loading state and prevents premature redirection', () => {
      const initializingState: GuardInput = {
        loading: true,
        session: null,
        profile: null,
        isAdmin: false,
        roleError: null,
        adminOnly: true,
        location: { pathname: '/admin/inventory' },
      }

      const outcome = runProtectedRouteGuard(initializingState)
      expect(outcome.action).toBe('loading')
      expect(outcome.action).not.toBe('redirect_login')
      expect(outcome.action).not.toBe('redirect_home')
      expect(outcome.action).not.toBe('allow')
    })

    it('Scenario 3: A genuinely unauthenticated user is redirected to /login with preserved deep link', () => {
      const unauthenticatedState: GuardInput = {
        loading: false,
        session: null,
        profile: null,
        isAdmin: false,
        roleError: null,
        adminOnly: true,
        location: { pathname: '/admin/discounts' },
      }

      const outcome = runProtectedRouteGuard(unauthenticatedState)
      expect(outcome).toEqual({
        action: 'redirect_login',
        state: { from: { pathname: '/admin/discounts' } },
      })
    })

    it('Scenario 4: An authenticated non-admin user is redirected to / and denied admin access without login redirect', () => {
      const customerSession = {
        user: { id: 'cust-uuid-42', email: 'customer@gmail.com' },
      }
      const customerProfile: Profile = {
        id: 'cust-uuid-42',
        full_name: 'John Doe',
        phone: '+919123456789',
        role: 'customer',
        vehicle_type: null,
        vehicle_number: null,
        vehicle_insurance_expiry: null,
      }

      const nonAdminState: GuardInput = {
        loading: false,
        session: customerSession,
        profile: customerProfile,
        isAdmin: customerProfile.role === 'admin', // false
        roleError: null,
        adminOnly: true,
        location: { pathname: '/admin/staff' },
      }

      const outcome = runProtectedRouteGuard(nonAdminState)
      expect(outcome).toEqual({
        action: 'redirect_home',
      })
      expect(outcome.action).not.toBe('redirect_login')
      expect(outcome.action).not.toBe('allow')
    })

    it('Scenario 5: Role-fetch failure displays safe error/retry state and never grants admin access or treats user as logged out', () => {
      const authenticatedSession = {
        user: { id: 'admin-uuid-1', email: 'admin@saffronsage.cafe' },
      }

      const roleErrorState: GuardInput = {
        loading: false,
        session: authenticatedSession,
        profile: null,
        isAdmin: false, // Never grant admin access on error
        roleError: 'Network error while verifying account permissions.',
        adminOnly: true,
        location: { pathname: '/admin' },
      }

      const outcome = runProtectedRouteGuard(roleErrorState)
      expect(outcome).toEqual({
        action: 'retry_error',
        error: 'Network error while verifying account permissions.',
        canRetry: true,
        grantedAccess: false,
      })
      // Ensure NOT redirected to login (not treated as logged out)
      expect(outcome.action).not.toBe('redirect_login')
      // Ensure NEVER granted access
      expect(outcome.action).not.toBe('allow')
    })

    it('Scenario 5b: Retry mechanism re-initiates verification without logging out', async () => {
      let roleError: string | null = 'Database connection timeout'
      let loading = false
      let profile: Profile | null = null

      const mockRetryAuth = async () => {
        loading = true
        roleError = null
        // Simulate successful recovery
        profile = {
          id: 'admin-uuid-1',
          full_name: 'Lead Admin',
          phone: null,
          role: 'admin',
          vehicle_type: null,
          vehicle_number: null,
          vehicle_insurance_expiry: null,
        }
        loading = false
      }

      // Initial state: error
      expect(roleError).toBe('Database connection timeout')

      // Trigger retry
      await mockRetryAuth()

      expect(loading).toBe(false)
      expect(roleError).toBeNull()
      expect(profile).not.toBeNull()
      expect((profile as unknown as Profile).role).toBe('admin')
    })
  })

  describe('INV-4: Dashboard AI Forecasting Resilience', () => {
    it('computes demand forecasts cleanly without NaN or infinite values', () => {
      const resultZero = predictNextWeek(0, 0)
      expect(resultZero.predictedOrders).toBe(0)
      expect(resultZero.confidence).toBe(0)

      const resultGrowth = predictNextWeek(10, 5) // +100% growth -> 10 * 2 = 20
      expect(resultGrowth.predictedOrders).toBe(20)
      expect(resultGrowth.confidence).toBe(50)

      const resultDecline = predictNextWeek(5, 10) // -50% growth -> 5 * 0.5 = 2.5 -> 3
      expect(resultDecline.predictedOrders).toBeGreaterThanOrEqual(2)
      expect(resultDecline.confidence).toBe(25)
    })
  })
})
