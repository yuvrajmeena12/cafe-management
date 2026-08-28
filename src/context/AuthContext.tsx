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
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single()
    setProfile(data as Profile | null)
    setEmail(userEmail ?? null)
    setIsEmailVerified(!!emailConfirmedAt)
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        loadProfile(session.user.id, session.user.email, session.user.email_confirmed_at)
      }
      setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        loadProfile(session.user.id, session.user.email, session.user.email_confirmed_at)
      } else {
        setProfile(null)
        setEmail(null)
        setIsEmailVerified(false)
      }
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  async function signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      if (error.message.toLowerCase().includes('email not confirmed')) {
        return { error: 'Please verify your email before logging in. Check your inbox for the confirmation link.', needsVerification: true }
      }
      return { error: error.message }
    }

    if (data.user && !data.user.email_confirmed_at && data.session === null) {
      return { error: 'Please verify your email before logging in.', needsVerification: true }
    }

    return { error: null }
  }

  async function signUp(email: string, password: string, fullName: string, phone: string) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/login`,
        data: {
          full_name: fullName,
          phone,
        }
      }
    })

    if (error) return { error: error.message }

    if (data.user) {
      await supabase.from('profiles').upsert({
        id: data.user.id,
        full_name: fullName,
        phone,
        role: 'customer',
      })

      // If Supabase requires email confirmation, session will be null or email_confirmed_at null
      if (!data.session) {
        return { error: null, needsVerification: true }
      }
    }
    return { error: null }
  }

  async function resendVerificationEmail(email: string) {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/login`,
      }
    })
    return { error: error ? error.message : null }
  }

  async function signOut() {
    await supabase.auth.signOut()
    setProfile(null)
    setEmail(null)
    setIsEmailVerified(false)
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
        isAdmin
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
