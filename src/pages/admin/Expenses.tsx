import { useEffect, useState } from 'react'
import { Plus, Trash2, Receipt } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import type { Expense } from '../../types'

const BLANK: Partial<Expense> = { category: '', amount: 0, note: '', date: new Date().toISOString().slice(0, 10) }

export default function Expenses() {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [editing, setEditing] = useState<Partial<Expense> | null>(null)

  async function load() {
    const { data } = await supabase.from('expenses').select('*').order('date', { ascending: false })
    setExpenses((data as Expense[]) ?? [])
  }
  useEffect(() => { load() }, [])

  async function save() {
    if (!editing) return
    await supabase.from('expenses').insert(editing)
    setEditing(null)
    load()
  }

  async function remove(id: string) {
    if (!confirm('Delete this expense?')) return
    await supabase.from('expenses').delete().eq('id', id)
    load()
  }

  const total = expenses.reduce((s, e) => s + Number(e.amount), 0)

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="font-display text-3xl font-bold text-sage-700">Expenses</h1>
          <p className="text-sage-500">Log business expenses to track net profit accurately</p>
        </div>
        <button onClick={() => setEditing(BLANK)} className="btn-primary flex items-center gap-2"><Plus size={18} /> Add Expense</button>
      </div>

      <div className="card p-5 mb-6 flex items-center gap-3">
        <Receipt className="text-saffron-500" />
        <div><div className="text-sage-500 text-sm">Total Expenses</div><div className="text-2xl font-bold text-sage-700">₹{total.toFixed(2)}</div></div>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-sage-50 text-sage-500 text-sm">
            <tr><th className="p-3">Date</th><th className="p-3">Category</th><th className="p-3">Note</th><th className="p-3">Amount</th><th className="p-3">Actions</th></tr>
          </thead>
          <tbody>
            {expenses.map((e) => (
              <tr key={e.id} className="border-t border-sage-50">
                <td className="p-3">{e.date}</td>
                <td className="p-3 font-medium text-sage-700">{e.category}</td>
                <td className="p-3 text-sage-500">{e.note}</td>
                <td className="p-3 font-semibold">₹{e.amount.toFixed(2)}</td>
                <td className="p-3"><button onClick={() => remove(e.id)} className="p-1.5 bg-red-50 text-red-500 rounded-md"><Trash2 size={14} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-6">
          <div className="bg-white rounded-xl p-6 w-full max-w-md space-y-4">
            <h2 className="font-bold text-xl text-sage-700">Add Expense</h2>
            <div>
              <label className="text-sm font-medium text-sage-700 block mb-1">Category</label>
              <select value={editing.category ?? ''} onChange={(e) => setEditing({ ...editing, category: e.target.value })} className="w-full px-4 py-2 rounded-lg border border-sage-100 bg-white">
                <option value="" disabled>Select a category</option>
                <option>Rent</option>
                <option>Ingredients</option>
                <option>Utilities</option>
                <option>Staff Salaries</option>
                <option>Equipment</option>
                <option>Marketing</option>
                <option>Other</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-sage-700 block mb-1">Amount (₹)</label>
              <input type="number" min="0" step="0.01" placeholder="e.g. 5000" value={editing.amount ?? 0} onChange={(e) => setEditing({ ...editing, amount: parseFloat(e.target.value) })} className="w-full px-4 py-2 rounded-lg border border-sage-100" />
            </div>
            <div>
              <label className="text-sm font-medium text-sage-700 block mb-1">Note (optional)</label>
              <input placeholder="e.g. Monthly electricity bill" value={editing.note ?? ''} onChange={(e) => setEditing({ ...editing, note: e.target.value })} className="w-full px-4 py-2 rounded-lg border border-sage-100" />
            </div>
            <div>
              <label className="text-sm font-medium text-sage-700 block mb-1">Date</label>
              <input type="date" value={editing.date ?? ''} onChange={(e) => setEditing({ ...editing, date: e.target.value })} className="w-full px-4 py-2 rounded-lg border border-sage-100" />
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
