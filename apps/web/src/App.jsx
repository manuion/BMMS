import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/common/ProtectedRoute';
import Layout from './components/layout/Layout';

// Auth Pages
import Login from './pages/auth/Login';

// Admin Pages
import AdminDashboard from './pages/admin/Dashboard';
import Committees from './pages/admin/Committees';
import CommitteeDetail from './pages/admin/CommitteeDetail';
import Users from './pages/admin/Users';

// Organiser Pages
import OrganiserDashboard from './pages/organiser/Dashboard';
import Meetings from './pages/organiser/Meetings';
import CreateMeeting from './pages/organiser/CreateMeeting';
import EditMeeting from './pages/organiser/EditMeeting';
import MeetingDetail from './pages/organiser/MeetingDetail';

// Member Pages
import MemberDashboard from './pages/member/Dashboard';
import MemberMeetings from './pages/member/Meetings';
import MemberMeetingDetail from './pages/member/MeetingDetail';

function AppRoutes() {
  const { user, loading, isAdmin, isOrganiserInAnyCommittee, isMemberInAnyCommittee } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <Routes>
      {/* Public Routes */}
      <Route
        path="/login"
        element={user ? <Navigate to={isAdmin ? '/admin' : '/organiser'} /> : <Login />}
      />

      {/* Admin Routes */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute requireAdmin>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<AdminDashboard />} />
        <Route path="committees" element={<Committees />} />
        <Route path="committees/:id" element={<CommitteeDetail />} />
        <Route path="users" element={<Users />} />
      </Route>

      {/* Organiser Routes */}
      <Route
        path="/organiser"
        element={
          <ProtectedRoute requireOrganiser>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<OrganiserDashboard />} />
        <Route path="meetings" element={<Meetings />} />
        <Route path="meetings/new" element={<CreateMeeting />} />
        <Route path="meetings/:id" element={<MeetingDetail />} />
        <Route path="meetings/:id/edit" element={<EditMeeting />} />
      </Route>

      {/* Member Routes */}
      <Route
        path="/member"
        element={
          <ProtectedRoute requireMember>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<MemberDashboard />} />
        <Route path="meetings" element={<MemberMeetings />} />
        <Route path="meetings/:id" element={<MemberMeetingDetail />} />
      </Route>

      {/* Root Redirect */}
      <Route
        path="/"
        element={
          user ? (
            <Navigate to={isAdmin ? '/admin' : isOrganiserInAnyCommittee() ? '/organiser' : '/member'} />
          ) : (
            <Navigate to="/login" />
          )
        }
      />

      {/* 404 */}
      <Route
        path="*"
        element={
          <div className="min-h-screen flex items-center justify-center">
            <div className="text-center">
              <h1 className="text-4xl font-bold text-gray-900 mb-2">404</h1>
              <p className="text-gray-600">Page not found</p>
            </div>
          </div>
        }
      />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
