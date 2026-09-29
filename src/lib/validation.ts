// ============================================================
// Centralized Validation Utilities
// All input validation helpers used across the application.
// Frontend validation is for UX only — Supabase RLS + Edge
// Functions enforce the real rules server-side.
// ============================================================

/** Validates email format — RFC 5322 simplified, max 254 chars. */
export function isValidEmail(email: string): boolean {
  const trimmed = email.trim()
  if (trimmed.length === 0 || trimmed.length > 254) return false
  return /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/.test(trimmed)
}

/** Validates phone number — accepts optional +, spaces, dashes. Requires 10–15 digits. */
export function isValidPhone(phone: string): boolean {
  const digits = phone.replace(/[^\d]/g, '')
  return digits.length >= 10 && digits.length <= 15
}

/** Validates a display name — 2 to 100 characters, trimmed. */
export function isValidName(name: string): boolean {
  const trimmed = name.trim()
  return trimmed.length >= 2 && trimmed.length <= 100
}

/** Password validation with detailed per-rule errors. */
export function isValidPassword(password: string): { valid: boolean; errors: string[] } {
  const errors: string[] = []
  if (password.length < 6) errors.push('At least 6 characters')
  if (password.length > 72) errors.push('Maximum 72 characters (bcrypt limit)')
  if (!/[A-Z]/.test(password)) errors.push('One uppercase letter')
  if (!/[a-z]/.test(password)) errors.push('One lowercase letter')
  if (!/[0-9]/.test(password)) errors.push('One number')
  return { valid: errors.length === 0, errors }
}

/** Returns a 0–5 strength score with label and Tailwind color class. */
export function getPasswordStrength(password: string): {
  score: number
  label: string
  color: string
} {
  if (!password) return { score: 0, label: '', color: 'bg-sage-200' }

  let score = 0
  if (password.length >= 6) score++
  if (password.length >= 10) score++
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++
  if (/[0-9]/.test(password)) score++
  if (/[^a-zA-Z0-9]/.test(password)) score++

  if (score <= 1) return { score, label: 'Weak', color: 'bg-red-400' }
  if (score <= 2) return { score, label: 'Fair', color: 'bg-orange-400' }
  if (score <= 3) return { score, label: 'Good', color: 'bg-amber-400' }
  if (score <= 4) return { score, label: 'Strong', color: 'bg-green-500' }
  return { score, label: 'Excellent', color: 'bg-emerald-500' }
}

/** Validates a URL string (must be http or https). */
export function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

/**
 * Strips internal/technical details from error messages before
 * showing them to users. Keeps the message if it looks safe;
 * replaces it with a generic fallback if it contains database,
 * stack-trace, or infrastructure keywords.
 */
export function sanitizeErrorMessage(
  message: string | undefined | null,
  fallback = 'Something went wrong. Please try again.'
): string {
  if (!message) return fallback

  const unsafePatterns = [
    /postgres/i,
    /pgrst/i,
    /supabase/i,
    /sql/i,
    /database/i,
    /relation\s/i,
    /column\s/i,
    /constraint/i,
    /duplicate key/i,
    /violates/i,
    /internal server/i,
    /stack trace/i,
    /at\s+\//i,
    /node_modules/i,
    /ECONNREFUSED/i,
    /ETIMEDOUT/i,
    /\.ts:/i,
    /\.js:/i,
    /deno/i,
    /edge function/i,
  ]

  if (unsafePatterns.some((p) => p.test(message))) {
    return fallback
  }
  return message
}
