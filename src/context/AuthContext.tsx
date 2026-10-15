import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabaseClient'
import { sanitizeErrorMessage } from '../lib/validation'
import type { Profile } from '../types'

interface AuthContextValue {
  profile: Profile | null
  session: Session | null
  user: User | null
  email: string | null
  loading: boolean
  isEmailVerified: boolean
  roleError: string | null
  retryAuth: () => Promise<void>
  signIn: (email: string, password: string) => Promise<{ error: string | null; needsVerification?: boolean; role?: string }>
  signUp: (email: string, password: string, fullName: string, phone: string) => Promise<{ error: string | null; needsVerification?: boolean }>
  resendVerificationEmail: (email: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  isAdmin: boolean
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [email, setEmail] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [isEmailVerified, setIsEmailVerified] = useState(false)
  const [roleError, setRoleError] = useState<string | null>(null)

  async function loadProfile(userId: string, userEmail: string | undefined, emailConfirmedAt?: string | null): Promise<Profile | null> {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle()

      if (error) {
        console.error('Error loading profile:', error)
        setRoleError(error.message || 'Failed to verify account permissions.')
        return null
      }

      if (data) {
        const userProfile = data as Profile
        setProfile(userProfile)
        setEmail(userEmail ?? null)
        setIsEmailVerified(!!emailConfirmedAt)
        setRoleError(null)
        try {
          sessionStorage.setItem('saffron_sage_auth_profile', JSON.stringify(userProfile))
        } catch {}
        return userProfile
      } else {
        // Fallback: create default profile row ONLY if DB confirmed 0 rows (no query error)
        const fallbackProfile: Profile = {
          id: userId,
          full_name: userEmail ? userEmail.split('@')[0] : 'Customer',
          phone: null,
          role: 'customer',
          vehicle_type: null,
          vehicle_number: null,
          vehicle_insurance_expiry: null,
        }
        try {
          await supabase.from('profiles').upsert(fallbackProfile, { onConflict: 'id', ignoreDuplicates: true })
        } catch (upsertErr) {
          console.warn('AuthContext: fallback profile upsert failed —', upsertErr)
        }
        setProfile(fallbackProfile)
        setEmail(userEmail ?? null)
        setIsEmailVerified(!!emailConfirmedAt)
        setRoleError(null)
        return fallbackProfile
      }
    } catch (err: any) {
      console.error('Exception loading profile:', err)
      setRoleError(err?.message || 'Network error while verifying account permissions.')
      return null
    }
  }

