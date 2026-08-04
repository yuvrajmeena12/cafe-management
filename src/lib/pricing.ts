/**
 * AI Profit Calculator — transparent, explainable pricing formula.
 * No black box: the owner can see exactly why a price was suggested.
 *
 * Logic: start from all real costs (ingredients + packaging + delivery),
 * then work backwards from a target profit margin, accounting for the
 * platform commission and GST that both get taken as a % of the final
 * selling price (not the cost) — which is why a simple cost-plus-margin
 * calculation usually undershoots real profit for restaurants.
 */
export interface ProfitCalcInput {
  itemCost: number // ingredients cost
  packagingCost: number
  deliveryCost: number
  commissionPercent: number // e.g. 25 for a delivery platform's cut
  gstPercent: number // e.g. 5
  desiredMarginPercent: number // e.g. 20 — the % of selling price the owner wants as profit
}

export interface ProfitCalcResult {
  totalCost: number
  suggestedSellingPrice: number
  commissionAmount: number
  gstAmount: number
  expectedProfit: number
  actualMarginPercent: number
}

export function calculateSellingPrice(input: ProfitCalcInput): ProfitCalcResult {
  const totalCost = input.itemCost + input.packagingCost + input.deliveryCost

  const takeRate = (input.commissionPercent + input.gstPercent + input.desiredMarginPercent) / 100
  // Guard against impossible inputs (>=100% taken before cost is even covered)
  const safeTakeRate = Math.min(takeRate, 0.95)

  const rawPrice = totalCost / (1 - safeTakeRate)
  const suggestedSellingPrice = Math.ceil(rawPrice / 5) * 5 // round up to nearest ₹5 for a clean menu price

  const commissionAmount = +(suggestedSellingPrice * (input.commissionPercent / 100)).toFixed(2)
  const gstAmount = +(suggestedSellingPrice * (input.gstPercent / 100)).toFixed(2)
  const expectedProfit = +(suggestedSellingPrice - totalCost - commissionAmount - gstAmount).toFixed(2)
  const actualMarginPercent = +((expectedProfit / suggestedSellingPrice) * 100).toFixed(1)

  return {
    totalCost: +totalCost.toFixed(2),
    suggestedSellingPrice,
    commissionAmount,
    gstAmount,
    expectedProfit,
    actualMarginPercent,
  }
}
