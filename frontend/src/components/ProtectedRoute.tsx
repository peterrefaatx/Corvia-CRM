// components/ProtectedRoute.tsx
import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { canAccessRoute, getRoleHomePage, UserRole } from '../config/routePermissions'

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#fafafa' }}>
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  // Check authentication
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // Check authorization - redirect to home page if no access (no error page)
  const userRole = user.role as UserRole
  const currentPath = location.pathname
  const hasAccess = canAccessRoute(currentPath, userRole)

  if (!hasAccess) {
    // Silently redirect to user's home page instead of showing error
    const homePage = getRoleHomePage(userRole)
    return <Navigate to={homePage} replace />
  }

  return <>{children}</>
}

export default ProtectedRoute
