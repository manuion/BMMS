import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Calendar,
  Clock,
  MapPin,
  Users,
  FileText,
  CheckCircle,
  XCircle,
  AlertCircle,
  ChevronRight,
} from 'lucide-react';
import { meetingsApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { formatDate, formatTime } from '../../utils/helpers';

export default function MemberDashboard() {
  const { user } = useAuth();
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    upcoming: 0,
    pending: 0,
    accepted: 0,
    declined: 0,
  });

  useEffect(() => {
    fetchMeetings();
  }, []);

  const fetchMeetings = async () => {
    try {
      const response = await meetingsApi.getAll();
      const allMeetings = response.data || [];

      // Filter meetings where user is a member (not organiser)
      const memberMeetings = allMeetings.filter(meeting => {
        const membership = user?.committeeMemberships?.find(
          m => m.committeeId === meeting.committeeId
        );
        return membership && membership.role === 'member';
      });

      setMeetings(memberMeetings);

      // Calculate stats
      const now = new Date();
      const upcomingMeetings = memberMeetings.filter(
        m => new Date(m.scheduledAt) > now && m.status === 'scheduled'
      );

      const myResponses = memberMeetings.map(m => {
        const myResponse = m.responses?.find(r => r.userId === user?.id);
        return myResponse?.status || 'pending';
      });

      setStats({
        upcoming: upcomingMeetings.length,
        pending: myResponses.filter(s => s === 'pending').length,
        accepted: myResponses.filter(s => s === 'accepted').length,
        declined: myResponses.filter(s => s === 'declined').length,
      });
    } catch (error) {
      console.error('Failed to fetch meetings:', error);
    } finally {
      setLoading(false);
    }
  };

  const getMyResponseStatus = (meeting) => {
    const myResponse = meeting.responses?.find(r => r.userId === user?.id);
    return myResponse?.status || 'pending';
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'accepted':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
            <CheckCircle size={12} />
            Accepted
          </span>
        );
      case 'declined':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
            <XCircle size={12} />
            Declined
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
            <AlertCircle size={12} />
            Pending
          </span>
        );
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  const upcomingMeetings = meetings
    .filter(m => new Date(m.scheduledAt) > new Date() && m.status === 'scheduled')
    .sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt))
    .slice(0, 5);

  const pendingResponseMeetings = meetings
    .filter(m => {
      const status = getMyResponseStatus(m);
      return status === 'pending' && new Date(m.scheduledAt) > new Date();
    });

  return (
    <div>
      <div className="mb-6">
        <h1 className="page-title">Member Dashboard</h1>
        <p className="text-gray-600">View your meetings and respond to invitations</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="card">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-100 rounded-lg">
              <Calendar size={24} className="text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.upcoming}</p>
              <p className="text-sm text-gray-500">Upcoming Meetings</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-yellow-100 rounded-lg">
              <AlertCircle size={24} className="text-yellow-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.pending}</p>
              <p className="text-sm text-gray-500">Pending Response</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-100 rounded-lg">
              <CheckCircle size={24} className="text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.accepted}</p>
              <p className="text-sm text-gray-500">Accepted</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-red-100 rounded-lg">
              <XCircle size={24} className="text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.declined}</p>
              <p className="text-sm text-gray-500">Declined</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pending Responses */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Pending Responses</h2>
            <Link
              to="/member/meetings?filter=pending"
              className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1"
            >
              View all <ChevronRight size={16} />
            </Link>
          </div>

          {pendingResponseMeetings.length === 0 ? (
            <p className="text-gray-500 text-center py-6">
              No pending responses
            </p>
          ) : (
            <div className="space-y-3">
              {pendingResponseMeetings.slice(0, 3).map((meeting) => (
                <Link
                  key={meeting.id}
                  to={`/member/meetings/${meeting.id}`}
                  className="block p-3 border rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-medium">{meeting.title}</h3>
                      <p className="text-sm text-gray-500">{meeting.committee?.name}</p>
                    </div>
                    {getStatusBadge('pending')}
                  </div>
                  <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                    <span className="flex items-center gap-1">
                      <Calendar size={14} />
                      {formatDate(meeting.scheduledAt)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock size={14} />
                      {formatTime(meeting.scheduledAt)}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Upcoming Meetings */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Upcoming Meetings</h2>
            <Link
              to="/member/meetings"
              className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1"
            >
              View all <ChevronRight size={16} />
            </Link>
          </div>

          {upcomingMeetings.length === 0 ? (
            <p className="text-gray-500 text-center py-6">
              No upcoming meetings
            </p>
          ) : (
            <div className="space-y-3">
              {upcomingMeetings.map((meeting) => (
                <Link
                  key={meeting.id}
                  to={`/member/meetings/${meeting.id}`}
                  className="block p-3 border rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-medium">{meeting.title}</h3>
                      <p className="text-sm text-gray-500">{meeting.committee?.name}</p>
                    </div>
                    {getStatusBadge(getMyResponseStatus(meeting))}
                  </div>
                  <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                    <span className="flex items-center gap-1">
                      <Calendar size={14} />
                      {formatDate(meeting.scheduledAt)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock size={14} />
                      {formatTime(meeting.scheduledAt)}
                    </span>
                    {meeting.location && (
                      <span className="flex items-center gap-1">
                        <MapPin size={14} />
                        {meeting.location}
                      </span>
                    )}
                  </div>
                  {meeting._count?.documents > 0 && (
                    <div className="flex items-center gap-1 mt-2 text-sm text-primary-600">
                      <FileText size={14} />
                      {meeting._count.documents} documents
                    </div>
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
