import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, Package, AlertTriangle, IndianRupee } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import type { InventoryItem } from '../../types'

const BLANK: Partial<InventoryItem> = { name: '', quantity: 0, unit: 'kg', min_level: 0, cost_per_unit: 0 }

export default function Inventory() {
  const [items, setItems] = useState<InventoryItem[]>([])
  const [editing, setEditing] = useState<Partial<InventoryItem> | null>(null)

  async function load() {
    const { data } = await supabase.from('inventory_items').select('*').order('name')
    setItems((data as InventoryItem[]) ?? [])
  }
  useEffect(() => { load() }, [])

  async function save() {
    if (!editing) return
    if (editing.id) await supabase.from('inventory_items').update(editing).eq('id', editing.id)
    else await supabase.from('inventory_items').insert(editing)
    setEditing(null)
    load()
  }

  async function remove(id: string) {
    if (!confirm('Delete this inventory item?')) return
    await supabase.from('inventory_items').delete().eq('id', id)
    load()
  }

  const lowStock = items.filter((i) => i.quantity < i.min_level).length
  const totalValue = items.reduce((s, i) => s + i.quantity * i.cost_per_unit, 0)

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="font-display text-3xl font-bold text-sage-700">Inventory</h1>
          <p className="text-sage-500">Track ingredients and supplies</p>
        </div>
        <button onClick={() => setEditing(BLANK)} className="btn-primary flex items-center gap-2"><Plus size={18} /> Add Item</button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-6">
        <div className="card p-5"><Package className="text-saffron-500 mb-2" /><div className="text-sage-500 text-sm">Total Items</div><div className="text-2xl font-bold text-sage-700">{items.length}</div></div>
        <div className="card p-5"><AlertTriangle className="text-saffron-500 mb-2" /><div className="text-sage-500 text-sm">Low Stock Alerts</div><div className="text-2xl font-bold text-sage-700">{lowStock}</div></div>
        <div className="card p-5"><IndianRupee className="text-saffron-500 mb-2" /><div className="text-sage-500 text-sm">Inventory Value</div><div className="text-2xl font-bold text-sage-700">₹{totalValue.toFixed(2)}</div></div>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-sage-50 text-sage-500 text-sm">
            <tr><th className="p-3">Name</th><th className="p-3">Quantity</th><th className="p-3">Min Level</th><th className="p-3">Cost</th><th className="p-3">Status</th><th className="p-3">Actions</th></tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const low = item.quantity < item.min_level
              return (
                <tr key={item.id} className="border-t border-sage-50">
                  <td className="p-3 font-medium text-sage-700">{item.name}</td>
                  <td className="p-3">{item.quantity} {item.unit}</td>
                  <td className="p-3">{item.min_level} {item.unit}</td>
                  <td className="p-3">₹{item.cost_per_unit.toFixed(2)}</td>
                  <td className="p-3"><span className={`px-2 py-1 rounded-full text-xs font-medium ${low ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>{low ? 'Low Stock' : 'In Stock'}</span></td>
                  <td className="p-3 flex gap-2">
                    <button onClick={() => setEditing(item)} className="p-1.5 bg-sage-50 rounded-md"><Pencil size={14} /></button>
                    <button onClick={() => remove(item.id)} className="p-1.5 bg-red-50 text-red-500 rounded-md"><Trash2 size={14} /></button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-6">
          <div className="bg-white rounded-xl p-6 w-full max-w-md space-y-4">
            <h2 className="font-bold text-xl text-sage-700">{editing.id ? 'Edit' : 'Add'} Inventory Item</h2>
            <div>
              <label className="text-sm font-medium text-sage-700 block mb-1">Ingredient Name</label>
              <input placeholder="e.g. Avocado" value={editing.name ?? ''} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className="w-full px-4 py-2 rounded-lg border border-sage-100" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-sage-700 block mb-1">Current Quantity</label>
                <input type="number" min="0" placeholder="e.g. 24" value={editing.quantity ?? 0} onChange={(e) => setEditing({ ...editing, quantity: parseFloat(e.target.value) })} className="w-full px-4 py-2 rounded-lg border border-sage-100" />
              </div>
              <div>
                <label className="text-sm font-medium text-sage-700 block mb-1">Unit</label>
                <select value={editing.unit ?? 'kg'} onChange={(e) => setEditing({ ...editing, unit: e.target.value })} className="w-full px-4 py-2 rounded-lg border border-sage-100 bg-white">
                  <option value="kg">kg</option>
                  <option value="g">g</option>
                  <option value="L">L (litres)</option>
                  <option value="ml">ml</option>
                  <option value="pcs">pcs (pieces)</option>
                  <option value="dozen">dozen</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-sage-700 block mb-1">Low Stock Alert Level</label>
              <input type="number" min="0" placeholder="e.g. 10 — alerts you when quantity drops below this" value={editing.min_level ?? 0} onChange={(e) => setEditing({ ...editing, min_level: parseFloat(e.target.value) })} className="w-full px-4 py-2 rounded-lg border border-sage-100" />
            </div>
            <div>
              <label className="text-sm font-medium text-sage-700 block mb-1">Cost per Unit (₹)</label>
              <input type="number" min="0" step="0.01" placeholder="e.g. 65.00" value={editing.cost_per_unit ?? 0} onChange={(e) => setEditing({ ...editing, cost_per_unit: parseFloat(e.target.value) })} className="w-full px-4 py-2 rounded-lg border border-sage-100" />
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
