import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

/**
 * Wraps a route and redirects to /login if the user's role is not in allowedRoles.
 * allowedRoles: array of strings, e.g. ['admin', 'hospital', 'guest']
 */
export default function ProtectedRoute({ children, allowedRoles }) {
    const { user } = useAuth();

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    if (allowedRoles && !allowedRoles.includes(user.role)) {
        // Redirect to the user's home based on role
        if (user.role === 'admin') return <Navigate to="/system-admin" replace />;
        if (user.role === 'hospital') return <Navigate to="/hospital-admin" replace />;
        return <Navigate to="/patient" replace />;
    }

    return children;
}
