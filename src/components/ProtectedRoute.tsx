import { Navigate, useLocation } from 'react-router-dom'
import { ReactNode } from 'react'
import { AlertTriangle, RefreshCw, LogOut } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import type { UserRole } from '../types'

interface Props {
  children: ReactNode
  adminOnly?: boolean
  allowedRoles?: UserRole[]
}

export default function ProtectedRoute({ children, adminOnly = false, allowedRoles }: Props) {
  const location = useLocation()
  const { profile, session, loading, isAdmin, roleError, retryAuth, signOut } = useAuth()

  // 1. Wait until authentication initialization and role verification finish
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4" role="status" aria-live="polite">
        <div className="w-10 h-10 border-3 border-sage-200 border-t-saffron-500 rounded-full animate-spin" />
        <p className="text-sm text-sage-400 font-medium animate-pulse">Verifying access…</p>
      </div>
    )
  }

  // 2. Safe error/retry state if role or session loading encountered an error (never grant access prematurely)
  if (roleError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
        <div className="max-w-md w-full bg-white rounded-2xl p-6 border border-amber-200 shadow-sm flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center">
            <AlertTriangle size={24} />
          </div>
          <div>
            <h2 className="text-base font-bold text-sage-900 mb-1">Permission Verification Failed</h2>
            <p className="text-xs text-sage-600 leading-relaxed">
              {roleError}
            </p>
          </div>
          <div className="flex items-center gap-3 w-full justify-center pt-2">
            <button
              type="button"
              onClick={() => retryAuth()}
              className="flex items-center gap-2 px-4 py-2 bg-saffron-500 hover:bg-saffron-600 text-white text-xs font-semibold rounded-xl transition-colors shadow-sm"
            >
              <RefreshCw size={14} />
              <span>Retry Verification</span>
            </button>
            <button
              type="button"
              onClick={() => signOut()}
              className="flex items-center gap-2 px-4 py-2 bg-sage-100 hover:bg-sage-200 text-sage-700 text-xs font-semibold rounded-xl transition-colors"
            >
              <LogOut size={14} />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </div>
    )
  }

  // 3. Genuinely unauthenticated user: redirect to /login preserving deep link
  if (!session && !profile) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // 4. If session is present but profile is still resolving without explicit roleError
  if (!profile) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4" role="status" aria-live="polite">
        <div className="w-10 h-10 border-3 border-sage-200 border-t-saffron-500 rounded-full animate-spin" />
        <p className="text-sm text-sage-400 font-medium animate-pulse">Loading profile…</p>
      </div>
    )
  }

  // 5. Role authorization checks
  if (adminOnly && !isAdmin) return <Navigate to="/" replace />
  if (allowedRoles && !allowedRoles.includes(profile.role) && !isAdmin) return <Navigate to="/" replace />

  return <>{children}</>
}