  async function retryAuth(): Promise<void> {
    setLoading(true)
    setRoleError(null)
    try {
      const { data: { session: activeSession }, error: sessionError } = await supabase.auth.getSession()
      if (sessionError) {
        setRoleError(sessionError.message)
        return
      }
      if (activeSession?.user) {
        setSession(activeSession)
        setUser(activeSession.user)
        setEmail(activeSession.user.email ?? null)
        await loadProfile(activeSession.user.id, activeSession.user.email, activeSession.user.email_confirmed_at)
      } else {
        setSession(null)
        setUser(null)
        setProfile(null)
        setEmail(null)
      }
    } catch (err: any) {
      setRoleError(err?.message || 'Authentication check failed.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let mounted = true
    let initialized = false

    async function init() {
      try {
        const { data: { session: initialSession }, error: sessionError } = await supabase.auth.getSession()
        if (!mounted) return

        if (sessionError) {
          console.error('Failed to get session:', sessionError)
          setRoleError(sessionError.message)
        } else if (initialSession?.user) {
          setSession(initialSession)
          setUser(initialSession.user)
          setEmail(initialSession.user.email ?? null)
          await loadProfile(initialSession.user.id, initialSession.user.email, initialSession.user.email_confirmed_at)
        } else {
          setProfile(null)
          setSession(null)
          setUser(null)
          setEmail(null)
          setIsEmailVerified(false)
        }
      } catch (err: any) {
        if (!mounted) return
        console.error('Session initialization error:', err)
        setRoleError(err?.message || 'Failed to initialize session.')
      } finally {
        if (mounted) {
          initialized = true
          setLoading(false)
        }
      }
    }

    init()

    const { data: listener } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (!mounted) return

      // Avoid race condition: let init() finish the initial getSession & profile load
      if (event === 'INITIAL_SESSION' && !initialized) {
        return
      }

      if (event === 'SIGNED_OUT' || !newSession?.user) {
        setProfile(null)
        setSession(null)
        setUser(null)
        setEmail(null)
        setIsEmailVerified(false)
        setRoleError(null)
        try {
          sessionStorage.removeItem('saffron_sage_auth_profile')
        } catch {}
        if (mounted) setLoading(false)
        return
      }

      setSession(newSession)
      setUser(newSession.user)
      setEmail(newSession.user.email ?? null)

      if (event === 'SIGNED_IN' || event === 'USER_UPDATED' || (event === 'INITIAL_SESSION' && initialized)) {
        await loadProfile(newSession.user.id, newSession.user.email, newSession.user.email_confirmed_at)
      }
      if (mounted) setLoading(false)
    })

    return () => {
      mounted = false
      listener.subscription.unsubscribe()
    }
  }, [])

  async function signIn(emailInput: string, passwordInput: string) {
    try {
      setRoleError(null)
      const cleanEmail = emailInput.trim().toLowerCase()
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: passwordInput,
      })

      if (error) {
        const msg = error.message || ''
        if (msg.toLowerCase().includes('email not confirmed')) {
          return {
            error: 'Please verify your email address. We sent a confirmation link to your inbox.',
            needsVerification: true,
          }
        }
        if (msg.toLowerCase().includes('invalid login credentials')) {
          return { error: 'Incorrect email or password. Please check and try again.' }
        }
        return { error: sanitizeErrorMessage(msg, 'Login failed. Please try again.') }
      }

      let loadedProfile: Profile | null = null
      if (data.session && data.user) {
        setSession(data.session)
        setUser(data.user)
        setEmail(data.user.email ?? null)
        loadedProfile = await loadProfile(data.user.id, data.user.email, data.user.email_confirmed_at)
      } else if (data.user && !data.user.email_confirmed_at) {
        return {
          error: 'Please verify your email address to continue.',
          needsVerification: true,
        }
      }

      return { error: null, role: loadedProfile?.role }
    } catch (err: any) {
      console.error('signIn exception:', err)
      return { error: sanitizeErrorMessage(err?.message, 'Login request failed. Please check your internet connection.') }
    }
  }

  async function signUp(emailInput: string, passwordInput: string, fullName: string, phone: string) {
    try {
      const cleanEmail = emailInput.trim().toLowerCase()
      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password: passwordInput,
        options: {
          emailRedirectTo: `${window.location.origin}/login`,
          data: {
            full_name: fullName.trim(),
            phone: phone.trim(),
          },
        },
      })

      if (error) return { error: sanitizeErrorMessage(error.message) }

      if (data.user) {
        try {
          await supabase.from('profiles').upsert(
            {
              id: data.user.id,
              full_name: fullName.trim(),
              phone: phone.trim(),
              role: 'customer',
            },
            { onConflict: 'id', ignoreDuplicates: true }
          )
        } catch (upsertErr) {
          console.warn('AuthContext: signup profile upsert failed —', upsertErr)
        }

        if (!data.session) {
          return { error: null, needsVerification: true }
        }
      }
      return { error: null }
    } catch (err: any) {
      console.error('signUp exception:', err)
      return { error: sanitizeErrorMessage(err?.message, 'Sign up request failed. Please try again.') }
    }
  }

  async function resendVerificationEmail(emailInput: string) {
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: emailInput.trim().toLowerCase(),
        options: {
          emailRedirectTo: `${window.location.origin}/login`,
        },
      })
      return { error: error ? error.message : null }
    } catch (err: any) {
      return { error: err?.message || 'Failed to resend confirmation email.' }
    }
  }

  async function signOut() {
    try {
      await supabase.auth.signOut()
    } catch (err) {
      console.error('Sign out error:', err)
    } finally {
      setSession(null)
      setUser(null)
      setProfile(null)
      setEmail(null)
      setIsEmailVerified(false)
      setRoleError(null)
      try {
        sessionStorage.removeItem('saffron_sage_auth_profile')
      } catch {}
    }
  }

  const isAdmin = profile?.role === 'admin'

  return (
    <AuthContext.Provider
      value={{
        profile,
        session,
        user,
        email,
        loading,
        isEmailVerified,
        roleError,
        retryAuth,
        signIn,
        signUp,
        resendVerificationEmail,
        signOut,
        isAdmin,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
