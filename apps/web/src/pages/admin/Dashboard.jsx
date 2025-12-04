import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, Building2, Calendar, FileText } from 'lucide-react';
import { usersApi, committeesApi, meetingsApi } from '../../services/api';
import LoadingSpinner from '../../components/common/LoadingSpinner';

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    users: 0,
    committees: 0,
    meetings: 0,
  });
  const [loading, setLoading] = useState(true);
  const [recentMeetings, setRecentMeetings] = useState([]);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [usersRes, committeesRes, meetingsRes] = await Promise.all([
          usersApi.getAll(),
          committeesApi.getAll(),
          meetingsApi.getAll({ upcoming: 'true' }),
        ]);

        setStats({
          users: usersRes.data.length,
          committees: committeesRes.data.length,
          meetings: meetingsRes.data.length,
        });

        setRecentMeetings(meetingsRes.data.slice(0, 5));
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
      value: stats.users,
      icon: Users,
      color: 'bg-blue-500',
      link: '/admin/users',
    },
    {
      title: 'Committees',
      value: stats.committees,
      icon: Building2,
      color: 'bg-green-500',
      link: '/admin/committees',
    },
    {
      title: 'Upcoming Meetings',
      value: stats.meetings,
      icon: Calendar,
      color: 'bg-purple-500',
      link: '#',
    },
  ];

  return (
    <div>
      <h1 className="page-title">Admin Dashboard</h1>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
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

      {/* Recent Meetings */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Upcoming Meetings</h2>
        {recentMeetings.length === 0 ? (
          <p className="text-gray-500">No upcoming meetings</p>
        ) : (
          <div className="space-y-3">
            {recentMeetings.map((meeting) => (
              <div
                key={meeting.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div>
                  <p className="font-medium">{meeting.title}</p>
                  <p className="text-sm text-gray-500">
                    {meeting.committee?.name} •{' '}
                    {new Date(meeting.scheduledAt).toLocaleDateString()}
                  </p>
                </div>
                <span
                  className={`px-2 py-1 text-xs rounded-full ${
                    meeting.status === 'scheduled'
                      ? 'bg-green-100 text-green-800'
                      : meeting.status === 'rescheduled'
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {meeting.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
