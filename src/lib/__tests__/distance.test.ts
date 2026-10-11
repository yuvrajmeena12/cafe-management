import { describe, it, expect } from 'vitest'
import { distanceKm, getDeliveryCharge } from '../distance'
import type { DeliveryChargeTier } from '../../types'

describe('distance.ts utilities', () => {
  describe('distanceKm (Haversine formula)', () => {
    it('returns 0 for identical coordinates', () => {
      const distance = distanceKm(28.6139, 77.2090, 28.6139, 77.2090)
      expect(distance).toBeCloseTo(0, 5)
    })

    it('calculates accurate distance between known coordinates (e.g. Connaught Place to Noida)', () => {
      // New Delhi (28.6139, 77.2090) to Noida Sector 18 (28.5700, 77.3200) ~ 11.9 km
      const distance = distanceKm(28.6139, 77.2090, 28.5700, 77.3200)
      expect(distance).toBeGreaterThan(10)
      expect(distance).toBeLessThan(14)
    })

    it('handles nearby coordinates (sub-kilometer delivery distance)', () => {
      // 500 meters roughly in latitude difference (~0.0045 degrees)
      const distance = distanceKm(28.6139, 77.2090, 28.6184, 77.2090)
      expect(distance).toBeGreaterThan(0.4)
      expect(distance).toBeLessThan(0.6)
    })
  })

  describe('getDeliveryCharge', () => {
    const mockTiers: DeliveryChargeTier[] = [
      { id: 'tier-1', max_km: 3, charge: 20 },
      { id: 'tier-2', max_km: 7, charge: 40 },
      { id: 'tier-3', max_km: 15, charge: 80 },
    ]

    it('returns 0 when no delivery tiers are configured', () => {
      expect(getDeliveryCharge(5, [])).toBe(0)
    })

    it('matches the first tier when distance is within lowest range', () => {
      expect(getDeliveryCharge(1.5, mockTiers)).toBe(20)
      expect(getDeliveryCharge(3.0, mockTiers)).toBe(20)
    })

    it('matches intermediate tiers appropriately', () => {
      expect(getDeliveryCharge(3.1, mockTiers)).toBe(40)
      expect(getDeliveryCharge(7.0, mockTiers)).toBe(40)
      expect(getDeliveryCharge(7.1, mockTiers)).toBe(80)
      expect(getDeliveryCharge(15.0, mockTiers)).toBe(80)
    })

    it('charges the highest tier rate when distance exceeds furthest configured tier', () => {
      // Beyond 15km, falls back to highest tier (80) rather than silently 0
      expect(getDeliveryCharge(20.0, mockTiers)).toBe(80)
      expect(getDeliveryCharge(50.0, mockTiers)).toBe(80)
    })

    it('handles unordered tiers by sorting correctly', () => {
      const unsortedTiers: DeliveryChargeTier[] = [
        { id: 'tier-3', max_km: 15, charge: 80 },
        { id: 'tier-1', max_km: 3, charge: 20 },
        { id: 'tier-2', max_km: 7, charge: 40 },
      ]
      expect(getDeliveryCharge(2, unsortedTiers)).toBe(20)
      expect(getDeliveryCharge(5, unsortedTiers)).toBe(40)
      expect(getDeliveryCharge(12, unsortedTiers)).toBe(80)
    })
  })
})
