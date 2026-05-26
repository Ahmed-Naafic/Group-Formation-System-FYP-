import { useSelector } from 'react-redux';
import { Navigate, useLocation } from 'react-router-dom';
import {
  selectIsAuth,
  selectMustChangePassword,
  selectRole,
} from '@/features/auth/authSlice';

/**
 * Wraps a route that requires authentication.
 * - No token → /login
 * - mustChangePassword → /change-password (blocks everything else)
 * - roles prop → only the listed roles can access; others redirect to /
 */
export default function ProtectedRoute({ children, roles }) {
  const location          = useLocation();
  const isAuth            = useSelector(selectIsAuth);
  const mustChange        = useSelector(selectMustChangePassword);
  const role              = useSelector(selectRole);

  if (!isAuth) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (mustChange && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />;
  }

  if (roles && !roles.includes(role)) {
    return <Navigate to="/" replace />;
  }

  return children;
}
