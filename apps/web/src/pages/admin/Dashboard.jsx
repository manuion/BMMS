import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, Building2, UserCheck, UserX } from 'lucide-react';
import { usersApi, committeesApi } from '../../services/api';
import LoadingSpinner from '../../components/common/LoadingSpinner';

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeUsers: 0,
    inactiveUsers: 0,
    committees: 0,
  });
  const [loading, setLoading] = useState(true);
  const [recentUsers, setRecentUsers] = useState([]);
  const [recentCommittees, setRecentCommittees] = useState([]);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [usersRes, committeesRes] = await Promise.all([
          usersApi.getAll(),
          committeesApi.getAll(),
        ]);

        const users = usersRes.data || [];
        const committees = committeesRes.data || [];

        setStats({
          totalUsers: users.length,
          activeUsers: users.filter((u) => u.isActive).length,
          inactiveUsers: users.filter((u) => !u.isActive).length,
          committees: committees.length,
        });

        // Get recent users (last 5)
        setRecentUsers(
          [...users]
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            .slice(0, 5)
        );

        // Get recent committees (last 5)
        setRecentCommittees(
          [...committees]
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            .slice(0, 5)
        );
      } catch (error) {
        console.error('Failed to fetch stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const statCards = [
    {
      title: 'Total Users',
      value: stats.totalUsers,
      icon: Users,
      color: 'bg-blue-500',
      link: '/admin/users',
    },
    {
      title: 'Active Users',
      value: stats.activeUsers,
      icon: UserCheck,
      color: 'bg-green-500',
      link: '/admin/users',
    },
    {
      title: 'Inactive Users',
      value: stats.inactiveUsers,
      icon: UserX,
      color: 'bg-red-500',
      link: '/admin/users',
    },
    {
      title: 'Committees',
      value: stats.committees,
      icon: Building2,
      color: 'bg-purple-500',
      link: '/admin/committees',
    },
  ];

  return (
    <div>
      <h1 className="page-title">Admin Dashboard</h1>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {statCards.map((stat) => (
          <Link
            key={stat.title}
            to={stat.link}
            className="card flex items-center gap-4 hover:shadow-lg transition-shadow"
          >
            <div className={`p-3 rounded-lg ${stat.color}`}>
              <stat.icon className="text-white" size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-600">{stat.title}</p>
              <p className="text-2xl font-bold">{stat.value}</p>
            </div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Users */}
        <div className="card">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Recent Users</h2>
            <Link to="/admin/users" className="text-sm text-primary-600 hover:underline">
              View All
            </Link>
          </div>
          {recentUsers.length === 0 ? (
            <p className="text-gray-500">No users yet</p>
          ) : (
            <div className="space-y-3">
              {recentUsers.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-medium">
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium">{user.name}</p>
                      <p className="text-sm text-gray-500">{user.email}</p>
                    </div>
                  </div>
                  <span
                    className={`px-2 py-1 text-xs rounded-full ${
                      user.isActive
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {user.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Committees */}
        <div className="card">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Recent Committees</h2>
            <Link to="/admin/committees" className="text-sm text-primary-600 hover:underline">
              View All
            </Link>
          </div>
          {recentCommittees.length === 0 ? (
            <p className="text-gray-500">No committees yet</p>
          ) : (
            <div className="space-y-3">
              {recentCommittees.map((committee) => (
                <Link
                  key={committee.id}
                  to={`/admin/committees/${committee.id}`}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100"
                >
                  <div>
                    <p className="font-medium">{committee.name}</p>
                    <p className="text-sm text-gray-500">
                      {committee.members?.length || 0} members
                    </p>
                  </div>
                  <span
                    className={`px-2 py-1 text-xs rounded-full ${
                      committee.isActive
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {committee.isActive ? 'Active' : 'Inactive'}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
