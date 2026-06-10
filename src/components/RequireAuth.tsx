import { Navigate, useLocation } from 'react-router-dom'
import { isAuthenticated } from '@/utils/auth-session'

type RequireAuthProps = {
  children: React.ReactNode
}

export function RequireAuth({ children }: RequireAuthProps) {
  const location = useLocation()

  if (!isAuthenticated()) {
    return <Navigate to="/" replace state={{ from: location }} />
  }

  return <>{children}</>
}
