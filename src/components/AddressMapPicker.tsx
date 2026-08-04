import { useEffect, useRef, useState } from 'react'
import { MapPin, Loader2, LocateFixed, Search } from 'lucide-react'
import { searchAddress, reverseGeocode } from '../lib/geocoding'

// Default center: Jaipur. Change to your own city's coordinates so the
// map opens somewhere sensible before the customer picks a location.
const DEFAULT_CENTER: [number, number] = [26.9124, 75.7873]

interface Props {
  address: string
  lat: number | null
  lng: number | null
  onChange: (address: string, lat: number, lng: number) => void
}

export default function AddressMapPicker({ address, lat, lng, onChange }: Props) {
  const mapDivRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const markerRef = useRef<any>(null)

  const [query, setQuery] = useState(address)
  const [mapReady, setMapReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    import('leaflet').then((leafletModule) => {
      const L = leafletModule.default
      if (cancelled || !mapDivRef.current) return

      const center: [number, number] = lat && lng ? [lat, lng] : DEFAULT_CENTER

      const map = L.map(mapDivRef.current, { scrollWheelZoom: false }).setView(center, 14)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map)

      const icon = L.icon({
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
      })

      const marker = L.marker(center, { draggable: true, icon }).addTo(map)

      marker.on('dragend', async () => {
        setBusy(true)
        const pos = marker.getLatLng()
        const addr = await reverseGeocode(pos.lat, pos.lng)
        setQuery(addr ?? query)
        onChange(addr ?? query, pos.lat, pos.lng)
        setStatus('Pin updated — this is the exact spot we\'ll deliver to.')
        setBusy(false)
      })

      mapRef.current = map
      markerRef.current = marker

      // Fixes a common Leaflet-in-a-hidden-container sizing glitch
      setTimeout(() => map.invalidateSize(), 200)
      setMapReady(true)
    })

    return () => {
      cancelled = true
      mapRef.current?.remove()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleLocateTyped() {
    if (!query.trim()) {
      setStatus('Type an address first, then tap Locate.')
      return
    }
    setBusy(true)
    setStatus(null)
    const results = await searchAddress(query)
    if (results.length === 0) {
      setStatus("Couldn't find that address — try adding more detail (area, city), or drag the pin manually once the map appears.")
      setBusy(false)
      return
    }
    const best = results[0]
    const position = { lat: parseFloat(best.lat), lng: parseFloat(best.lon) }
    setQuery(best.display_name)
    onChange(best.display_name, position.lat, position.lng)
    mapRef.current?.setView([position.lat, position.lng], 16)
    markerRef.current?.setLatLng([position.lat, position.lng])
    setStatus('Found it — drag the pin below if it\'s not quite right.')
    setBusy(false)
  }

  function handleUseMyLocation() {
    if (!navigator.geolocation) {
      setStatus('Your browser doesn\'t support location detection — please type your address instead.')
      return
    }
    setBusy(true)
    setStatus('Getting your current location...')
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords
        const addr = await reverseGeocode(latitude, longitude)
        setQuery(addr ?? `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`)
        onChange(addr ?? '', latitude, longitude)
        mapRef.current?.setView([latitude, longitude], 16)
        markerRef.current?.setLatLng([latitude, longitude])
        setStatus('Found your location — drag the pin if it needs adjusting.')
        setBusy(false)
      },
      () => {
        setStatus('Could not get your location — check your browser\'s location permission, or type your address instead.')
        setBusy(false)
      }
    )
  }

  return (
    <div>
      <div className="flex gap-2 mb-3">
        <div className="relative flex-1">
          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-sage-400" size={18} />
          <input
            value={query}
            onChange={(e) => { setQuery(e.target.value); onChange(e.target.value, lat ?? 0, lng ?? 0) }}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleLocateTyped())}
            placeholder="Type your full address (house/flat no., street, area, city)"
            className="w-full pl-10 pr-4 py-3 rounded-lg border border-sage-100"
          />
        </div>
        <button
          type="button"
          onClick={handleLocateTyped}
          disabled={busy}
          className="btn-secondary px-4 flex items-center gap-1.5 whitespace-nowrap"
        >
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />} Locate
        </button>
      </div>

      <button
        type="button"
        onClick={handleUseMyLocation}
        disabled={busy}
        className="text-sm text-saffron-600 font-medium flex items-center gap-1.5 mb-3 hover:underline"
      >
        <LocateFixed size={15} /> Use my current location instead
      </button>

      {status && <p className="text-xs text-sage-500 mb-2">{status}</p>}

      <div className="relative rounded-lg overflow-hidden border border-sage-100" style={{ height: 220 }}>
        {!mapReady && (
          <div className="absolute inset-0 bg-sage-50 flex items-center justify-center text-sage-400 text-sm gap-2 z-10">
            <Loader2 size={16} className="animate-spin" /> Loading map...
          </div>
        )}
        <div ref={mapDivRef} className="w-full h-full" />
      </div>

      <p className="text-xs text-sage-400 mt-2">
        Type your address and tap <strong>Locate</strong>, or tap <strong>Use my current location</strong> — then drag the pin to fine-tune the exact spot.
      </p>
    </div>
  )
}
