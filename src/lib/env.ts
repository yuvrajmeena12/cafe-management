// ============================================================
// Centralized Environment Variable Validation
// Safe validation of required client environment variables.
// Does NOT throw at module evaluation to prevent white screen.
// ============================================================

export interface AppEnv {
  supabaseUrl: string
  supabaseAnonKey: string
}

function validateEnv(): { env: AppEnv; isValid: boolean; errors: string[] } {
  const errors: string[] = []

  const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string) || ''
  const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || ''

  if (!supabaseUrl.trim()) {
    errors.push('VITE_SUPABASE_URL is missing.')
  } else {
    try {
      const parsed = new URL(supabaseUrl)
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        errors.push('VITE_SUPABASE_URL must use http: or https: protocol.')
      }
    } catch {
      errors.push('VITE_SUPABASE_URL is not a valid URL.')
    }
  }

  if (!supabaseAnonKey.trim()) {
    errors.push('VITE_SUPABASE_ANON_KEY is missing.')
  }

  return {
    env: {
      supabaseUrl,
      supabaseAnonKey,
    },
    isValid: errors.length === 0,
    errors,
  }
}

const validationResult = validateEnv()

export const appEnv: AppEnv = validationResult.env
export const isEnvValid: boolean = validationResult.isValid
export const envConfigErrors: string[] = validationResult.errors
