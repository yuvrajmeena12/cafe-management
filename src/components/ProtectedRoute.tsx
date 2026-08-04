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

  if (loading) return <div className="p-10 text-center text-sage-500">Loading...</div>
  if (!profile) return <Navigate to="/login" replace />

  if (adminOnly && !isAdmin) return <Navigate to="/" replace />
  if (allowedRoles && !allowedRoles.includes(profile.role) && !isAdmin) return <Navigate to="/" replace />

  return <>{children}</>
}
