import { Navigate, useLocation } from 'react-router-dom'
import { Box, CircularProgress } from '@mui/material'
import { useAuth } from '../hooks/useAuth'

interface Props {
  children: React.ReactNode
  requirePermission?: string
}

export function AuthGuard({ children, requirePermission }: Props) {
  const { user, profile, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <Box display="flex" alignItems="center" justifyContent="center" minHeight="100vh">
        <CircularProgress />
      </Box>
    )
  }

  if (!user || !profile) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (requirePermission && !profile.permissions.includes(requirePermission)) {
    return <Navigate to="/app/schedule" replace />
  }

  return <>{children}</>
}
