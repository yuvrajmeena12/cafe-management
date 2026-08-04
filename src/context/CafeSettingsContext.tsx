import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { supabase } from '../lib/supabaseClient'
import type { CafeSettings } from '../types'

interface CafeSettingsContextValue {
  settings: Partial<CafeSettings>
  loading: boolean
  refresh: () => void
}

const CafeSettingsContext = createContext<CafeSettingsContextValue | undefined>(undefined)

export function CafeSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Partial<CafeSettings>>({})
  const [loading, setLoading] = useState(true)

  function load() {
    supabase.from('cafe_settings').select('*').eq('id', 1).single().then(({ data }) => {
      if (data) setSettings(data)
      setLoading(false)
    })
  }

  useEffect(() => {
    load()
    const channel = supabase
      .channel('cafe-settings-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cafe_settings' }, load)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  return (
    <CafeSettingsContext.Provider value={{ settings, loading, refresh: load }}>
      {children}
    </CafeSettingsContext.Provider>
  )
}

export function useCafeSettings() {
  const ctx = useContext(CafeSettingsContext)
  if (!ctx) throw new Error('useCafeSettings must be used within CafeSettingsProvider')
  return ctx
}
