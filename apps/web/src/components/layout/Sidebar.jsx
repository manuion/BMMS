import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Building2,
  Calendar,
  LogOut,
  ChevronLeft,
  ChevronRight,
  UserCircle,
  ArrowLeftRight,
} from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const { user, logout, isAdmin, isOrganiserInAnyCommittee, isMemberInAnyCommittee } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Determine current section based on URL
  const currentSection = location.pathname.startsWith('/admin')
    ? 'admin'
    : location.pathname.startsWith('/organiser')
    ? 'organiser'
    : 'member';

  const adminLinks = [
    { to: '/admin', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/admin/committees', icon: Building2, label: 'Committees' },
    { to: '/admin/users', icon: Users, label: 'Users' },
  ];

  const organiserLinks = [
    { to: '/organiser', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/organiser/meetings', icon: Calendar, label: 'Meetings' },
  ];

  const memberLinks = [
    { to: '/member', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/member/meetings', icon: Calendar, label: 'My Meetings' },
  ];

  // Get links based on current section
  const links =
    currentSection === 'admin'
      ? adminLinks
      : currentSection === 'organiser'
      ? organiserLinks
      : memberLinks;

  // Get current role label
  const getCurrentRole = () => {
    if (currentSection === 'admin') return 'Admin';
    if (currentSection === 'organiser') return 'Organiser';
    return 'Member';
  };

  return (
    <div
      className={`bg-gray-900 text-white h-screen flex flex-col transition-all duration-300 ${
        collapsed ? 'w-16' : 'w-64'
      }`}
    >
      {/* Header */}
      <div className="p-4 border-b border-gray-700 flex items-center justify-between">
        {!collapsed && <h1 className="text-xl font-bold">BMMS</h1>}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1 rounded hover:bg-gray-700"
        >
          {collapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
        </button>
      </div>

      {/* User Info */}
      {!collapsed && (
        <div className="p-4 border-b border-gray-700">
          <p className="font-medium truncate">{user?.name}</p>
          <p className="text-sm text-gray-400 truncate">{user?.email}</p>
          <span className="inline-block mt-2 px-2 py-1 text-xs bg-primary-600 rounded">
            {getCurrentRole()}
          </span>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 p-2">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.to === '/admin' || link.to === '/organiser' || link.to === '/member'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg mb-1 transition-colors ${
                isActive
                  ? 'bg-primary-600 text-white'
                  : 'text-gray-300 hover:bg-gray-800'
              }`
            }
          >
            <link.icon size={20} />
            {!collapsed && <span>{link.label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Switch View Options */}
      {!collapsed && (
        <div className="p-2 border-t border-gray-700">
          <p className="px-3 py-1 text-xs text-gray-500 uppercase">Switch to</p>

          {/* Show Admin option if user is admin and not on admin page */}
          {isAdmin && currentSection !== 'admin' && (
            <button
              onClick={() => navigate('/admin')}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-gray-300 hover:bg-gray-800"
            >
              <Users size={20} />
              <span>Admin View</span>
            </button>
          )}

          {/* Show Organiser option if user is organiser and not on organiser page */}
          {isOrganiserInAnyCommittee() && currentSection !== 'organiser' && (
            <button
              onClick={() => navigate('/organiser')}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-gray-300 hover:bg-gray-800"
            >
              <Calendar size={20} />
              <span>Organiser View</span>
            </button>
          )}

          {/* Show Member option if user is member and not on member page */}
          {isMemberInAnyCommittee() && currentSection !== 'member' && (
            <button
              onClick={() => navigate('/member')}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-gray-300 hover:bg-gray-800"
            >
              <UserCircle size={20} />
              <span>Member View</span>
            </button>
          )}
        </div>
      )}

      {/* Logout */}
      <div className="p-2 border-t border-gray-700">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-gray-300 hover:bg-gray-800"
        >
          <LogOut size={20} />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </div>
  );
}
