import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, Users } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { isValidEmail, isValidPhone } from '../../lib/validation'
import type { StaffMember } from '../../types'

const ROLE_OPTIONS = ['Barista', 'Head Chef', 'Kitchen Staff', 'Server', 'Manager', 'Delivery Staff']
const BLANK: Partial<StaffMember> = { name: '', role: '', phone: '', email: '', shift: 'Morning', monthly_salary: 0, active: true }

export default function Staff() {
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<Partial<StaffMember> | null>(null)
  const [customRole, setCustomRole] = useState(false)
  const [errors, setErrors] = useState<string[]>([])

  async function load() {
    const { data } = await supabase.from('staff').select('*').order('name')
    setStaff((data as StaffMember[]) ?? [])
  }
  useEffect(() => { load() }, [])

  function openEdit(m: Partial<StaffMember>) {
    setEditing(m)
    setCustomRole(m.role ? !ROLE_OPTIONS.includes(m.role) : false)
    setErrors([])
  }

  function validate(): string[] {
    const errs: string[] = []
    if (!editing?.name?.trim()) errs.push('Name is required.')
    if (!editing?.role?.trim()) errs.push('Please choose or enter a role.')
    if (!editing?.email?.trim() || !isValidEmail(editing.email)) errs.push('Enter a valid email address (must include @, e.g. name@example.com).')
    if (!editing?.phone?.trim() || !isValidPhone(editing.phone)) errs.push('Enter a valid phone number.')
    if (editing?.monthly_salary == null || editing.monthly_salary <= 0) errs.push('Monthly salary must be greater than ₹0.')
    return errs
  }

  async function save() {
    const errs = validate()
    if (errs.length) { setErrors(errs); return }
    if (!editing) return

    if (editing.id) await supabase.from('staff').update(editing).eq('id', editing.id)
    else await supabase.from('staff').insert(editing)
    setEditing(null)
    load()
  }

  async function remove(id: string) {
    if (!confirm('Remove this staff member?')) return
    await supabase.from('staff').delete().eq('id', id)
    load()
  }

  const payroll = staff.reduce((s, m) => s + Number(m.monthly_salary), 0)
  const filtered = staff.filter((m) => m.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="font-display text-3xl font-bold text-sage-700">Staff Management</h1>
          <p className="text-sage-500">Manage your team members and shifts</p>
        </div>
        <button onClick={() => openEdit(BLANK)} className="btn-primary flex items-center gap-2"><Plus size={18} /> Add Staff</button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-6">
        <div className="card p-5"><Users className="text-saffron-500 mb-2" /><div className="text-sage-500 text-sm">Team Members</div><div className="text-2xl font-bold text-sage-700">{staff.length}</div></div>
        <div className="card p-5"><Users className="text-saffron-500 mb-2" /><div className="text-sage-500 text-sm">Monthly Payroll</div><div className="text-2xl font-bold text-sage-700">₹{payroll.toFixed(2)}</div></div>
      </div>

      <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search staff..." className="w-full px-4 py-3 rounded-lg border border-sage-100 mb-6" />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {filtered.map((m) => (
          <div key={m.id} className="card p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-11 h-11 rounded-full bg-gradient-to-br from-sage-600 to-saffron-500 text-white flex items-center justify-center font-bold">{m.name[0]}</div>
              <div><div className="font-semibold text-sage-700">{m.name}</div><div className="text-sm text-saffron-600">{m.role}</div></div>
            </div>
            <div className="text-sm text-sage-500 space-y-1 mb-3">
              <div>{m.phone}</div>
              <div>{m.email}</div>
              <div className="flex gap-2 mt-1"><span className="bg-sage-50 px-2 py-1 rounded-full text-xs">{m.shift}</span><span className="text-sage-600 font-medium">₹{m.monthly_salary}/mo</span></div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => openEdit(m)} className="flex-1 btn-secondary text-sm flex items-center justify-center gap-1"><Pencil size={14} /> Edit</button>
              <button onClick={() => remove(m.id)} className="p-2 bg-red-50 text-red-500 rounded-lg"><Trash2 size={16} /></button>
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-6">
          <div className="bg-white rounded-xl p-6 w-full max-w-md space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="font-bold text-xl text-sage-700">{editing.id ? 'Edit' : 'Add'} Staff Member</h2>

            {errors.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-600">
                <ul className="list-disc list-inside">{errors.map((e) => <li key={e}>{e}</li>)}</ul>
              </div>
            )}

            <div>
              <label className="text-sm font-medium text-sage-700 block mb-1">Full Name</label>
              <input placeholder="e.g. Priya Sharma" value={editing.name ?? ''} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className="w-full px-4 py-2 rounded-lg border border-sage-100" />
            </div>

            <div>
              <label className="text-sm font-medium text-sage-700 block mb-1">Role</label>
              {!customRole ? (
                <select
                  value={editing.role ?? ''}
                  onChange={(e) => {
                    if (e.target.value === '__custom__') { setCustomRole(true); setEditing({ ...editing, role: '' }) }
                    else setEditing({ ...editing, role: e.target.value })
                  }}
                  className="w-full px-4 py-2 rounded-lg border border-sage-100 bg-white"
                >
                  <option value="" disabled>Select a role</option>
                  {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                  <option value="__custom__">+ Other (type manually)...</option>
                </select>
              ) : (
                <div className="flex gap-2">
                  <input autoFocus placeholder="Type role" value={editing.role ?? ''} onChange={(e) => setEditing({ ...editing, role: e.target.value })} className="flex-1 px-4 py-2 rounded-lg border border-sage-100" />
                  <button type="button" onClick={() => setCustomRole(false)} className="btn-secondary text-sm px-3">Choose Existing</button>
                </div>
              )}
            </div>

            <div>
              <label className="text-sm font-medium text-sage-700 block mb-1">Phone Number</label>
              <input placeholder="e.g. +91 98765 43210" value={editing.phone ?? ''} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} className="w-full px-4 py-2 rounded-lg border border-sage-100" />
            </div>

            <div>
              <label className="text-sm font-medium text-sage-700 block mb-1">Email Address</label>
              <input type="email" placeholder="e.g. priya@saffronsage.cafe" value={editing.email ?? ''} onChange={(e) => setEditing({ ...editing, email: e.target.value })} className="w-full px-4 py-2 rounded-lg border border-sage-100" />
              <p className="text-xs text-sage-400 mt-1">Must include @ and a domain, e.g. name@example.com</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-sage-700 block mb-1">Shift</label>
                <select value={editing.shift ?? 'Morning'} onChange={(e) => setEditing({ ...editing, shift: e.target.value })} className="w-full px-4 py-2 rounded-lg border border-sage-100 bg-white">
                  <option>Morning</option><option>Evening</option><option>Night</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-sage-700 block mb-1">Monthly Salary (₹)</label>
                <input type="number" min="0" placeholder="e.g. 20000" value={editing.monthly_salary ?? 0} onChange={(e) => setEditing({ ...editing, monthly_salary: parseFloat(e.target.value) })} className="w-full px-4 py-2 rounded-lg border border-sage-100" />
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
