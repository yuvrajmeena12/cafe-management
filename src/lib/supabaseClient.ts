import { createClient } from '@supabase/supabase-js'

import { appEnv, isEnvValid } from './env'

const effectiveUrl = isEnvValid ? appEnv.supabaseUrl : 'https://unconfigured-supabase-url.local'
const effectiveKey = isEnvValid ? appEnv.supabaseAnonKey : 'unconfigured-placeholder-anon-key'

if (!isEnvValid) {
  // eslint-disable-next-line no-console
  console.warn(
    'Supabase env vars (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY) are missing or not set in environment.'
  )
}

export const supabase = createClient(effectiveUrl, effectiveKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
  },
})
