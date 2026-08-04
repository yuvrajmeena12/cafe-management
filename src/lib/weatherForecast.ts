/**
 * AI Weather-Based Demand Forecast — uses Open-Meteo (free, no API key,
 * no billing account) to get tomorrow's weather, then applies simple,
 * transparent business rules to predict category-level demand shifts.
 * Deliberately rule-based rather than a black-box model, so the owner
 * can see exactly why a prediction was made.
 */

export interface WeatherForecast {
  condition: 'rain' | 'hot' | 'mild'
  maxTempC: number
  rainProbability: number
  summary: string
}

export interface DemandShift {
  category: string
  changePercent: number
}

export async function fetchTomorrowWeather(lat: number, lng: number): Promise<WeatherForecast> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&daily=temperature_2m_max,precipitation_probability_max&timezone=auto&forecast_days=2`
  const res = await fetch(url)
  if (!res.ok) throw new Error('Weather service unavailable')

  const data = await res.json()
  // Index 0 = today, index 1 = tomorrow
  const maxTempC = data.daily.temperature_2m_max[1]
  const rainProbability = data.daily.precipitation_probability_max[1]

  let condition: WeatherForecast['condition'] = 'mild'
  let summary = 'Mild weather expected tomorrow — no strong shift predicted.'

  if (rainProbability >= 50) {
    condition = 'rain'
    summary = `Rain expected tomorrow (${rainProbability}% chance)`
  } else if (maxTempC >= 34) {
    condition = 'hot'
    summary = `Hot day expected tomorrow (${maxTempC.toFixed(0)}°C)`
  }

  return { condition, maxTempC, rainProbability, summary }
}

/**
 * Fixed, explainable adjustment rules — not learned from data, so they
 * stay predictable and easy to sanity-check. Tune these percentages
 * based on what you actually observe at your own cafe over time.
 */
export function getDemandShifts(condition: WeatherForecast['condition']): DemandShift[] {
  if (condition === 'rain') {
    return [
      { category: 'Mains (hot food)', changePercent: 22 },
      { category: 'Breakfast', changePercent: 15 },
      { category: 'Cold Beverages', changePercent: -15 },
    ]
  }
  if (condition === 'hot') {
    return [
      { category: 'Cold Beverages', changePercent: 25 },
      { category: 'Salads', changePercent: 10 },
      { category: 'Mains (heavy food)', changePercent: -10 },
    ]
  }
  return []
}
