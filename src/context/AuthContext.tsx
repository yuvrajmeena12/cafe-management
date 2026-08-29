import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { supabase } from '../lib/supabaseClient'
import type { Profile } from '../types'

interface AuthContextValue {
  profile: Profile | null
  email: string | null
  loading: boolean
  isEmailVerified: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null; needsVerification?: boolean }>
  signUp: (email: string, password: string, fullName: string, phone: string) => Promise<{ error: string | null; needsVerification?: boolean }>
  resendVerificationEmail: (email: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  isAdmin: boolean
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [email, setEmail] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [isEmailVerified, setIsEmailVerified] = useState(false)

  async function loadProfile(userId: string, userEmail: string | undefined, emailConfirmedAt?: string | null) {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle()

      if (data) {
        setProfile(data as Profile)
      } else {
        // Fallback: create default profile row if it doesn't exist
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
          await supabase.from('profiles').upsert(fallbackProfile)
        } catch {}
        setProfile(fallbackProfile)
      }
      setEmail(userEmail ?? null)
      setIsEmailVerified(!!emailConfirmedAt)
    } catch (err) {
      console.error('Error loading profile:', err)
      if (userEmail) {
        setProfile({
          id: userId,
          full_name: userEmail.split('@')[0],
          phone: null,
          role: 'customer',
          vehicle_type: null,
          vehicle_number: null,
          vehicle_insurance_expiry: null,
        })
        setEmail(userEmail)
      }
    }
  }

  useEffect(() => {
    let mounted = true

    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        if (!mounted) return
        if (session?.user) {
          loadProfile(session.user.id, session.user.email, session.user.email_confirmed_at)
        }
        setLoading(false)
      })
      .catch((err) => {
        console.error('Failed to get session:', err)
        if (mounted) setLoading(false)
      })

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!mounted) return
      if (session?.user) {
        await loadProfile(session.user.id, session.user.email, session.user.email_confirmed_at)
      } else {
        setProfile(null)
        setEmail(null)
        setIsEmailVerified(false)
      }
      setLoading(false)
    })

    return () => {
      mounted = false
      listener.subscription.unsubscribe()
    }
  }, [])

  async function signIn(emailInput: string, passwordInput: string) {
    try {
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
        return { error: msg }
      }

      if (data.session && data.user) {
        await loadProfile(data.user.id, data.user.email, data.user.email_confirmed_at)
      } else if (data.user && !data.user.email_confirmed_at) {
        return {
          error: 'Please verify your email address to continue.',
          needsVerification: true,
        }
      }

      return { error: null }
    } catch (err: any) {
      console.error('signIn exception:', err)
      return { error: err?.message || 'Login request failed. Please check your internet connection and Supabase settings.' }
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

      if (error) return { error: error.message }

      if (data.user) {
        try {
          await supabase.from('profiles').upsert({
            id: data.user.id,
            full_name: fullName.trim(),
            phone: phone.trim(),
            role: 'customer',
          })
        } catch {}

        if (!data.session) {
          return { error: null, needsVerification: true }
        }
      }
      return { error: null }
    } catch (err: any) {
      console.error('signUp exception:', err)
      return { error: err?.message || 'Sign up request failed. Please try again.' }
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
      setProfile(null)
      setEmail(null)
      setIsEmailVerified(false)
    }
  }

  const isAdmin = profile?.role === 'admin'

  return (
    <AuthContext.Provider
      value={{
        profile,
        email,
        loading,
        isEmailVerified,
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
