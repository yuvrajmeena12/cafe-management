import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, Tag, MessageCircle, Loader2 } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import type { Discount } from '../../types'

const BLANK: Partial<Discount> = { code: '', type: 'percent', value: 10, min_order_value: 0, valid_from: '', valid_to: '', active: true }

export default function Discounts() {
  const [discounts, setDiscounts] = useState<Discount[]>([])
  const [editing, setEditing] = useState<Partial<Discount> | null>(null)
  const [broadcasting, setBroadcasting] = useState<string | null>(null)
  const [broadcastResult, setBroadcastResult] = useState<{ id: string; message: string } | null>(null)

  async function load() {
    const { data } = await supabase.from('discounts').select('*').order('code')
    setDiscounts((data as Discount[]) ?? [])
  }
  useEffect(() => { load() }, [])

  async function save() {
    if (!editing) return
    const payload = { ...editing, code: editing.code?.toUpperCase() }
    if (editing.id) await supabase.from('discounts').update(payload).eq('id', editing.id)
    else await supabase.from('discounts').insert(payload)
    setEditing(null)
    load()
  }

  async function remove(id: string) {
    if (!confirm('Delete this discount code?')) return
    await supabase.from('discounts').delete().eq('id', id)
    load()
  }

  async function toggleActive(d: Discount) {
    await supabase.from('discounts').update({ active: !d.active }).eq('id', d.id)
    load()
  }

  async function sendBroadcast(d: Discount) {
    if (!confirm(`Send this offer via WhatsApp to every opted-in customer? This can't be undone once sent.`)) return
    setBroadcasting(d.id)
    setBroadcastResult(null)
    const { data, error } = await supabase.functions.invoke('send-offer-broadcast', { body: { discountId: d.id } })
    setBroadcasting(null)
    if (error || data?.error) {
      setBroadcastResult({ id: d.id, message: `Failed: ${data?.error ?? error?.message ?? 'Unknown error'}` })
      return
    }
    setBroadcastResult({ id: d.id, message: `Sent to ${data.sent} of ${data.total} customers${data.failed > 0 ? ` (${data.failed} failed)` : ''}.` })
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="font-display text-3xl font-bold text-sage-700">Discounts</h1>
          <p className="text-sage-500">Create and manage promo codes</p>
        </div>
        <button onClick={() => setEditing(BLANK)} className="btn-primary flex items-center gap-2"><Plus size={18} /> New Code</button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {discounts.map((d) => (
          <div key={d.id} className="card p-5">
            <div className="flex justify-between items-start mb-2">
              <div className="flex items-center gap-2 font-bold text-sage-700 text-lg"><Tag size={18} className="text-saffron-500" /> {d.code}</div>
              <button onClick={() => toggleActive(d)} className={`px-2 py-1 rounded-full text-xs font-medium ${d.active ? 'bg-green-50 text-green-600' : 'bg-sage-100 text-sage-400'}`}>{d.active ? 'Active' : 'Inactive'}</button>
            </div>
            <div className="text-sage-600 mb-1">{d.type === 'percent' ? `${d.value}% off` : `₹${d.value} off`}</div>
            <div className="text-sm text-sage-400 mb-3">Min order: ₹{d.min_order_value} · Valid {d.valid_from} to {d.valid_to}</div>
            <div className="flex gap-2">
              <button onClick={() => setEditing(d)} className="flex-1 btn-secondary text-sm flex items-center justify-center gap-1"><Pencil size={14} /> Edit</button>
              <button onClick={() => remove(d.id)} className="p-2 bg-red-50 text-red-500 rounded-lg"><Trash2 size={16} /></button>
            </div>
            <button
              onClick={() => sendBroadcast(d)}
              disabled={broadcasting === d.id}
              className="w-full mt-2 flex items-center justify-center gap-2 text-sm bg-green-50 text-green-700 py-2 rounded-lg font-medium hover:bg-green-100"
            >
              {broadcasting === d.id ? <Loader2 size={14} className="animate-spin" /> : <MessageCircle size={14} />}
              {broadcasting === d.id ? 'Sending...' : 'Send WhatsApp Broadcast'}
            </button>
            {broadcastResult?.id === d.id && (
              <p className={`text-xs mt-1.5 ${broadcastResult.message.startsWith('Failed') ? 'text-red-500' : 'text-green-600'}`}>
                {broadcastResult.message}
              </p>
            )}
          </div>
        ))}
      </div>

      {editing && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-6">
          <div className="bg-white rounded-xl p-6 w-full max-w-md space-y-4">
            <h2 className="font-bold text-xl text-sage-700">{editing.id ? 'Edit' : 'New'} Discount Code</h2>
            <div>
              <label className="text-sm font-medium text-sage-700 block mb-1">Code (what customers type at checkout)</label>
              <input placeholder="e.g. WELCOME10" value={editing.code ?? ''} onChange={(e) => setEditing({ ...editing, code: e.target.value })} className="w-full px-4 py-2 rounded-lg border border-sage-100 uppercase" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-sage-700 block mb-1">Discount Type</label>
                <select value={editing.type ?? 'percent'} onChange={(e) => setEditing({ ...editing, type: e.target.value as any })} className="w-full px-4 py-2 rounded-lg border border-sage-100 bg-white">
                  <option value="percent">% Percent off</option><option value="flat">₹ Flat amount off</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-sage-700 block mb-1">{editing.type === 'flat' ? 'Amount (₹)' : 'Percent (%)'}</label>
                <input type="number" min="0" placeholder={editing.type === 'flat' ? 'e.g. 50' : 'e.g. 10'} value={editing.value ?? 0} onChange={(e) => setEditing({ ...editing, value: parseFloat(e.target.value) })} className="w-full px-4 py-2 rounded-lg border border-sage-100" />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-sage-700 block mb-1">Minimum Order Value (₹)</label>
              <input type="number" min="0" placeholder="e.g. 200 — code won't apply below this" value={editing.min_order_value ?? 0} onChange={(e) => setEditing({ ...editing, min_order_value: parseFloat(e.target.value) })} className="w-full px-4 py-2 rounded-lg border border-sage-100" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-sage-700 block mb-1">Valid From</label>
                <input type="date" value={editing.valid_from ?? ''} onChange={(e) => setEditing({ ...editing, valid_from: e.target.value })} className="w-full px-4 py-2 rounded-lg border border-sage-100" />
              </div>
              <div>
                <label className="text-sm font-medium text-sage-700 block mb-1">Valid Until</label>
                <input type="date" value={editing.valid_to ?? ''} onChange={(e) => setEditing({ ...editing, valid_to: e.target.value })} className="w-full px-4 py-2 rounded-lg border border-sage-100" />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setEditing(null)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={save} className="btn-primary flex-1">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
