import { useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Mail, Lock, User, Phone, CheckCircle, AlertCircle, ArrowRight,
  RefreshCw, Loader2, Eye, EyeOff, ShieldCheck
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import {
  isValidPhone, isValidEmail, isValidName, isValidPassword, getPasswordStrength, sanitizeErrorMessage,
} from '../lib/validation'
import { supabase } from '../lib/supabaseClient'
import AnimatedPage from '../components/AnimatedPage'

// ── Configurable submission cooldown (ms) ────────────────────
const SUBMIT_COOLDOWN_MS = 2000

export default function Login() {
  const { signIn, signUp, resendVerificationEmail } = useAuth()
  const navigate = useNavigate()

  // ── Core state ─────────────────────────────────────────────
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot' | 'verify_notice'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')

  // ── Feedback state ─────────────────────────────────────────
  const [error, setError] = useState<string | null>(null)
  const [resetSent, setResetSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [resendStatus, setResendStatus] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)

  // ── Inline field-level errors (shown onBlur) ───────────────
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  // ── Rate-limit: submission cooldown ────────────────────────
  const lastSubmitRef = useRef<number>(0)

  // ── Password strength (signup only) ────────────────────────
  const strength = mode === 'signup' ? getPasswordStrength(password) : null

  // ── Field-level onBlur validation ──────────────────────────
  const validateField = useCallback(
    (field: string) => {
      setFieldErrors((prev) => {
        const next = { ...prev }
        switch (field) {
          case 'email':
            if (email.trim() && !isValidEmail(email))
              next.email = 'Please enter a valid email address.'
            else delete next.email
            break
          case 'password':
            if (mode === 'signup' && password) {
              const { valid, errors } = isValidPassword(password)
              if (!valid) next.password = errors.join(', ')
              else delete next.password
            } else if (mode === 'login' && password.length === 0) {
              next.password = 'Password is required.'
            } else {
              delete next.password
            }
            break
          case 'fullName':
            if (fullName.trim() && !isValidName(fullName))
              next.fullName = 'Name must be 2–100 characters.'
            else delete next.fullName
            break
          case 'phone':
            if (phone.trim() && !isValidPhone(phone))
              next.phone = 'Enter a valid 10–15 digit phone number.'
            else delete next.phone
            break
        }
        return next
      })
    },
    [email, password, fullName, phone, mode]
  )

  // ── Submission handler ─────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    // Rate-limit: enforce cooldown
    const now = Date.now()
    if (now - lastSubmitRef.current < SUBMIT_COOLDOWN_MS) {
      setError('Please wait a moment before trying again.')
      return
    }
    lastSubmitRef.current = now
    setLoading(true)

    try {
      // ── Forgot password ──────────────────────────────────
      if (mode === 'forgot') {
        if (!isValidEmail(email)) {
          setError('Please enter a valid email address.')
          return
        }
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/reset-password`,
        })
        if (resetError) setError(sanitizeErrorMessage(resetError.message))
        else setResetSent(true)
        return
      }

      // ── Signup ───────────────────────────────────────────
      if (mode === 'signup') {
        if (!isValidName(fullName)) {
          setError('Please enter your full name (2–100 characters).')
          return
        }
        if (!isValidPhone(phone)) {
          setError('Please enter a valid phone number (10–15 digits) for delivery contact.')
          return
        }
        if (!isValidEmail(email)) {
          setError('Please enter a valid email address.')
          return
        }
        const pwCheck = isValidPassword(password)
        if (!pwCheck.valid) {
          setError(`Password requirements: ${pwCheck.errors.join(', ')}.`)
          return
        }

        const result = await signUp(email.trim(), password, fullName.trim(), phone.trim())
        if (result.error) {
          setError(sanitizeErrorMessage(result.error))
        } else if (result.needsVerification) {
          setMode('verify_notice')
        } else {
          navigate('/')
        }
        return
      }

      // ── Login ────────────────────────────────────────────
      if (mode === 'login') {
        if (!isValidEmail(email)) {
          setError('Please enter a valid email address.')
          return
        }
        if (!password) {
          setError('Please enter your password.')
          return
        }

        const result = await signIn(email.trim(), password)
        if (result.error) {
          setError(sanitizeErrorMessage(result.error))
          if (result.needsVerification) {
            setMode('verify_notice')
          }
        } else {
          navigate('/')
        }
      }
    } catch (err: any) {
      console.error('Submit exception:', err)
      setError(sanitizeErrorMessage(err?.message, 'An unexpected error occurred. Please try again.'))
    } finally {
      setLoading(false)
    }
  }

  // ── Resend verification email ──────────────────────────────
  async function handleResendEmail() {
    if (!email) return
    setResendStatus('Sending verification link…')
    const res = await resendVerificationEmail(email)
    if (res.error) {
      setResendStatus(`Failed: ${sanitizeErrorMessage(res.error)}`)
    } else {
      setResendStatus('Verification email resent! Check your inbox.')
    }
  }

  // ── Google OAuth ───────────────────────────────────────────
  async function handleGoogleLogin() {
    if (loading) return
    setError(null)
    try {
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin },
      })
      if (oauthError) setError(sanitizeErrorMessage(oauthError.message))
    } catch (err: any) {
      setError(sanitizeErrorMessage(err?.message, 'Google sign-in failed.'))
    }
  }

  // ── Helper: render inline error under a field ──────────────
  function FieldError({ field }: { field: string }) {
    const msg = fieldErrors[field]
    if (!msg) return null
    return (
      <p className="text-red-500 text-xs mt-1 flex items-center gap-1" role="alert">
        <AlertCircle size={12} className="shrink-0" /> {msg}
      </p>
    )
  }

  // ── Render ─────────────────────────────────────────────────
  return (
    <AnimatedPage className="max-w-md mx-auto px-6 py-16">
      <div className="text-center mb-8">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.4 }}
          className="w-16 h-16 bg-gradient-to-tr from-saffron-500 to-saffron-400 rounded-3xl mx-auto flex items-center justify-center text-white text-2xl shadow-lg shadow-saffron-500/20 mb-4 animate-float"
        >
          🌿
        </motion.div>
        <h1 className="font-display text-3xl font-bold text-sage-800">
          {mode === 'login' && 'Welcome Back'}
          {mode === 'signup' && 'Create Account'}
          {mode === 'forgot' && 'Reset Password'}
          {mode === 'verify_notice' && 'Verify Your Email'}
        </h1>
        <p className="text-sage-500 text-sm mt-1">
          {mode === 'login' && 'Log in to track orders, manage favorites, and view invoices.'}
          {mode === 'signup' && 'Sign up for fast checkout and exclusive offers.'}
          {mode === 'forgot' && "Enter your email to receive a password reset link."}
          {mode === 'verify_notice' && "We've sent a verification link to your email address."}
        </p>
      </div>

      <AnimatePresence mode="wait">
        {mode === 'verify_notice' ? (
          <motion.div
            key="verify_notice"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="card p-8 text-center space-y-4 border-saffron-200/60 shadow-xl"
          >
            <div className="w-14 h-14 bg-saffron-50 rounded-2xl flex items-center justify-center text-saffron-500 mx-auto">
              <Mail size={28} />
            </div>
            <h3 className="font-bold text-xl text-sage-800">Check Your Inbox</h3>
            <p className="text-sm text-sage-600 leading-relaxed">
              We sent a verification email to <strong className="text-sage-800">{email}</strong>. Please click the confirmation link to activate your account.
            </p>

            <div className="pt-2">
              <button
                type="button"
                onClick={handleResendEmail}
                className="text-sm font-semibold text-saffron-600 hover:text-saffron-700 flex items-center justify-center gap-1.5 mx-auto"
              >
                <RefreshCw size={14} /> Resend verification email
              </button>
              {resendStatus && (
                <p className="text-xs text-sage-500 mt-2 bg-sage-50 py-1.5 px-3 rounded-lg">{resendStatus}</p>
              )}
            </div>

            <button
              onClick={() => { setMode('login'); setError(null) }}
              className="btn-primary w-full mt-4"
            >
              Back to Login
            </button>
          </motion.div>
        ) : mode === 'forgot' && resetSent ? (
          <motion.div
            key="forgot_sent"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="card p-8 text-center space-y-4 shadow-xl"
          >
            <div className="w-14 h-14 bg-green-50 rounded-2xl flex items-center justify-center text-green-500 mx-auto">
              <CheckCircle size={28} />
            </div>
            <h3 className="font-bold text-xl text-sage-800">Reset Link Dispatched</h3>
            <p className="text-sm text-sage-600">
              Check your email — we sent instructions to <strong>{email}</strong>.
            </p>
            <button
              onClick={() => { setMode('login'); setResetSent(false) }}
              className="btn-primary w-full mt-2"
            >
              Back to Login
            </button>
          </motion.div>
        ) : (
          <motion.form
            key={mode}
            initial={{ opacity: 0, x: mode === 'signup' ? 20 : -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: mode === 'signup' ? -20 : 20 }}
            transition={{ duration: 0.25 }}
            onSubmit={handleSubmit}
            className="card p-6 sm:p-8 space-y-4 shadow-xl"
            noValidate
          >
            {/* ── Signup-only fields ──────────────────────── */}
            {mode === 'signup' && (
              <>
                <div>
                  <label htmlFor="auth-fullname" className="text-sm font-medium text-sage-700 block mb-1">Full Name</label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sage-400" size={16} />
                    <input
                      id="auth-fullname"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      onBlur={() => validateField('fullName')}
                      placeholder="e.g. Priya Sharma"
                      maxLength={100}
                      autoComplete="name"
                      aria-describedby={fieldErrors.fullName ? 'err-fullname' : undefined}
                      className={`w-full pl-10 pr-4 py-3 rounded-xl border transition-all focus:ring-2 focus:ring-saffron-400 focus:outline-none ${
                        fieldErrors.fullName ? 'border-red-300 bg-red-50/30' : 'border-sage-200/80'
                      }`}
                      required
                    />
                  </div>
                  {fieldErrors.fullName && <p id="err-fullname" className="text-red-500 text-xs mt-1 flex items-center gap-1" role="alert"><AlertCircle size={12} className="shrink-0" /> {fieldErrors.fullName}</p>}
                </div>

                <div>
                  <label htmlFor="auth-phone" className="text-sm font-medium text-sage-700 block mb-1">Phone Number</label>
                  <div className="relative">
                    <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sage-400" size={16} />
                    <input
                      id="auth-phone"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      onBlur={() => validateField('phone')}
                      placeholder="e.g. +91 98765 43210"
                      maxLength={20}
                      autoComplete="tel"
                      aria-describedby={fieldErrors.phone ? 'err-phone' : undefined}
                      className={`w-full pl-10 pr-4 py-3 rounded-xl border transition-all focus:ring-2 focus:ring-saffron-400 focus:outline-none ${
                        fieldErrors.phone ? 'border-red-300 bg-red-50/30' : 'border-sage-200/80'
                      }`}
                      required
                    />
                  </div>
                  {fieldErrors.phone && <p id="err-phone" className="text-red-500 text-xs mt-1 flex items-center gap-1" role="alert"><AlertCircle size={12} className="shrink-0" /> {fieldErrors.phone}</p>}
                  <p className="text-xs text-sage-400 mt-1">Used exclusively for delivery contact.</p>
                </div>
              </>
            )}

            {/* ── Email ───────────────────────────────────── */}
            <div>
              <label htmlFor="auth-email" className="text-sm font-medium text-sage-700 block mb-1">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sage-400" size={16} />
                <input
                  id="auth-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onBlur={() => validateField('email')}
                  placeholder="e.g. priya@example.com"
                  maxLength={254}
                  autoComplete="email"
                  aria-describedby={fieldErrors.email ? 'err-email' : undefined}
                  className={`w-full pl-10 pr-4 py-3 rounded-xl border transition-all focus:ring-2 focus:ring-saffron-400 focus:outline-none ${
                    fieldErrors.email ? 'border-red-300 bg-red-50/30' : 'border-sage-200/80'
                  }`}
                  required
                />
              </div>
              {fieldErrors.email && <p id="err-email" className="text-red-500 text-xs mt-1 flex items-center gap-1" role="alert"><AlertCircle size={12} className="shrink-0" /> {fieldErrors.email}</p>}
            </div>

            {/* ── Password (login + signup) ────────────────── */}
            {mode !== 'forgot' && (
              <div>
                <label htmlFor="auth-password" className="text-sm font-medium text-sage-700 block mb-1">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sage-400" size={16} />
                  <input
                    id="auth-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onBlur={() => validateField('password')}
                    placeholder={mode === 'signup' ? 'Min 6 chars, upper, lower, number' : 'Your password'}
                    maxLength={72}
                    autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                    aria-describedby={fieldErrors.password ? 'err-password' : undefined}
                    className={`w-full pl-10 pr-12 py-3 rounded-xl border transition-all focus:ring-2 focus:ring-saffron-400 focus:outline-none ${
                      fieldErrors.password ? 'border-red-300 bg-red-50/30' : 'border-sage-200/80'
                    }`}
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
                {fieldErrors.password && <p id="err-password" className="text-red-500 text-xs mt-1 flex items-center gap-1" role="alert"><AlertCircle size={12} className="shrink-0" /> {fieldErrors.password}</p>}

                {/* ── Password strength indicator (signup) ── */}
                {mode === 'signup' && password.length > 0 && strength && (
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
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-sage-500 flex items-center gap-1">
                        <ShieldCheck size={12} /> {strength.label}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Forgot password link (login mode) ───────── */}
            {mode === 'login' && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => { setMode('forgot'); setError(null) }}
                  className="text-xs font-semibold text-saffron-600 hover:text-saffron-700"
                >
                  Forgot password?
                </button>
              </div>
            )}

            {/* ── Global error banner ─────────────────────── */}
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

            {/* ── Submit button ────────────────────────────── */}
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full flex items-center justify-center gap-2 text-base font-semibold py-3"
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="animate-spin" /> Processing…
                </>
              ) : (
                <>
                  {mode === 'login' && 'Log In'}
                  {mode === 'signup' && 'Create Account'}
                  {mode === 'forgot' && 'Send Reset Link'}
                  <ArrowRight size={16} />
                </>
              )}
            </button>

            {/* ── Divider + Google OAuth ───────────────────── */}
            {mode !== 'forgot' && (
              <>
                <div className="flex items-center gap-3 text-xs text-sage-400 py-1">
                  <div className="flex-1 h-px bg-sage-100" /> OR <div className="flex-1 h-px bg-sage-100" />
                </div>
                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2.5 border border-sage-200/90 rounded-xl py-2.5 text-sm font-medium text-sage-700 hover:bg-sage-50/80 transition-all shadow-sm active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg width="18" height="18" viewBox="0 0 48 48">
                    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l6-6C34.5 5.1 29.5 3 24 3 12.4 3 3 12.4 3 24s9.4 21 21 21 21-9.4 21-21c0-1.4-.1-2.7-.4-4z"/>
                    <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.9 18.9 13 24 13c3.1 0 5.8 1.1 8 3l6-6C34.5 5.1 29.5 3 24 3 16.3 3 9.7 7.3 6.3 14.7z"/>
                    <path fill="#4CAF50" d="M24 45c5.3 0 10.1-1.8 13.9-4.9l-6.4-5.4C29.4 36.5 26.8 37.5 24 37.5c-5.3 0-9.7-3.4-11.3-8.1l-6.5 5C9.6 40.6 16.3 45 24 45z"/>
                    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.2 5.7l6.4 5.4C41.4 36.6 45 30.9 45 24c0-1.4-.1-2.7-.4-3.5z"/>
                  </svg>
                  Continue with Google
                </button>
              </>
            )}

            {/* ── Mode toggle links ───────────────────────── */}
            <div className="text-center pt-2 text-sm text-sage-600">
              {mode === 'login' ? (
                <>
                  Don't have an account?{' '}
                  <button
                    type="button"
                    onClick={() => { setMode('signup'); setError(null); setFieldErrors({}) }}
                    className="text-saffron-600 font-bold hover:underline"
                  >
                    Sign up
                  </button>
                </>
              ) : mode === 'signup' ? (
                <>
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => { setMode('login'); setError(null); setFieldErrors({}) }}
                    className="text-saffron-600 font-bold hover:underline"
                  >
                    Log in
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => { setMode('login'); setError(null); setFieldErrors({}) }}
                  className="text-saffron-600 font-bold hover:underline"
                >
                  Back to Login
                </button>
              )}
            </div>
          </motion.form>
        )}
      </AnimatePresence>
    </AnimatedPage>
  )
}
