import type { DeliveryChargeTier } from '../types'

/** Haversine formula — straight-line distance in km between two coordinates. */
export function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

/** Finds the cheapest matching tier for a given distance (tiers sorted ascending by max_km). */
export function getDeliveryCharge(km: number, tiers: DeliveryChargeTier[]): number {
  if (tiers.length === 0) return 0
  const sorted = [...tiers].sort((a, b) => a.max_km - b.max_km)
  const match = sorted.find((t) => km <= t.max_km)
  // Beyond the furthest configured tier — charge the highest tier's rate
  // rather than silently giving free delivery for far-away addresses.
  return match ? match.charge : sorted[sorted.length - 1].charge
}
