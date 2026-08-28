import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, Tag, Mail, Loader2, Sparkles } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../lib/supabaseClient'
import AnimatedModal from '../../components/AnimatedModal'
import type { Discount } from '../../types'

const BLANK: Partial<Discount> = {
  code: '',
  type: 'percent',
  value: 10,
  min_order_value: 0,
  valid_from: '',
  valid_to: '',
  active: true,
}

export default function Discounts() {
  const [discounts, setDiscounts] = useState<Discount[]>([])
  const [editing, setEditing] = useState<Partial<Discount> | null>(null)
  const [broadcasting, setBroadcasting] = useState<string | null>(null)
  const [broadcastResult, setBroadcastResult] = useState<{ id: string; message: string; success: boolean } | null>(null)

  async function load() {
    const { data } = await supabase.from('discounts').select('*').order('code')
    setDiscounts((data as Discount[]) ?? [])
  }
  useEffect(() => { load() }, [])

  async function save() {
    if (!editing) return
    const payload = { ...editing, code: editing.code?.toUpperCase().trim() }
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

  async function sendEmailBroadcast(d: Discount) {
    if (!confirm(`Send this promotional offer email to all registered customers?`)) return
    setBroadcasting(d.id)
    setBroadcastResult(null)
    const { data, error } = await supabase.functions.invoke('send-offer-broadcast', {
      body: { discountId: d.id },
    })
    setBroadcasting(null)
    if (error || data?.error) {
      setBroadcastResult({
        id: d.id,
        message: `Failed: ${data?.error ?? error?.message ?? 'Could not dispatch emails'}`,
        success: false,
      })
      return
    }
    setBroadcastResult({
      id: d.id,
      message: `Offer sent to ${data.sent} of ${data.total} registered customers!`,
      success: true,
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-sage-800">Discounts & Promo Codes</h1>
          <p className="text-sage-500 text-sm">Create coupons and send promotional email blasts to your customers</p>
        </div>
        <button
          onClick={() => setEditing(BLANK)}
          className="btn-primary flex items-center justify-center gap-2"
        >
          <Plus size={18} /> New Promo Code
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        <AnimatePresence>
          {discounts.map((d) => (
            <motion.div
              key={d.id}
              layout
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="card p-5 space-y-3 relative overflow-hidden"
            >
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-2 font-display font-bold text-sage-800 text-xl tracking-wide">
                  <div className="w-8 h-8 rounded-lg bg-saffron-50 flex items-center justify-center text-saffron-500">
                    <Tag size={18} />
                  </div>
                  {d.code}
                </div>
                <button
                  onClick={() => toggleActive(d)}
                  className={`px-3 py-1 rounded-full text-xs font-bold uppercase transition-colors ${
                    d.active
                      ? 'bg-green-100 text-green-800'
                      : 'bg-sage-100 text-sage-500'
                  }`}
                >
                  {d.active ? 'Active' : 'Inactive'}
                </button>
              </div>

              <div className="text-2xl font-bold text-saffron-600">
                {d.type === 'percent' ? `${d.value}% OFF` : `₹${d.value} OFF`}
              </div>

              <div className="text-xs text-sage-500 space-y-1 bg-sage-50/80 p-2.5 rounded-xl">
                <div>Min order value: <strong className="text-sage-700">₹{d.min_order_value}</strong></div>
                {(d.valid_from || d.valid_to) && (
                  <div>Valid: <span className="text-sage-700">{d.valid_from || 'Always'}</span> to <span className="text-sage-700">{d.valid_to || 'Always'}</span></div>
                )}
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => setEditing(d)}
                  className="flex-1 btn-secondary text-xs py-2 flex items-center justify-center gap-1.5"
                >
                  <Pencil size={13} /> Edit
                </button>
                <button
                  onClick={() => remove(d.id)}
                  className="p-2 bg-red-50 text-red-500 hover:bg-red-100 rounded-xl transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              </div>

              <button
                onClick={() => sendEmailBroadcast(d)}
                disabled={broadcasting === d.id || !d.active}
                className="w-full flex items-center justify-center gap-2 text-xs bg-saffron-50 hover:bg-saffron-100 text-saffron-700 py-2.5 rounded-xl font-semibold transition-colors disabled:opacity-50"
              >
                {broadcasting === d.id ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Mail size={14} />
                )}
                {broadcasting === d.id ? 'Sending Emails...' : 'Send Email Broadcast'}
              </button>

              {broadcastResult?.id === d.id && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`text-xs p-2.5 rounded-xl ${
                    broadcastResult.success
                      ? 'bg-green-50 text-green-700 border border-green-200'
                      : 'bg-red-50 text-red-600 border border-red-200'
                  }`}
                >
                  {broadcastResult.message}
                </motion.div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <AnimatedModal
        isOpen={!!editing}
        onClose={() => setEditing(null)}
        title={editing?.id ? 'Edit Discount Code' : 'New Discount Code'}
      >
        {editing && (
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold uppercase text-sage-600 block mb-1">Code</label>
              <input
                placeholder="e.g. MONSOON25"
                value={editing.code ?? ''}
                onChange={(e) => setEditing({ ...editing, code: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-sage-200 uppercase font-bold text-sage-800 focus:ring-2 focus:ring-saffron-400 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold uppercase text-sage-600 block mb-1">Type</label>
                <select
                  value={editing.type ?? 'percent'}
                  onChange={(e) => setEditing({ ...editing, type: e.target.value as any })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-sage-200 bg-white text-sm focus:ring-2 focus:ring-saffron-400 focus:outline-none"
                >
                  <option value="percent">% Percent off</option>
                  <option value="flat">₹ Flat amount</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase text-sage-600 block mb-1">
                  {editing.type === 'flat' ? 'Amount (₹)' : 'Percentage (%)'}
                </label>
                <input
                  type="number"
                  min="0"
                  placeholder="e.g. 15"
                  value={editing.value ?? 0}
                  onChange={(e) => setEditing({ ...editing, value: parseFloat(e.target.value) })}
                  className="w-full px-4 py-2.5 rounded-xl border border-sage-200 text-sm focus:ring-2 focus:ring-saffron-400 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold uppercase text-sage-600 block mb-1">Minimum Order Value (₹)</label>
              <input
                type="number"
                min="0"
                placeholder="0 for no minimum"
                value={editing.min_order_value ?? 0}
                onChange={(e) => setEditing({ ...editing, min_order_value: parseFloat(e.target.value) })}
                className="w-full px-4 py-2.5 rounded-xl border border-sage-200 text-sm focus:ring-2 focus:ring-saffron-400 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold uppercase text-sage-600 block mb-1">Valid From</label>
                <input
                  type="date"
                  value={editing.valid_from ?? ''}
                  onChange={(e) => setEditing({ ...editing, valid_from: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-sage-200 text-sm focus:ring-2 focus:ring-saffron-400 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase text-sage-600 block mb-1">Valid Until</label>
                <input
                  type="date"
                  value={editing.valid_to ?? ''}
                  onChange={(e) => setEditing({ ...editing, valid_to: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-sage-200 text-sm focus:ring-2 focus:ring-saffron-400 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-3">
              <button onClick={() => setEditing(null)} className="btn-secondary flex-1">
                Cancel
              </button>
              <button onClick={save} className="btn-primary flex-1">
                Save Code
              </button>
            </div>
          </div>
        )}
      </AnimatedModal>
    </div>
  )
}
