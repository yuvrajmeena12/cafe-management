// ============================================================
// Image URL Optimization Utility
// Safely injects width/compression query parameters for known
// public image CDNs (Pexels, Unsplash).
// Leaves Supabase Storage, relative, and unknown URLs untouched.
// ============================================================

/**
 * Optimizes an image URL for thumbnail/card display if it belongs to
 * a recognized public image CDN.
 *
 * @param url The raw image URL string.
 * @param width Desired image width in pixels (defaults to 500).
 * @returns The optimized URL string, or the original URL if not optimizable.
 */
export function optimizeImageUrl(url: string | null | undefined, width = 500): string {
  if (!url || typeof url !== 'string') return ''

  const trimmed = url.trim()
  if (!trimmed) return ''

  // Relative URLs: leave untouched
  if (trimmed.startsWith('/') || !trimmed.includes('://')) {
    return trimmed
  }

  try {
    const parsed = new URL(trimmed)
    const hostname = parsed.hostname.toLowerCase()

    // 1. Pexels CDN (e.g. images.pexels.com)
    if (hostname === 'images.pexels.com' || hostname.endsWith('.pexels.com')) {
      parsed.searchParams.set('auto', 'format,compress')
      parsed.searchParams.set('w', String(width))
      parsed.searchParams.set('q', '80')
      return parsed.toString()
    }

    // 2. Unsplash CDN (e.g. images.unsplash.com)
    if (hostname === 'images.unsplash.com' || hostname.endsWith('.unsplash.com')) {
      parsed.searchParams.set('auto', 'format')
      parsed.searchParams.set('w', String(width))
      parsed.searchParams.set('q', '80')
      return parsed.toString()
    }

    // Supabase Storage or other domains: return unchanged
    return trimmed
  } catch {
    // If URL parsing fails, safely return the original input
    return trimmed
  }
}
