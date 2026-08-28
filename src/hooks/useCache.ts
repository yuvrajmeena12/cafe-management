interface CacheEntry<T> {
  data: T
  timestamp: number
}

const memoryCache = new Map<string, CacheEntry<any>>()

export function getCache<T>(key: string, maxAgeMs = 5 * 60 * 1000): T | null {
  try {
    // 1. Try memory
    const mem = memoryCache.get(key)
    const now = Date.now()
    if (mem && now - mem.timestamp < maxAgeMs) {
      return mem.data as T
    }

    // 2. Try sessionStorage
    const stored = sessionStorage.getItem(`cafe_cache_${key}`)
    if (stored) {
      const parsed: CacheEntry<T> = JSON.parse(stored)
      if (now - parsed.timestamp < maxAgeMs) {
        memoryCache.set(key, parsed)
        return parsed.data
      }
    }
  } catch {
    // Storage quota or parsing error fallback
  }
  return null
}

export function setCache<T>(key: string, data: T): void {
  const entry: CacheEntry<T> = { data, timestamp: Date.now() }
  memoryCache.set(key, entry)
  try {
    sessionStorage.setItem(`cafe_cache_${key}`, JSON.stringify(entry))
  } catch {
    // sessionStorage might be restricted or full
  }
}

export function clearCache(key?: string): void {
  if (key) {
    memoryCache.delete(key)
    try {
      sessionStorage.removeItem(`cafe_cache_${key}`)
    } catch {}
  } else {
    memoryCache.clear()
    try {
      Object.keys(sessionStorage).forEach((k) => {
        if (k.startsWith('cafe_cache_')) sessionStorage.removeItem(k)
      })
    } catch {}
  }
}
