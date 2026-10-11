// supabase/functions/_shared/cors.ts
// Centralized CORS helper for Supabase Edge Functions.
// Restricts cross-origin requests strictly to known application domains.
// NEVER emits wildcard Access-Control-Allow-Origin: * on browser-facing endpoints.

export const DEFAULT_ALLOWED_ORIGINS = [
  'https://itr-project-gray.vercel.app',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
]

/**
 * Returns allowed origins including any configured via ALLOWED_ORIGINS env var.
 */
export function getAllowedOrigins(): string[] {
  const envOrigins = Deno.env.get('ALLOWED_ORIGINS')
  if (!envOrigins) return DEFAULT_ALLOWED_ORIGINS

  const custom = envOrigins
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean)

  return Array.from(new Set([...DEFAULT_ALLOWED_ORIGINS, ...custom]))
}

/**
 * Evaluates the request Origin header against the whitelist.
 * If permitted, returns exact matched Origin.
 * If not permitted or missing, returns null.
 */
export function matchAllowedOrigin(req: Request): string | null {
  const origin = req.headers.get('Origin')
  if (!origin) return null

  const allowed = getAllowedOrigins()
  return allowed.includes(origin) ? origin : null
}

/**
 * Returns standard CORS response headers for the given request.
 * Omits Access-Control-Allow-Origin if the origin is not whitelisted.
 */
export function getCorsHeaders(req: Request): Record<string, string> {
  const matchedOrigin = matchAllowedOrigin(req)
  const headers: Record<string, string> = {
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Vary': 'Origin',
  }

  if (matchedOrigin) {
    headers['Access-Control-Allow-Origin'] = matchedOrigin
  }

  return headers
}

/**
 * Handles HTTP OPTIONS preflight request.
 * Returns a 200 OK Response if preflight is handled, or null if method is not OPTIONS.
 */
export function handleCorsPreflight(req: Request): Response | null {
  if (req.method !== 'OPTIONS') return null

  const headers = getCorsHeaders(req)
  return new Response('ok', { headers })
}
