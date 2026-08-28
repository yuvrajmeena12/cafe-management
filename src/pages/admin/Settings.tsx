import { useEffect, useState } from 'react'
import { Type, Phone, Share2, MapPin, Mail, Loader2, CheckCircle, Sparkles } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { isValidEmail, isValidPhone } from '../../lib/validation'
import ImageUploadField from '../../components/ImageUploadField'
import AddressMapPicker from '../../components/AddressMapPicker'
import type { CafeSettings } from '../../types'

export default function Settings() {
  const [settings, setSettings] = useState<Partial<CafeSettings>>({})
  const [saved, setSaved] = useState(false)
  const [errors, setErrors] = useState<string[]>([])

  const [testEmail, setTestEmail] = useState('')
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
    if (settings.email && !isValidEmail(settings.email)) errs.push('Contact email must include @ and a domain.')
    if (settings.phone && !isValidPhone(settings.phone)) errs.push('Contact phone number looks invalid.')
    return errs
  }

  async function save() {
    const errs = validate()
    if (errs.length) { setErrors(errs); return }
    setErrors([])
    await supabase.from('cafe_settings').upsert({ ...settings, id: 1 })
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  function set(field: keyof CafeSettings, value: string | number) {
    setSettings((s) => ({ ...s, [field]: value }))
  }

  async function sendTestEmailAction() {
    if (!testEmail.trim() || !isValidEmail(testEmail)) {
      setTestStatus('Enter a valid email address first.')
      return
    }
    setTesting(true)
    setTestStatus(null)
    const { data, error } = await supabase.functions.invoke('send-test-email', {
      body: { email: testEmail.trim() },
    })
    setTesting(false)
    if (error || data?.error) {
      setTestStatus(`Failed: ${data?.error ?? error?.message ?? 'Unknown error'} — verify your RESEND_API_KEY secret in Supabase.`)
      return
    }
    setTestStatus('Test email dispatched! Check the inbox and spam folder.')
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold text-sage-800">Cafe Settings & Branding</h1>
        <p className="text-sage-500 text-sm">Customize cafe metadata, visual branding, contacts, and delivery location</p>
      </div>

      {errors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-sm text-red-600 space-y-1">
          {errors.map((e) => (
            <p key={e}>• {e}</p>
          ))}
        </div>
      )}

      <div className="card p-6 space-y-4">
        <h2 className="font-bold text-lg text-sage-800 flex items-center gap-2">
          <Type size={18} className="text-saffron-500" /> Branding & Identity
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold uppercase text-sage-600 block mb-1">Cafe Name</label>
            <input
              value={settings.cafe_name ?? ''}
              onChange={(e) => set('cafe_name', e.target.value)}
              placeholder="e.g. Saffron & Sage"
              className="w-full px-4 py-2.5 rounded-xl border border-sage-200 focus:ring-2 focus:ring-saffron-400 focus:outline-none text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase text-sage-600 block mb-1">Tagline</label>
            <input
              value={settings.tagline ?? ''}
              onChange={(e) => set('tagline', e.target.value)}
              placeholder="e.g. Eat Healthy, Stay Healthy"
              className="w-full px-4 py-2.5 rounded-xl border border-sage-200 focus:ring-2 focus:ring-saffron-400 focus:outline-none text-sm"
            />
          </div>
        </div>

        <ImageUploadField
          label="Logo (displayed across navbar and invoice headers)"
          value={settings.logo_url ?? ''}
          onChange={(url) => set('logo_url', url)}
          folder="cafe-settings"
        />

        <ImageUploadField
          label="Hero Image (featured homepage showcase banner)"
          value={settings.hero_image_url ?? ''}
          onChange={(url) => set('hero_image_url', url)}
          folder="cafe-settings"
        />

        <div>
          <label className="text-xs font-semibold uppercase text-sage-600 block mb-1">About Text</label>
          <textarea
            value={settings.about_text ?? ''}
            onChange={(e) => set('about_text', e.target.value)}
            rows={3}
            placeholder="A short paragraph describing your cafe"
            className="w-full px-4 py-2.5 rounded-xl border border-sage-200 focus:ring-2 focus:ring-saffron-400 focus:outline-none text-sm"
          />
        </div>
      </div>

      <div className="card p-6 space-y-4">
        <h2 className="font-bold text-lg text-sage-800 flex items-center gap-2">
          <Phone size={18} className="text-saffron-500" /> Contact Information
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold uppercase text-sage-600 block mb-1">Phone</label>
            <input
              value={settings.phone ?? ''}
              onChange={(e) => set('phone', e.target.value)}
              placeholder="e.g. +91 98765 43210"
              className="w-full px-4 py-2.5 rounded-xl border border-sage-200 focus:ring-2 focus:ring-saffron-400 focus:outline-none text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase text-sage-600 block mb-1">Email</label>
            <input
              type="email"
              value={settings.email ?? ''}
              onChange={(e) => set('email', e.target.value)}
              placeholder="e.g. hello@saffronsage.cafe"
              className="w-full px-4 py-2.5 rounded-xl border border-sage-200 focus:ring-2 focus:ring-saffron-400 focus:outline-none text-sm"
            />
          </div>
        </div>
      </div>

      <div className="card p-6 space-y-4">
        <h2 className="font-bold text-lg text-sage-800 flex items-center gap-2">
          <MapPin size={18} className="text-saffron-500" /> Cafe Dispatch Location
        </h2>

        {settings.address_lat && settings.address_lng && !editingLocation ? (
          <div className="bg-green-50/90 border border-green-200 rounded-2xl p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-green-800 flex items-center gap-1.5 mb-1">
                  <CheckCircle size={16} /> Location Pin Confirmed
                </p>
                <p className="text-sm text-sage-700">{settings.address}</p>
                <p className="text-xs text-sage-400 mt-1 font-mono">{settings.address_lat.toFixed(5)}, {settings.address_lng.toFixed(5)}</p>
              </div>
              <button
                onClick={() => setEditingLocation(true)}
                className="btn-secondary text-xs"
              >
                Change Location
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-sage-500">
              Drag the map pin to the exact cafe kitchen location to power accurate distance-based delivery calculations.
            </p>
            <AddressMapPicker
              address={settings.address ?? ''}
              lat={settings.address_lat ?? null}
              lng={settings.address_lng ?? null}
              onChange={(addr, lat, lng) => setSettings((s) => ({ ...s, address: addr, address_lat: lat, address_lng: lng }))}
            />
            {settings.address_lat && settings.address_lng && (
              <button
                onClick={() => setEditingLocation(false)}
                className="btn-primary text-xs"
              >
                Confirm Location Pin
              </button>
            )}
          </div>
        )}
      </div>

      <div className="card p-6 space-y-4">
        <h2 className="font-bold text-lg text-sage-800 flex items-center gap-2">
          <Share2 size={18} className="text-saffron-500" /> Social Presence
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <input
            value={settings.facebook_url ?? ''}
            onChange={(e) => set('facebook_url', e.target.value)}
            placeholder="Facebook URL"
            className="w-full px-4 py-2 rounded-xl border border-sage-200 text-xs focus:ring-2 focus:ring-saffron-400 focus:outline-none"
          />
          <input
            value={settings.instagram_url ?? ''}
            onChange={(e) => set('instagram_url', e.target.value)}
            placeholder="Instagram URL"
            className="w-full px-4 py-2 rounded-xl border border-sage-200 text-xs focus:ring-2 focus:ring-saffron-400 focus:outline-none"
          />
          <input
            value={settings.twitter_url ?? ''}
            onChange={(e) => set('twitter_url', e.target.value)}
            placeholder="Twitter / X URL"
            className="w-full px-4 py-2 rounded-xl border border-sage-200 text-xs focus:ring-2 focus:ring-saffron-400 focus:outline-none"
          />
        </div>
      </div>

      {/* Test Email Connection (Resend Integration) */}
      <div className="card p-6 space-y-3 bg-gradient-to-br from-white to-saffron-50/20">
        <h2 className="font-bold text-lg text-sage-800 flex items-center gap-2">
          <Mail size={18} className="text-saffron-500" /> Test Resend Email System
        </h2>
        <p className="text-xs text-sage-500">
          Verify transactional order confirmations, invoices, and promo broadcasts are sending properly.
        </p>
        <div className="flex gap-2">
          <input
            type="email"
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
            placeholder="Enter test destination email..."
            className="flex-1 px-4 py-2.5 rounded-xl border border-sage-200 text-sm focus:ring-2 focus:ring-saffron-400 focus:outline-none"
          />
          <button
            onClick={sendTestEmailAction}
            disabled={testing}
            className="btn-secondary text-xs flex items-center gap-1.5 shrink-0"
          >
            {testing ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
            Send Test
          </button>
        </div>
        {testStatus && (
          <p className={`text-xs p-2 rounded-lg ${testStatus.startsWith('Failed') ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700'}`}>
            {testStatus}
          </p>
        )}
      </div>

      <div className="flex items-center gap-3 pt-2">
        <button onClick={save} className="btn-primary px-8 py-3 text-base font-semibold">
          Save All Settings
        </button>
        {saved && (
          <span className="text-green-600 font-semibold text-sm flex items-center gap-1">
            <CheckCircle size={16} /> Saved Live!
          </span>
        )}
      </div>
    </div>
  )
}
