import { useEffect, useState } from 'react'
import { Plus, Trash2, Truck } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import type { DeliveryChargeTier } from '../../types'

export default function DeliveryCharges() {
  const [tiers, setTiers] = useState<DeliveryChargeTier[]>([])
  const [newMaxKm, setNewMaxKm] = useState(2)
  const [newCharge, setNewCharge] = useState(5)

  async function load() {
    const { data } = await supabase.from('delivery_charge_tiers').select('*').order('max_km')
    setTiers((data as DeliveryChargeTier[]) ?? [])
  }
  useEffect(() => { load() }, [])

  async function addTier() {
    await supabase.from('delivery_charge_tiers').insert({ max_km: newMaxKm, charge: newCharge })
    setNewMaxKm(0)
    setNewCharge(0)
    load()
  }

  async function updateTier(id: string, field: 'max_km' | 'charge', value: number) {
    await supabase.from('delivery_charge_tiers').update({ [field]: value }).eq('id', id)
    load()
  }

  async function remove(id: string) {
    if (!confirm('Delete this delivery charge tier?')) return
    await supabase.from('delivery_charge_tiers').delete().eq('id', id)
    load()
  }

  return (
    <div className="max-w-2xl">
      <h1 className="font-display text-3xl font-bold text-sage-700 mb-1 flex items-center gap-2">
        <Truck size={28} className="text-saffron-500" /> Delivery Charges
      </h1>
      <p className="text-sage-500 mb-6">
        Set how much to charge based on distance from your cafe. The system automatically calculates
        the customer's distance at checkout and applies the matching rate below.
      </p>

      <div className="card p-6 mb-6">
        <h2 className="font-bold text-sage-700 mb-4">Current Tiers</h2>
        {tiers.length === 0 ? (
          <p className="text-sage-400 text-sm">No tiers set yet — add one below. Until you do, delivery is free for everyone.</p>
        ) : (
          <div className="space-y-3">
            {tiers.map((tier, i) => (
              <div key={tier.id} className="flex items-center gap-3 bg-sage-50 rounded-lg p-3">
                <span className="text-sage-400 text-sm w-16">Tier {i + 1}</span>
                <span className="text-sage-600 text-sm">Within</span>
                <input
                  type="number" min="0" step="0.5"
                  value={tier.max_km}
                  onChange={(e) => updateTier(tier.id, 'max_km', parseFloat(e.target.value) || 0)}
                  className="w-20 px-2 py-1 rounded-lg border border-sage-100 text-center"
                />
                <span className="text-sage-600 text-sm">km → charge ₹</span>
                <input
                  type="number" min="0"
                  value={tier.charge}
                  onChange={(e) => updateTier(tier.id, 'charge', parseFloat(e.target.value) || 0)}
                  className="w-20 px-2 py-1 rounded-lg border border-sage-100 text-center"
                />
                <button onClick={() => remove(tier.id)} className="ml-auto p-1.5 bg-red-50 text-red-500 rounded-md"><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
        )}
        <p className="text-xs text-sage-400 mt-3">
          Example: "Within 2 km → ₹5", "Within 5 km → ₹15", "Within 10 km → ₹20". Orders farther than your
          largest tier are charged that same top rate, rather than delivered for free.
        </p>
      </div>

      <div className="card p-6">
        <h2 className="font-bold text-sage-700 mb-4">Add a New Tier</h2>
        <div className="flex items-end gap-3">
          <div>
            <label className="text-sm font-medium text-sage-700 block mb-1">Within (km)</label>
            <input type="number" min="0" step="0.5" value={newMaxKm} onChange={(e) => setNewMaxKm(parseFloat(e.target.value) || 0)} className="w-24 px-3 py-2 rounded-lg border border-sage-100" />
          </div>
          <div>
            <label className="text-sm font-medium text-sage-700 block mb-1">Charge (₹)</label>
            <input type="number" min="0" value={newCharge} onChange={(e) => setNewCharge(parseFloat(e.target.value) || 0)} className="w-24 px-3 py-2 rounded-lg border border-sage-100" />
          </div>
          <button onClick={addTier} className="btn-primary flex items-center gap-2"><Plus size={16} /> Add Tier</button>
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mt-6 text-sm text-amber-700">
        <strong>Important:</strong> distance is measured from your cafe's location, set in <strong>Settings → Cafe Location</strong>.
        If that's not set yet, delivery charges will default to the largest tier for every order since distance can't be calculated.
      </div>
    </div>
  )
}
