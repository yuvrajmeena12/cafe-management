import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Lock, Eye, EyeOff, ShieldCheck, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { isValidPassword, getPasswordStrength, sanitizeErrorMessage } from '../lib/validation'
import AnimatedPage from '../components/AnimatedPage'

export default function ResetPassword() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const strength = getPasswordStrength(password)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const pwCheck = isValidPassword(password)
    if (!pwCheck.valid) {
      setError(`Password requirements: ${pwCheck.errors.join(', ')}.`)
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (updateError) {
      setError(sanitizeErrorMessage(updateError.message))
      return
    }
    setSuccess(true)
    setTimeout(() => navigate('/'), 2000)
  }

  return (
    <AnimatedPage className="max-w-md mx-auto px-6 py-16">
      <div className="text-center mb-8">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-16 h-16 bg-gradient-to-tr from-saffron-500 to-saffron-400 rounded-3xl mx-auto flex items-center justify-center text-white text-2xl shadow-lg shadow-saffron-500/20 mb-4"
        >
          <Lock size={28} />
        </motion.div>
        <h1 className="font-display text-3xl font-bold text-sage-800">Set a New Password</h1>
        <p className="text-sage-500 text-sm mt-1">Choose a strong password to secure your account.</p>
      </div>

      {success ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="card p-8 text-center space-y-3 shadow-xl"
        >
          <div className="w-14 h-14 bg-green-50 rounded-2xl flex items-center justify-center text-green-500 mx-auto">
            <CheckCircle size={28} />
          </div>
          <h3 className="font-bold text-xl text-sage-800">Password Updated!</h3>
          <p className="text-sm text-sage-600">Redirecting you home…</p>
        </motion.div>
      ) : (
        <form onSubmit={handleSubmit} className="card p-6 sm:p-8 space-y-4 shadow-xl" noValidate>
          <div>
            <label htmlFor="reset-password" className="text-sm font-medium text-sage-700 block mb-1">New Password</label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sage-400" size={16} />
              <input
                id="reset-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min 6 chars, upper, lower, number"
                maxLength={72}
                autoComplete="new-password"
                className="w-full pl-10 pr-12 py-3 rounded-xl border border-sage-200/80 focus:ring-2 focus:ring-saffron-400 focus:outline-none transition-all"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-sage-400 hover:text-sage-600 transition-colors p-0.5"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            {/* Strength indicator */}
            {password.length > 0 && (
              <div className="mt-2 space-y-1">
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div
                      key={i}
                      className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                        i <= strength.score ? strength.color : 'bg-sage-100'
                      }`}
                    />
                  ))}
                </div>
                <span className="text-xs text-sage-500 flex items-center gap-1">
                  <ShieldCheck size={12} /> {strength.label}
                </span>
              </div>
            )}
          </div>

          <div>
            <label htmlFor="reset-confirm" className="text-sm font-medium text-sage-700 block mb-1">Confirm New Password</label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sage-400" size={16} />
              <input
                id="reset-confirm"
                type={showConfirm ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter your new password"
                maxLength={72}
                autoComplete="new-password"
                className={`w-full pl-10 pr-12 py-3 rounded-xl border transition-all focus:ring-2 focus:ring-saffron-400 focus:outline-none ${
                  confirmPassword && confirmPassword !== password ? 'border-red-300 bg-red-50/30' : 'border-sage-200/80'
                }`}
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirm((s) => !s)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-sage-400 hover:text-sage-600 transition-colors p-0.5"
                aria-label={showConfirm ? 'Hide confirm password' : 'Show confirm password'}
                tabIndex={-1}
              >
                {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {confirmPassword && confirmPassword !== password && (
              <p className="text-red-500 text-xs mt-1 flex items-center gap-1" role="alert">
                <AlertCircle size={12} /> Passwords do not match.
              </p>
            )}
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-red-50/90 border border-red-200 text-red-600 text-xs sm:text-sm p-3.5 rounded-xl flex items-start gap-2"
              role="alert"
            >
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </motion.div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full flex items-center justify-center gap-2 py-3 text-base font-semibold"
          >
            {loading ? (
              <><Loader2 size={18} className="animate-spin" /> Updating…</>
            ) : (
              'Update Password'
            )}
          </button>
        </form>
      )}
    </AnimatedPage>
  )
}
