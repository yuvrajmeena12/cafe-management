import { useEffect, useMemo, useState } from 'react'
import { Plus, Pencil, Trash2, Search } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import ImageUploadField from '../../components/ImageUploadField'
import type { MenuItem } from '../../types'

const PRESET_CATEGORIES = ['Beverages', 'Breakfast', 'Salads', 'Mains', 'Snacks', 'Desserts']
const BLANK: Partial<MenuItem> = { name: '', description: '', price: 0, cost_price: 0, image_url: '', category: '', calories: undefined, tags: [], is_popular: false, is_available: true }

export default function MenuItems() {
  const [items, setItems] = useState<MenuItem[]>([])
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<Partial<MenuItem> | null>(null)
  const [customCategory, setCustomCategory] = useState(false)
  const [errors, setErrors] = useState<string[]>([])

  async function load() {
    const { data } = await supabase.from('menu_items').select('*').order('name')
    setItems((data as MenuItem[]) ?? [])
  }
  useEffect(() => { load() }, [])

  // Combine preset categories with any custom ones already used in the menu,
  // so the dropdown grows naturally as the admin adds new kinds of dishes.
  const categoryOptions = useMemo(() => {
    const existing = items.map((i) => i.category).filter(Boolean)
    return Array.from(new Set([...PRESET_CATEGORIES, ...existing]))
  }, [items])

  function openEdit(item: Partial<MenuItem>) {
    setEditing(item)
    setCustomCategory(item.category ? !categoryOptions.includes(item.category) : false)
    setErrors([])
  }

  function validate(): string[] {
    const errs: string[] = []
    if (!editing?.name?.trim()) errs.push('Item name is required.')
    if (!editing?.category?.trim()) errs.push('Please choose or enter a category.')
    if (!editing?.price || editing.price <= 0) errs.push('Price must be greater than ₹0.')
    if (!editing?.image_url) errs.push('Please upload a photo or paste an image URL.')
    return errs
  }

  async function save() {
    const errs = validate()
    if (errs.length) { setErrors(errs); return }
    if (!editing) return

    if (editing.id) {
      await supabase.from('menu_items').update(editing).eq('id', editing.id)
    } else {
      await supabase.from('menu_items').insert(editing)
    }
    setEditing(null)
    load()
  }

  async function remove(id: string) {
    if (!confirm('Delete this item? This cannot be undone.')) return
    await supabase.from('menu_items').delete().eq('id', id)
    load()
  }

  async function toggleAvailable(item: MenuItem) {
    await supabase.from('menu_items').update({ is_available: !item.is_available }).eq('id', item.id)
    load()
  }

  const filtered = items.filter((i) => i.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="font-display text-3xl font-bold text-sage-700">Menu Items</h1>
          <p className="text-sage-500">Add, edit, and manage your cafe menu</p>
        </div>
        <button onClick={() => openEdit(BLANK)} className="btn-primary flex items-center gap-2"><Plus size={18} /> Add Item</button>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-sage-400" size={18} />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search items..." className="w-full pl-10 pr-4 py-3 rounded-lg border border-sage-100" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map((item) => (
          <div key={item.id} className="card overflow-hidden">
            <img src={item.image_url} className="w-full h-40 object-cover" />
            <div className="p-4">
              <div className="flex justify-between"><h3 className="font-bold text-sage-700">{item.name}</h3><span className="text-saffron-600 font-bold">₹{item.price.toFixed(2)}</span></div>
              <p className="text-sm text-sage-500 mt-1 line-clamp-2">{item.description}</p>
              <span className="inline-block mt-2 text-xs bg-sage-50 text-sage-600 px-2 py-1 rounded-full">{item.category}</span>
              <div className="flex gap-2 mt-3">
                <button onClick={() => openEdit(item)} className="flex-1 btn-secondary text-sm flex items-center justify-center gap-1"><Pencil size={14} /> Edit</button>
                <button onClick={() => toggleAvailable(item)} className={`px-3 rounded-lg text-sm font-medium ${item.is_available ? 'bg-green-50 text-green-600' : 'bg-sage-100 text-sage-400'}`}>
                  {item.is_available ? 'On' : 'Off'}
                </button>
                <button onClick={() => remove(item.id)} className="p-2 bg-red-50 text-red-500 rounded-lg"><Trash2 size={16} /></button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-6">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="font-bold text-xl text-sage-700">{editing.id ? 'Edit Item' : 'Add Item'}</h2>

            {errors.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-600">
                <ul className="list-disc list-inside">{errors.map((e) => <li key={e}>{e}</li>)}</ul>
              </div>
            )}

            <div>
              <label className="text-sm font-medium text-sage-700 block mb-1">Item Name</label>
              <input placeholder="e.g. Avocado Toast" value={editing.name ?? ''} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className="w-full px-4 py-2 rounded-lg border border-sage-100" />
            </div>

            <div>
              <label className="text-sm font-medium text-sage-700 block mb-1">Description</label>
              <textarea placeholder="Short description shown to customers" value={editing.description ?? ''} onChange={(e) => setEditing({ ...editing, description: e.target.value })} className="w-full px-4 py-2 rounded-lg border border-sage-100" rows={2} />
            </div>

            <div>
              <label className="text-sm font-medium text-sage-700 block mb-1">Price (₹)</label>
              <input type="number" min="0" step="0.01" placeholder="e.g. 250" value={editing.price ?? 0} onChange={(e) => setEditing({ ...editing, price: parseFloat(e.target.value) })} className="w-full px-4 py-2 rounded-lg border border-sage-100" />
            </div>

            <div>
              <label className="text-sm font-medium text-sage-700 block mb-1">Your Cost (₹) — optional</label>
              <input type="number" min="0" step="0.01" placeholder="e.g. 90 — what it actually costs you to make this" value={editing.cost_price ?? 0} onChange={(e) => setEditing({ ...editing, cost_price: parseFloat(e.target.value) })} className="w-full px-4 py-2 rounded-lg border border-sage-100" />
              <p className="text-xs text-sage-400 mt-1">Set this to unlock real profit numbers in the AI Voice Assistant and Dashboard.</p>
            </div>

            <div>
              <label className="text-sm font-medium text-sage-700 block mb-1">Category</label>
              {!customCategory ? (
                <select
                  value={editing.category ?? ''}
                  onChange={(e) => {
                    if (e.target.value === '__custom__') { setCustomCategory(true); setEditing({ ...editing, category: '' }) }
                    else setEditing({ ...editing, category: e.target.value })
                  }}
                  className="w-full px-4 py-2 rounded-lg border border-sage-100 bg-white"
                >
                  <option value="" disabled>Select a category</option>
                  {categoryOptions.map((c) => <option key={c} value={c}>{c}</option>)}
                  <option value="__custom__">+ Add new category...</option>
                </select>
              ) : (
                <div className="flex gap-2">
                  <input autoFocus placeholder="Type new category name" value={editing.category ?? ''} onChange={(e) => setEditing({ ...editing, category: e.target.value })} className="flex-1 px-4 py-2 rounded-lg border border-sage-100" />
                  <button type="button" onClick={() => setCustomCategory(false)} className="btn-secondary text-sm px-3">Choose Existing</button>
                </div>
              )}
            </div>

            <div>
              <label className="text-sm font-medium text-sage-700 block mb-1">Calories (optional)</label>
              <input type="number" min="0" placeholder="e.g. 350" value={editing.calories ?? ''} onChange={(e) => setEditing({ ...editing, calories: e.target.value ? parseInt(e.target.value) : undefined })} className="w-full px-4 py-2 rounded-lg border border-sage-100" />
            </div>

            <ImageUploadField
              label="Item Photo"
              value={editing.image_url ?? ''}
              onChange={(url) => setEditing({ ...editing, image_url: url })}
              folder="menu-items"
            />

            <label className="flex items-center gap-2 text-sage-600">
              <input type="checkbox" checked={editing.is_popular ?? false} onChange={(e) => setEditing({ ...editing, is_popular: e.target.checked })} />
              Mark as Popular (shows a ★ badge and appears in "Popular This Week")
            </label>

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
