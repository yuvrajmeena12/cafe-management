// Loads the Google Maps JavaScript API (with the Places library) once,
// and reuses it across the app rather than injecting the script twice.

let loadPromise: Promise<void> | null = null

export function loadGoogleMaps(): Promise<void> {
  if (window.google?.maps) return Promise.resolve()
  if (loadPromise) return loadPromise

  loadPromise = new Promise((resolve, reject) => {
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string
    if (!apiKey) {
      reject(new Error('VITE_GOOGLE_MAPS_API_KEY is not set in .env'))
      return
    }

    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed to load Google Maps script'))
    document.head.appendChild(script)
  })

  return loadPromise
}

declare global {
  interface Window {
    google: any
  }
}
