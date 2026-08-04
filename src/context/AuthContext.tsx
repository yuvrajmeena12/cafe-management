import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { supabase } from '../lib/supabaseClient'
import type { Profile } from '../types'

interface AuthContextValue {
  profile: Profile | null
  email: string | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signUp: (email: string, password: string, fullName: string, phone: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  isAdmin: boolean
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [email, setEmail] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  async function loadProfile(userId: string, userEmail: string | undefined) {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single()
    setProfile(data as Profile | null)
    setEmail(userEmail ?? null)
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) loadProfile(session.user.id, session.user.email)
      setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) loadProfile(session.user.id, session.user.email)
      else { setProfile(null); setEmail(null) }
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error?.message ?? null }
  }

  async function signUp(email: string, password: string, fullName: string, phone: string) {
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (!error && data.user) {
      await supabase.from('profiles').upsert({
        id: data.user.id,
        full_name: fullName,
        phone,
        role: 'customer',
      })
    }
    return { error: error?.message ?? null }
  }

  async function signOut() {
    await supabase.auth.signOut()
    setProfile(null)
    setEmail(null)
  }

  const isAdmin = profile?.role === 'admin'

  return (
    <AuthContext.Provider value={{ profile, email, loading, signIn, signUp, signOut, isAdmin }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
