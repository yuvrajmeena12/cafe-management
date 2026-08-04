import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

export default function ResetPassword() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const navigate = useNavigate()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password.length < 6) { setError('Password must be at least 6 characters.'); return }
    if (password !== confirmPassword) { setError('Passwords do not match.'); return }

    const { error: updateError } = await supabase.auth.updateUser({ password })
    if (updateError) {
      setError(updateError.message)
      return
    }
    setSuccess(true)
    setTimeout(() => navigate('/'), 2000)
  }

  return (
    <div className="max-w-md mx-auto px-6 py-16">
      <h1 className="font-display text-3xl font-bold text-sage-700 mb-6 text-center">Set a New Password</h1>
      {success ? (
        <div className="card p-6 text-center text-green-600">Password updated! Redirecting you home...</div>
      ) : (
        <form onSubmit={handleSubmit} className="card p-6 space-y-4">
          <div>
            <label className="text-sm font-medium text-sage-700 block mb-1">New Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" className="w-full px-4 py-3 rounded-lg border border-sage-100" required />
          </div>
          <div>
            <label className="text-sm font-medium text-sage-700 block mb-1">Confirm New Password</label>
            <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="w-full px-4 py-3 rounded-lg border border-sage-100" required />
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button type="submit" className="btn-primary w-full">Update Password</button>
        </form>
      )}
    </div>
  )
}
