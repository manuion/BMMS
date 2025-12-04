import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function ProtectedRoute({
  children,
  requireAdmin = false,
  requireOrganiser = false,
  requireMember = false,
}) {
  const { user, loading, isAdmin, isOrganiserInAnyCommittee, isMemberInAnyCommittee } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // For admin routes - only admins
  if (requireAdmin && !isAdmin) {
    return <Navigate to={isOrganiserInAnyCommittee() ? '/organiser' : '/member'} replace />;
  }

  // For organiser routes - user must be organiser in at least one committee (or admin)
  if (requireOrganiser && !isAdmin && !isOrganiserInAnyCommittee()) {
    if (isMemberInAnyCommittee()) {
      return <Navigate to="/member" replace />;
    }
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
          <p className="text-gray-600">
            You are not an organiser in any committee. Please contact admin.
          </p>
        </div>
      </div>
    );
  }

  // For member routes - user must be member in at least one committee (or admin/organiser)
  if (requireMember && !isAdmin && !isMemberInAnyCommittee()) {
    if (isOrganiserInAnyCommittee()) {
      return <Navigate to="/organiser" replace />;
    }
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
          <p className="text-gray-600">
            You are not a member in any committee. Please contact admin.
          </p>
        </div>
      </div>
    );
  }

  return children;
}
