import { useEffect, useState, useMemo } from 'react'
import {
  Plus, Pencil, Trash2, Users, CheckCircle2, Clock, DollarSign,
  Search, Filter, Activity, Star, Calendar, Mail, Phone
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../lib/supabaseClient'
import { isValidEmail, isValidPhone } from '../../lib/validation'
import AnimatedModal from '../../components/AnimatedModal'
import AnimatedCounter from '../../components/AnimatedCounter'
import type { StaffMember } from '../../types'

const ROLE_OPTIONS = [
  'Head Chef',
  'Sous Chef',
  'Barista',
  'Pastry Specialist',
  'Server / Host',
  'Kitchen Assistant',
  'Cafe Manager',
  'Inventory Supervisor',
  'Delivery Partner',
]

const SHIFTS = ['All', 'Morning', 'Evening', 'Night'] as const

const BLANK: Partial<StaffMember> = {
  name: '',
  role: '',
  phone: '',
  email: '',
  shift: 'Morning',
  monthly_salary: 20000,
  active: true,
  checked_in: false,
}

export default function Staff() {
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [search, setSearch] = useState('')
  const [shiftFilter, setShiftFilter] = useState<string>('All')
  const [roleFilter, setRoleFilter] = useState<string>('All')
  const [editing, setEditing] = useState<Partial<StaffMember> | null>(null)
  const [customRole, setCustomRole] = useState(false)
  const [errors, setErrors] = useState<string[]>([])
  const [checkingId, setCheckingId] = useState<string | null>(null)

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
    if (!editing?.name?.trim()) errs.push('Full name is required.')
    if (!editing?.role?.trim()) errs.push('Role assignment is required.')
    if (!editing?.email?.trim() || !isValidEmail(editing.email)) errs.push('Valid work email required.')
    if (!editing?.phone?.trim() || !isValidPhone(editing.phone)) errs.push('Valid phone number required.')
    if (editing?.monthly_salary == null || editing.monthly_salary <= 0) errs.push('Monthly salary must be greater than ₹0.')
    return errs
  }

  async function save() {
    const errs = validate()
    if (errs.length) { setErrors(errs); return }
    if (!editing) return

    if (editing.id) {
      await supabase.from('staff').update(editing).eq('id', editing.id)
    } else {
      await supabase.from('staff').insert(editing)
    }
    setEditing(null)
    load()
  }

  async function remove(id: string) {
    if (!confirm('Remove this staff member?')) return
    await supabase.from('staff').delete().eq('id', id)
    load()
  }

  async function toggleAttendance(m: StaffMember) {
    setCheckingId(m.id)
    const isCheckingIn = !m.checked_in
    const now = new Date().toISOString()

    const updatePayload: Partial<StaffMember> = {
      checked_in: isCheckingIn,
      ...(isCheckingIn ? { last_check_in: now } : { last_check_out: now }),
    }

    await supabase.from('staff').update(updatePayload).eq('id', m.id)
    setStaff((prev) =>
      prev.map((item) => (item.id === m.id ? { ...item, ...updatePayload } : item))
    )
    setCheckingId(null)
  }

  const { payroll, onDutyCount, roles } = useMemo(() => {
    const payroll = staff.reduce((s, m) => s + Number(m.monthly_salary || 0), 0)
    const onDutyCount = staff.filter((m) => m.checked_in).length
    const roles = ['All', ...new Set(staff.map((m) => m.role).filter(Boolean))]
    return { payroll, onDutyCount, roles }
  }, [staff])

  const filtered = useMemo(() => {
    return staff.filter((m) => {
      const matchSearch =
        m.name.toLowerCase().includes(search.toLowerCase()) ||
        m.role.toLowerCase().includes(search.toLowerCase()) ||
        m.email.toLowerCase().includes(search.toLowerCase())
      const matchShift = shiftFilter === 'All' || m.shift === shiftFilter
      const matchRole = roleFilter === 'All' || m.role === roleFilter
      return matchSearch && matchShift && matchRole
    })
  }, [staff, search, shiftFilter, roleFilter])

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-sage-800">Team & Staff Operations</h1>
          <p className="text-sage-500 text-sm">Monitor live attendance, shifts, performance and monthly payroll</p>
        </div>
        <button
          onClick={() => openEdit(BLANK)}
          className="btn-primary flex items-center justify-center gap-2"
        >
          <Plus size={18} /> Add Team Member
        </button>
      </div>

      {/* Overview Analytics Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase text-sage-500">Total Staff</span>
            <div className="w-8 h-8 rounded-lg bg-sage-100 flex items-center justify-center text-sage-700">
              <Users size={16} />
            </div>
          </div>
          <div className="text-3xl font-bold text-sage-800">
            <AnimatedCounter value={staff.length} />
          </div>
          <p className="text-xs text-sage-400 mt-1">Active team roster</p>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase text-sage-500">Currently On Duty</span>
            <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center text-green-700">
              <Activity size={16} />
            </div>
          </div>
          <div className="text-3xl font-bold text-green-700">
            <AnimatedCounter value={onDutyCount} />
          </div>
          <p className="text-xs text-green-600 font-medium mt-1">
            {staff.length ? `${Math.round((onDutyCount / staff.length) * 100)}% present today` : '0%'}
          </p>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase text-sage-500">Monthly Payroll</span>
            <div className="w-8 h-8 rounded-lg bg-saffron-100 flex items-center justify-center text-saffron-700">
              <DollarSign size={16} />
            </div>
          </div>
          <div className="text-3xl font-bold text-sage-800">
            <AnimatedCounter value={payroll} prefix="₹" />
          </div>
          <p className="text-xs text-sage-400 mt-1">Total monthly allocation</p>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase text-sage-500">Avg Attendance</span>
            <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center text-amber-700">
              <Clock size={16} />
            </div>
          </div>
          <div className="text-3xl font-bold text-sage-800">96.4%</div>
          <p className="text-xs text-sage-400 mt-1">High operational reliability</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="card p-4 flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sage-400" size={16} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, role, email..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-sage-200 text-sm focus:ring-2 focus:ring-saffron-400 focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap gap-2 w-full md:w-auto items-center">
          <div className="flex items-center gap-1.5 text-xs text-sage-500 font-semibold uppercase mr-1">
            <Filter size={13} /> Shift:
          </div>
          {SHIFTS.map((s) => (
            <button
              key={s}
              onClick={() => setShiftFilter(s)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                shiftFilter === s
                  ? 'bg-sage-800 text-white shadow-sm'
                  : 'bg-sage-50 text-sage-600 hover:bg-sage-100'
              }`}
            >
              {s}
            </button>
          ))}
          {roles.length > 2 && (
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="ml-2 px-3 py-1.5 rounded-xl border border-sage-200 text-xs bg-white text-sage-700 focus:ring-2 focus:ring-saffron-400 focus:outline-none"
            >
              {roles.map((r) => (
                <option key={r} value={r}>{r === 'All' ? 'All Roles' : r}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Staff Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        <AnimatePresence>
          {filtered.map((m) => {
            const isCheckedIn = !!m.checked_in
            return (
              <motion.div
                key={m.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className={`card p-5 relative overflow-hidden transition-all duration-300 ${
                  isCheckedIn ? 'border-green-300 ring-1 ring-green-200/60 shadow-md' : ''
                }`}
              >
                {/* Status Indicator Pill */}
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-sage-700 to-saffron-500 text-white flex items-center justify-center font-bold text-lg shadow-sm">
                      {m.name.slice(0, 1).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-bold text-sage-800 text-base">{m.name}</h3>
                      <p className="text-xs text-saffron-600 font-semibold">{m.role}</p>
                    </div>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                      isCheckedIn
                        ? 'bg-green-100 text-green-800'
                        : 'bg-sage-100 text-sage-500'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${isCheckedIn ? 'bg-green-500 animate-pulse' : 'bg-sage-400'}`} />
                    {isCheckedIn ? 'On Duty' : 'Off Duty'}
                  </span>
                </div>

                {/* Details */}
                <div className="space-y-2 text-xs text-sage-600 bg-sage-50/80 p-3 rounded-xl mb-4">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-sage-400"><Phone size={13} /> Phone:</span>
                    <a href={`tel:${m.phone}`} className="font-medium text-sage-700 hover:text-saffron-600">{m.phone}</a>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-sage-400"><Mail size={13} /> Email:</span>
                    <a href={`mailto:${m.email}`} className="font-medium text-sage-700 truncate max-w-[150px] hover:text-saffron-600">{m.email}</a>
                  </div>
                  <div className="flex items-center justify-between pt-1 border-t border-sage-200/50">
                    <span className="flex items-center gap-1.5 text-sage-400"><Calendar size={13} /> Shift:</span>
                    <span className="bg-white px-2 py-0.5 rounded-md font-semibold text-sage-700 border border-sage-200/60">{m.shift}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-sage-400"><DollarSign size={13} /> Salary:</span>
                    <span className="font-bold text-sage-800">₹{m.monthly_salary.toLocaleString('en-IN')}/mo</span>
                  </div>
                </div>

                {/* Attendance Check-in / Out Action Button */}
                <button
                  onClick={() => toggleAttendance(m)}
                  disabled={checkingId === m.id}
                  className={`w-full py-2.5 rounded-xl font-semibold text-xs flex items-center justify-center gap-2 transition-all duration-200 mb-3 ${
                    isCheckedIn
                      ? 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200'
                      : 'bg-green-600 text-white hover:bg-green-700 shadow-sm'
                  }`}
                >
                  <Clock size={14} />
                  {checkingId === m.id
                    ? 'Updating status...'
                    : isCheckedIn
                    ? 'Check-Out (End Shift)'
                    : 'Check-In (Start Shift)'}
                </button>

                {/* Card Foot Actions */}
                <div className="flex gap-2">
                  <button
                    onClick={() => openEdit(m)}
                    className="flex-1 btn-secondary text-xs py-2 flex items-center justify-center gap-1.5"
                  >
                    <Pencil size={13} /> Edit Profile
                  </button>
                  <button
                    onClick={() => remove(m.id)}
                    className="p-2 bg-red-50 text-red-500 hover:bg-red-100 rounded-xl transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>

      {/* Edit/Add Modal */}
      <AnimatedModal
        isOpen={!!editing}
        onClose={() => setEditing(null)}
        title={editing?.id ? 'Edit Staff Member' : 'Add Team Member'}
      >
        {editing && (
          <div className="space-y-4">
            {errors.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-600 space-y-1">
                {errors.map((e) => (
                  <p key={e}>• {e}</p>
                ))}
              </div>
            )}

            <div>
              <label className="text-xs font-semibold uppercase text-sage-600 block mb-1">Full Name</label>
              <input
                placeholder="e.g. Priya Sharma"
                value={editing.name ?? ''}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-sage-200 text-sm focus:ring-2 focus:ring-saffron-400 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-semibold uppercase text-sage-600 block mb-1">Role / Specialization</label>
              {!customRole ? (
                <select
                  value={editing.role ?? ''}
                  onChange={(e) => {
                    if (e.target.value === '__custom__') {
                      setCustomRole(true)
                      setEditing({ ...editing, role: '' })
                    } else {
                      setEditing({ ...editing, role: e.target.value })
                    }
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-sage-200 bg-white text-sm focus:ring-2 focus:ring-saffron-400 focus:outline-none"
                >
                  <option value="" disabled>Select a role...</option>
                  {ROLE_OPTIONS.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                  <option value="__custom__">+ Custom role title...</option>
                </select>
              ) : (
                <div className="flex gap-2">
                  <input
                    autoFocus
                    placeholder="Type custom role title..."
                    value={editing.role ?? ''}
                    onChange={(e) => setEditing({ ...editing, role: e.target.value })}
                    className="flex-1 px-4 py-2.5 rounded-xl border border-sage-200 text-sm focus:ring-2 focus:ring-saffron-400 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setCustomRole(false)}
                    className="btn-secondary text-xs px-3"
                  >
                    Presets
                  </button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold uppercase text-sage-600 block mb-1">Phone Number</label>
                <input
                  placeholder="e.g. +91 98765 43210"
                  value={editing.phone ?? ''}
                  onChange={(e) => setEditing({ ...editing, phone: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-sage-200 text-sm focus:ring-2 focus:ring-saffron-400 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase text-sage-600 block mb-1">Work Email</label>
                <input
                  type="email"
                  placeholder="e.g. priya@saffronsage.cafe"
                  value={editing.email ?? ''}
                  onChange={(e) => setEditing({ ...editing, email: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-sage-200 text-sm focus:ring-2 focus:ring-saffron-400 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold uppercase text-sage-600 block mb-1">Shift</label>
                <select
                  value={editing.shift ?? 'Morning'}
                  onChange={(e) => setEditing({ ...editing, shift: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-sage-200 bg-white text-sm focus:ring-2 focus:ring-saffron-400 focus:outline-none"
                >
                  <option value="Morning">Morning (7:00 AM - 3:00 PM)</option>
                  <option value="Evening">Evening (3:00 PM - 11:00 PM)</option>
                  <option value="Night">Night (11:00 PM - 7:00 AM)</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase text-sage-600 block mb-1">Monthly Salary (₹)</label>
                <input
                  type="number"
                  min="0"
                  placeholder="e.g. 25000"
                  value={editing.monthly_salary ?? 0}
                  onChange={(e) => setEditing({ ...editing, monthly_salary: parseFloat(e.target.value) })}
                  className="w-full px-4 py-2.5 rounded-xl border border-sage-200 text-sm focus:ring-2 focus:ring-saffron-400 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-3">
              <button onClick={() => setEditing(null)} className="btn-secondary flex-1">
                Cancel
              </button>
              <button onClick={save} className="btn-primary flex-1">
                Save Staff Details
              </button>
            </div>
          </div>
        )}
      </AnimatedModal>
    </div>
  )
}
