import { describe, it, expect } from 'vitest'
import { calculateSellingPrice, type ProfitCalcInput } from '../pricing'

describe('pricing.ts utilities', () => {
  it('calculates total cost as sum of item, packaging, and delivery costs', () => {
    const input: ProfitCalcInput = {
      itemCost: 50,
      packagingCost: 10,
      deliveryCost: 20,
      commissionPercent: 15,
      gstPercent: 5,
      desiredMarginPercent: 20,
    }

    const result = calculateSellingPrice(input)
    expect(result.totalCost).toBe(80)
  })

  it('rounds suggested selling price up to the nearest multiple of 5', () => {
    const input: ProfitCalcInput = {
      itemCost: 40,
      packagingCost: 5,
      deliveryCost: 15,
      commissionPercent: 10,
      gstPercent: 5,
      desiredMarginPercent: 15,
    }

    const result = calculateSellingPrice(input)
    expect(result.suggestedSellingPrice % 5).toBe(0)
    expect(result.suggestedSellingPrice).toBeGreaterThan(result.totalCost)
  })

  it('computes commission and GST amounts accurately based on suggested price', () => {
    const input: ProfitCalcInput = {
      itemCost: 100,
      packagingCost: 10,
      deliveryCost: 0,
      commissionPercent: 20,
      gstPercent: 5,
      desiredMarginPercent: 25,
    }

    const result = calculateSellingPrice(input)
    const expectedCommission = +(result.suggestedSellingPrice * 0.20).toFixed(2)
    const expectedGst = +(result.suggestedSellingPrice * 0.05).toFixed(2)

    expect(result.commissionAmount).toBe(expectedCommission)
    expect(result.gstAmount).toBe(expectedGst)
  })

  it('correctly calculates expected profit and actual margin percent', () => {
    const input: ProfitCalcInput = {
      itemCost: 60,
      packagingCost: 8,
      deliveryCost: 12,
      commissionPercent: 18,
      gstPercent: 5,
      desiredMarginPercent: 20,
    }

    const result = calculateSellingPrice(input)
    const manualProfit = +(result.suggestedSellingPrice - result.totalCost - result.commissionAmount - result.gstAmount).toFixed(2)
    expect(result.expectedProfit).toBe(manualProfit)

    const manualMargin = +((result.expectedProfit / result.suggestedSellingPrice) * 100).toFixed(1)
    expect(result.actualMarginPercent).toBe(manualMargin)
  })

  it('guards against impossible take rates (>=100%) with safeTakeRate ceiling (0.95)', () => {
    const extremeInput: ProfitCalcInput = {
      itemCost: 50,
      packagingCost: 5,
      deliveryCost: 5,
      commissionPercent: 60,
      gstPercent: 28,
      desiredMarginPercent: 30, // total take rate = 118%
    }

    const result = calculateSellingPrice(extremeInput)
    expect(Number.isFinite(result.suggestedSellingPrice)).toBe(true)
    expect(result.suggestedSellingPrice).toBeGreaterThan(0)
  })
})
