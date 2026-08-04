import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { isValidPhone } from '../lib/validation'
import { supabase } from '../lib/supabaseClient'

export default function Login() {
  const { signIn, signUp } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [resetSent, setResetSent] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (mode === 'forgot') {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      if (resetError) setError(resetError.message)
      else setResetSent(true)
      return
    }

    if (mode === 'signup' && !isValidPhone(phone)) {
      setError('Please enter a valid phone number — we use this to send order and delivery updates via WhatsApp.')
      return
    }

    const result = mode === 'login' ? await signIn(email, password) : await signUp(email, password, fullName, phone)
    if (result.error) setError(result.error)
    else navigate('/')
  }

  async function handleGoogleLogin() {
    setError(null)
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
    if (oauthError) setError(oauthError.message)
  }

  return (
    <div className="max-w-md mx-auto px-6 py-16">
      <h1 className="font-display text-3xl font-bold text-sage-700 mb-6 text-center">
        {mode === 'login' ? 'Welcome Back' : mode === 'signup' ? 'Create Account' : 'Reset Password'}
      </h1>

      {mode === 'forgot' && resetSent ? (
        <div className="card p-6 text-center space-y-3">
          <p className="text-sage-700">Check your email — we've sent a password reset link to <strong>{email}</strong>.</p>
          <button onClick={() => { setMode('login'); setResetSent(false) }} className="text-saffron-600 font-semibold text-sm">Back to Login</button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="card p-6 space-y-4">
          {mode === 'signup' && (
            <>
              <div>
                <label className="text-sm font-medium text-sage-700 block mb-1">Full Name</label>
                <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="e.g. Priya Sharma" className="w-full px-4 py-3 rounded-lg border border-sage-100" required />
              </div>
              <div>
                <label className="text-sm font-medium text-sage-700 block mb-1">Phone Number</label>
                <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="e.g. +91 98765 43210" className="w-full px-4 py-3 rounded-lg border border-sage-100" required />
                <p className="text-xs text-sage-400 mt-1">Used for order updates and delivery contact via WhatsApp.</p>
              </div>
            </>
          )}
          <div>
            <label className="text-sm font-medium text-sage-700 block mb-1">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="e.g. priya@example.com" className="w-full px-4 py-3 rounded-lg border border-sage-100" required />
          </div>
          {mode !== 'forgot' && (
            <div>
              <label className="text-sm font-medium text-sage-700 block mb-1">Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" className="w-full px-4 py-3 rounded-lg border border-sage-100" required />
            </div>
          )}
          {mode === 'login' && (
            <button type="button" onClick={() => setMode('forgot')} className="text-sm text-saffron-600 font-medium -mt-2">Forgot password?</button>
          )}
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button type="submit" className="btn-primary w-full">
            {mode === 'login' ? 'Log In' : mode === 'signup' ? 'Sign Up' : 'Send Reset Link'}
          </button>

          {mode !== 'forgot' && (
            <>
              <div className="flex items-center gap-3 text-xs text-sage-400">
                <div className="flex-1 h-px bg-sage-100" /> OR <div className="flex-1 h-px bg-sage-100" />
              </div>
              <button
                type="button"
                onClick={handleGoogleLogin}
                className="w-full flex items-center justify-center gap-2 border border-sage-200 rounded-lg py-2.5 text-sm font-medium text-sage-700 hover:bg-sage-50"
              >
                <svg width="16" height="16" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l6-6C34.5 5.1 29.5 3 24 3 12.4 3 3 12.4 3 24s9.4 21 21 21 21-9.4 21-21c0-1.4-.1-2.7-.4-4z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.9 18.9 13 24 13c3.1 0 5.8 1.1 8 3l6-6C34.5 5.1 29.5 3 24 3 16.3 3 9.7 7.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 45c5.3 0 10.1-1.8 13.9-4.9l-6.4-5.4C29.4 36.5 26.8 37.5 24 37.5c-5.3 0-9.7-3.4-11.3-8.1l-6.5 5C9.6 40.6 16.3 45 24 45z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.2 5.7l6.4 5.4C41.4 36.6 45 30.9 45 24c0-1.4-.1-2.7-.4-3.5z"/></svg>
                Continue with Google
              </button>
            </>
          )}

          <p className="text-center text-sm text-sage-500">
            {mode === 'login' ? "Don't have an account?" : mode === 'signup' ? 'Already have an account?' : ''}{' '}
            {mode !== 'forgot' && (
              <button type="button" onClick={() => setMode(mode === 'login' ? 'signup' : 'login')} className="text-saffron-600 font-semibold">
                {mode === 'login' ? 'Sign up' : 'Log in'}
              </button>
            )}
            {mode === 'forgot' && (
              <button type="button" onClick={() => setMode('login')} className="text-saffron-600 font-semibold">Back to Login</button>
            )}
          </p>
        </form>
      )}

      <p className="text-center text-xs text-sage-400 mt-4">
        Admin accounts: set the `role` column to 'admin' on the profiles table in Supabase after signup,
        or use Admin → User Roles. Delivery staff: set it to 'delivery'.
      </p>
    </div>
  )
}
