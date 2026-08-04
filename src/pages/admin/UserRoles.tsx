import { useEffect, useState } from 'react'
import { UserCog, Plus, Trash2, Loader2, Clock } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'

interface UserRow { id: string; full_name: string | null; role: string; email: string }
interface InviteRow { email: string; role: string }

const ROLES = ['customer', 'staff', 'delivery', 'admin']

export default function UserRoles() {
  const [users, setUsers] = useState<UserRow[]>([])
  const [invites, setInvites] = useState<InviteRow[]>([])
  const [loading, setLoading] = useState(true)
  const [newEmail, setNewEmail] = useState('')
  const [newRole, setNewRole] = useState('delivery')
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    const { data } = await supabase.functions.invoke('admin-manage-role', { body: { action: 'list' } })
    setUsers(data?.users ?? [])
    setInvites(data?.invites ?? [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function assignRole(email: string, role: string) {
    setSaving(true)
    setStatus(null)
    const { data, error } = await supabase.functions.invoke('admin-manage-role', { body: { action: 'set', email, role } })
    setSaving(false)
    if (error || data?.error) {
      setStatus(`Failed: ${data?.error ?? error?.message}`)
      return
    }
    setStatus(
      data.applied === 'immediately'
        ? `Done — ${email} is now ${role}.`
        : `Saved — ${email} will become ${role} automatically the moment they sign up.`
    )
    load()
  }

  async function removeInvite(email: string) {
    await supabase.functions.invoke('admin-manage-role', { body: { action: 'remove_invite', email } })
    load()
  }

  if (loading) return <div className="p-10 text-center text-sage-500">Loading...</div>

  return (
    <div className="max-w-3xl">
      <h1 className="font-display text-3xl font-bold text-sage-700 mb-1 flex items-center gap-2">
        <UserCog size={28} className="text-saffron-500" /> User Roles
      </h1>
      <p className="text-sage-500 mb-6">
        Assign admin, delivery, or staff access to any email — works even before that person has signed up.
      </p>

      <div className="card p-6 mb-6">
        <h2 className="font-bold text-sage-700 mb-3">Assign a Role</h2>
        <div className="flex gap-2">
          <input value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="person@example.com" className="flex-1 px-4 py-2 rounded-lg border border-sage-100" />
          <select value={newRole} onChange={(e) => setNewRole(e.target.value)} className="px-4 py-2 rounded-lg border border-sage-100 bg-white">
            {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <button
            onClick={() => { assignRole(newEmail, newRole); setNewEmail('') }}
            disabled={saving || !newEmail.trim()}
            className="btn-primary flex items-center gap-1.5"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Assign
          </button>
        </div>
        {status && <p className="text-sm text-sage-600 mt-2">{status}</p>}
      </div>

      {invites.length > 0 && (
        <div className="card p-6 mb-6">
          <h2 className="font-bold text-sage-700 mb-3 flex items-center gap-2"><Clock size={16} /> Pending (not signed up yet)</h2>
          <div className="space-y-2">
            {invites.map((inv) => (
              <div key={inv.email} className="flex items-center justify-between bg-sage-50 rounded-lg px-4 py-2">
                <div><span className="font-medium text-sage-700">{inv.email}</span> <span className="text-xs text-sage-500">→ will become {inv.role}</span></div>
                <button onClick={() => removeInvite(inv.email)} className="p-1.5 bg-red-50 text-red-500 rounded-md"><Trash2 size={13} /></button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card p-6">
        <h2 className="font-bold text-sage-700 mb-3">Current Users</h2>
        <div className="space-y-2">
          {users.map((u) => (
            <div key={u.id} className="flex items-center justify-between bg-sage-50 rounded-lg px-4 py-2">
              <div>
                <div className="font-medium text-sage-700">{u.full_name ?? '(no name)'}</div>
                <div className="text-xs text-sage-500">{u.email}</div>
              </div>
              <select
                value={u.role}
                onChange={(e) => assignRole(u.email, e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-sage-100 bg-white text-sm"
              >
                {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
