import { useEffect, useState } from 'react'
import { Type, Phone, Share2, MapPin, MessageCircle, Loader2 } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { isValidEmail, isValidPhone } from '../../lib/validation'
import ImageUploadField from '../../components/ImageUploadField'
import AddressMapPicker from '../../components/AddressMapPicker'
import type { CafeSettings } from '../../types'

export default function Settings() {
  const [settings, setSettings] = useState<Partial<CafeSettings>>({})
  const [saved, setSaved] = useState(false)
  const [errors, setErrors] = useState<string[]>([])

  const [testPhone, setTestPhone] = useState('')
  const [testStatus, setTestStatus] = useState<string | null>(null)
  const [testing, setTesting] = useState(false)
  const [editingLocation, setEditingLocation] = useState(false)

  useEffect(() => {
    supabase.from('cafe_settings').select('*').eq('id', 1).single().then(({ data }) => {
      if (data) setSettings(data)
    })
  }, [])

  function validate(): string[] {
    const errs: string[] = []
    if (!settings.cafe_name?.trim()) errs.push('Cafe name is required.')
    if (settings.email && !isValidEmail(settings.email)) errs.push('Contact email must include @ and a domain, e.g. name@example.com.')
    if (settings.phone && !isValidPhone(settings.phone)) errs.push('Contact phone number looks invalid.')
    return errs
  }

  async function save() {
    const errs = validate()
    if (errs.length) { setErrors(errs); return }
    setErrors([])
    await supabase.from('cafe_settings').upsert({ ...settings, id: 1 })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  function set(field: keyof CafeSettings, value: string | number) {
    setSettings((s) => ({ ...s, [field]: value }))
  }

  async function sendTestWhatsApp() {
    if (!testPhone.trim()) { setTestStatus('Enter a phone number first.'); return }
    setTesting(true)
    setTestStatus(null)
    const { data, error } = await supabase.functions.invoke('send-test-whatsapp', { body: { phone: testPhone } })
    setTesting(false)
    if (error || data?.error) {
      setTestStatus(`Failed: ${data?.error ?? error?.message ?? 'Unknown error'} — check your Twilio secrets are set and the number has joined your sandbox.`)
      return
    }
    setTestStatus('Sent! Check that WhatsApp number now.')
  }

  return (
    <div className="max-w-3xl">
      <h1 className="font-display text-3xl font-bold text-sage-700 mb-1">Cafe Settings</h1>
      <p className="text-sage-500 mb-6">Customize your cafe name, branding, photos, and contact info — changes go live instantly on the customer site.</p>

      {errors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-600 mb-5">
          <ul className="list-disc list-inside">{errors.map((e) => <li key={e}>{e}</li>)}</ul>
        </div>
      )}

      <div className="card p-6 mb-5 space-y-4">
        <h2 className="font-bold text-sage-700 flex items-center gap-2"><Type size={18} className="text-saffron-500" /> Branding</h2>
        <div>
          <label className="text-sm font-medium text-sage-700 block mb-1">Cafe Name</label>
          <input value={settings.cafe_name ?? ''} onChange={(e) => set('cafe_name', e.target.value)} placeholder="e.g. Saffron & Sage" className="w-full px-4 py-2 rounded-lg border border-sage-100" />
        </div>
        <div>
          <label className="text-sm font-medium text-sage-700 block mb-1">Tagline</label>
          <input value={settings.tagline ?? ''} onChange={(e) => set('tagline', e.target.value)} placeholder="e.g. Eat Healthy, Stay Healthy" className="w-full px-4 py-2 rounded-lg border border-sage-100" />
        </div>

        <ImageUploadField
          label="Logo (shown in navbar and footer)"
          value={settings.logo_url ?? ''}
          onChange={(url) => set('logo_url', url)}
          folder="cafe-settings"
        />

        <ImageUploadField
          label="Hero Image (homepage banner)"
          value={settings.hero_image_url ?? ''}
          onChange={(url) => set('hero_image_url', url)}
          folder="cafe-settings"
        />

        <div>
          <label className="text-sm font-medium text-sage-700 block mb-1">About Text</label>
          <textarea value={settings.about_text ?? ''} onChange={(e) => set('about_text', e.target.value)} rows={3} placeholder="A short paragraph describing your cafe" className="w-full px-4 py-2 rounded-lg border border-sage-100" />
        </div>
      </div>

      <div className="card p-6 mb-5 space-y-4">
        <h2 className="font-bold text-sage-700 flex items-center gap-2"><Phone size={18} className="text-saffron-500" /> Contact Information</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-sage-700 block mb-1">Phone</label>
            <input value={settings.phone ?? ''} onChange={(e) => set('phone', e.target.value)} placeholder="e.g. +91 98765 43210" className="w-full px-4 py-2 rounded-lg border border-sage-100" />
          </div>
          <div>
            <label className="text-sm font-medium text-sage-700 block mb-1">Email</label>
            <input type="email" value={settings.email ?? ''} onChange={(e) => set('email', e.target.value)} placeholder="e.g. hello@yourcafe.com" className="w-full px-4 py-2 rounded-lg border border-sage-100" />
          </div>
        </div>
      </div>

      <div className="card p-6 mb-5 space-y-3">
        <h2 className="font-bold text-sage-700 flex items-center gap-2"><MapPin size={18} className="text-saffron-500" /> Cafe Location</h2>

        {settings.address_lat && settings.address_lng && !editingLocation ? (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-green-700 mb-1">✓ Location confirmed</p>
                <p className="text-sm text-sage-600">{settings.address}</p>
                <p className="text-xs text-sage-400 mt-1">{settings.address_lat.toFixed(5)}, {settings.address_lng.toFixed(5)}</p>
              </div>
              <button onClick={() => setEditingLocation(true)} className="btn-secondary text-sm whitespace-nowrap">Edit Location</button>
            </div>
          </div>
        ) : (
          <>
            <p className="text-sm text-sage-500">
              Type your address and tap Locate, or drag the pin to the exact spot — this is what powers
              accurate delivery charge calculation for every order.
            </p>
            <AddressMapPicker
              address={settings.address ?? ''}
              lat={settings.address_lat ?? null}
              lng={settings.address_lng ?? null}
              onChange={(addr, lat, lng) => setSettings((s) => ({ ...s, address: addr, address_lat: lat, address_lng: lng }))}
            />
            {settings.address_lat && settings.address_lng && (
              <button onClick={() => setEditingLocation(false)} className="btn-primary text-sm">Confirm This Location</button>
            )}
          </>
        )}
      </div>

      <div className="card p-6 mb-5 space-y-4">
        <h2 className="font-bold text-sage-700 flex items-center gap-2"><Share2 size={18} className="text-saffron-500" /> Social Media</h2>
        <input value={settings.facebook_url ?? ''} onChange={(e) => set('facebook_url', e.target.value)} placeholder="Facebook URL" className="w-full px-4 py-2 rounded-lg border border-sage-100" />
        <input value={settings.instagram_url ?? ''} onChange={(e) => set('instagram_url', e.target.value)} placeholder="Instagram URL" className="w-full px-4 py-2 rounded-lg border border-sage-100" />
        <input value={settings.twitter_url ?? ''} onChange={(e) => set('twitter_url', e.target.value)} placeholder="Twitter / X URL" className="w-full px-4 py-2 rounded-lg border border-sage-100" />
      </div>

      <div className="card p-6 mb-5 space-y-3">
        <h2 className="font-bold text-sage-700 flex items-center gap-2"><MessageCircle size={18} className="text-saffron-500" /> Test WhatsApp Connection</h2>
        <p className="text-sm text-sage-500">Send a test message to confirm your Twilio setup is working correctly.</p>
        <div className="flex gap-2">
          <input value={testPhone} onChange={(e) => setTestPhone(e.target.value)} placeholder="e.g. +91 98765 43210" className="flex-1 px-4 py-2 rounded-lg border border-sage-100" />
          <button onClick={sendTestWhatsApp} disabled={testing} className="btn-secondary text-sm flex items-center gap-1.5">
            {testing ? <Loader2 size={14} className="animate-spin" /> : null} Send Test
          </button>
        </div>
        {testStatus && <p className={`text-xs ${testStatus.startsWith('Failed') ? 'text-red-500' : 'text-green-600'}`}>{testStatus}</p>}
      </div>

      <button onClick={save} className="btn-primary">Save Settings</button>
      {saved && <span className="ml-3 text-green-600 text-sm font-medium">Saved!</span>}
    </div>
  )
}
