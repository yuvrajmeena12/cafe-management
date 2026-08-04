// Free address search + reverse geocoding via OpenStreetMap's Nominatim
// service. No API key, no billing account — just a public HTTP endpoint.
// Fair-use note: Nominatim asks that you don't hammer it with rapid
// requests; the debounce in AddressMapPicker.tsx already handles that.

export interface GeocodeResult {
  display_name: string
  lat: string
  lon: string
}

export async function searchAddress(query: string): Promise<GeocodeResult[]> {
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&countrycodes=in`
  const res = await fetch(url)
  if (!res.ok) return []
  return res.json()
}

export async function reverseGeocode(lat: number, lon: number): Promise<string | null> {
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`
  const res = await fetch(url)
  if (!res.ok) return null
  const data = await res.json()
  return data.display_name ?? null
}
