import { Navigate } from 'react-router-dom'
import { auth } from '@lib/api'

export const RequireAuth = ({ children }: { children: React.ReactNode }) =>
  auth.isLoggedIn() ? <>{children}</> : <Navigate to="/login" replace />
