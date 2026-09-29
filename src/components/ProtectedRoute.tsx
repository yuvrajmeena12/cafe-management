import { Navigate } from 'react-router-dom'
import { ReactNode } from 'react'
import { useAuth } from '../context/AuthContext'
import type { UserRole } from '../types'

interface Props {
  children: ReactNode
  adminOnly?: boolean
  allowedRoles?: UserRole[]
}

export default function ProtectedRoute({ children, adminOnly = false, allowedRoles }: Props) {
  const { profile, loading, isAdmin } = useAuth()

  if (loading)
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-10 h-10 border-3 border-sage-200 border-t-saffron-500 rounded-full animate-spin" />
        <p className="text-sm text-sage-400 font-medium animate-pulse">Verifying access…</p>
      </div>
    )
  if (!profile) return <Navigate to="/login" replace />

  if (adminOnly && !isAdmin) return <Navigate to="/" replace />
  if (allowedRoles && !allowedRoles.includes(profile.role) && !isAdmin) return <Navigate to="/" replace />

  return <>{children}</>
}
