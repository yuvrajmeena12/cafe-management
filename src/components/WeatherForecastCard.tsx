import { useEffect, useState } from 'react'
import { CloudRain, Sun, Cloud, TrendingUp, TrendingDown } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { fetchTomorrowWeather, getDemandShifts, type WeatherForecast, type DemandShift } from '../lib/weatherForecast'

export default function WeatherForecastCard() {
  const [weather, setWeather] = useState<WeatherForecast | null>(null)
  const [shifts, setShifts] = useState<DemandShift[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'no-location' | 'error'>('loading')

  useEffect(() => {
    supabase.from('cafe_settings').select('address_lat, address_lng').eq('id', 1).single().then(async ({ data }) => {
      if (!data?.address_lat || !data?.address_lng) {
        setStatus('no-location')
        return
      }
      try {
        const forecast = await fetchTomorrowWeather(data.address_lat, data.address_lng)
        setWeather(forecast)
        setShifts(getDemandShifts(forecast.condition))
        setStatus('ready')
      } catch {
        setStatus('error')
      }
    })
  }, [])

  if (status === 'loading') {
    return <div className="card p-6 text-sage-400 text-sm">Loading tomorrow's forecast...</div>
  }

  if (status === 'no-location') {
    return (
      <div className="card p-6 text-sm text-amber-700 bg-amber-50 border border-amber-200">
        Set your cafe's location in <strong>Settings → Cafe Location</strong> to unlock weather-based demand forecasts.
      </div>
    )
  }

  if (status === 'error' || !weather) {
    return <div className="card p-6 text-sage-400 text-sm">Weather forecast is temporarily unavailable — try again shortly.</div>
  }

  const Icon = weather.condition === 'rain' ? CloudRain : weather.condition === 'hot' ? Sun : Cloud

  return (
    <div className="bg-sage-700 text-white rounded-xl p-6">
      <div className="flex items-center gap-3 mb-1">
        <Icon size={24} className="text-saffron-400" />
        <h2 className="font-bold text-lg">AI Forecast</h2>
      </div>
      <p className="text-sage-200 mb-4">{weather.summary}</p>

      {shifts.length === 0 ? (
        <p className="text-sage-300 text-sm">No strong demand shift predicted for tomorrow.</p>
      ) : (
        <div className="space-y-2">
          {shifts.map((s) => (
            <div key={s.category} className="flex items-center justify-between bg-sage-600/50 rounded-lg px-4 py-2.5">
              <span className="text-sm">{s.category}</span>
              <span className={`flex items-center gap-1 font-bold text-sm ${s.changePercent > 0 ? 'text-green-300' : 'text-red-300'}`}>
                {s.changePercent > 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                {s.changePercent > 0 ? '+' : ''}{s.changePercent}%
              </span>
            </div>
          ))}
        </div>
      )}
      <p className="text-xs text-sage-400 mt-3">
        Based on simple, fixed rules (rain → more hot food, less cold drinks) — not a black box, so you can sanity-check it against your own experience.
      </p>
    </div>
  )
}
