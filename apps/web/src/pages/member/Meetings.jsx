import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Calendar,
  Clock,
  MapPin,
  Search,
  Filter,
  CheckCircle,
  XCircle,
  AlertCircle,
  FileText,
} from 'lucide-react';
import { meetingsApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { formatDate, formatTime } from '../../utils/helpers';

export default function MemberMeetings() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState(searchParams.get('filter') || 'all');

  useEffect(() => {
    fetchMeetings();
  }, []);

  const fetchMeetings = async () => {
    try {
      const response = await meetingsApi.getAll();
      const allMeetings = response.data || [];

      // Filter meetings where user is a member
      const memberMeetings = allMeetings.filter(meeting => {
        const membership = user?.committeeMemberships?.find(
          m => m.committeeId === meeting.committeeId
        );
        return membership && membership.role === 'member';
      });

      setMeetings(memberMeetings);
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

  const getMeetingStatusBadge = (status) => {
    const styles = {
      scheduled: 'bg-blue-100 text-blue-700',
      rescheduled: 'bg-orange-100 text-orange-700',
      cancelled: 'bg-red-100 text-red-700',
      completed: 'bg-gray-100 text-gray-700',
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status] || styles.scheduled}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  // Filter and search
  const filteredMeetings = meetings.filter(meeting => {
    const matchesSearch =
      meeting.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      meeting.committee?.name.toLowerCase().includes(searchTerm.toLowerCase());

    const myStatus = getMyResponseStatus(meeting);
    const isUpcoming = new Date(meeting.scheduledAt) > new Date();

    if (filterStatus === 'pending') {
      return matchesSearch && myStatus === 'pending' && isUpcoming;
    }
    if (filterStatus === 'accepted') {
      return matchesSearch && myStatus === 'accepted';
    }
    if (filterStatus === 'declined') {
      return matchesSearch && myStatus === 'declined';
    }
    if (filterStatus === 'upcoming') {
      return matchesSearch && isUpcoming && meeting.status === 'scheduled';
    }
    if (filterStatus === 'past') {
      return matchesSearch && (!isUpcoming || meeting.status !== 'scheduled');
    }

    return matchesSearch;
  });

  // Sort by date
  const sortedMeetings = [...filteredMeetings].sort((a, b) => {
    return new Date(b.scheduledAt) - new Date(a.scheduledAt);
  });

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="page-title">My Meetings</h1>
        <p className="text-gray-600">View and respond to your meeting invitations</p>
      </div>

      {/* Filters */}
      <div className="card mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search meetings..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input pl-10 w-full"
            />
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <Filter size={18} className="text-gray-400" />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="input"
            >
              <option value="all">All Meetings</option>
              <option value="upcoming">Upcoming</option>
              <option value="pending">Pending Response</option>
              <option value="accepted">Accepted</option>
              <option value="declined">Declined</option>
              <option value="past">Past</option>
            </select>
          </div>
        </div>
      </div>

      {/* Meetings List */}
      {sortedMeetings.length === 0 ? (
        <div className="card text-center py-12">
          <Calendar size={48} className="mx-auto mb-4 text-gray-300" />
          <p className="text-gray-500">No meetings found</p>
        </div>
      ) : (
        <div className="space-y-4">
          {sortedMeetings.map((meeting) => {
            const isUpcoming = new Date(meeting.scheduledAt) > new Date();
            const myStatus = getMyResponseStatus(meeting);

            return (
              <Link
                key={meeting.id}
                to={`/member/meetings/${meeting.id}`}
                className={`card block hover:shadow-md transition-shadow ${
                  !isUpcoming ? 'opacity-75' : ''
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-lg">{meeting.title}</h3>
                      {getMeetingStatusBadge(meeting.status)}
                    </div>
                    <p className="text-gray-500 mb-3">{meeting.committee?.name}</p>

                    <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <Calendar size={16} />
                        {formatDate(meeting.scheduledAt)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock size={16} />
                        {formatTime(meeting.scheduledAt)}
                      </span>
                      {meeting.location && (
                        <span className="flex items-center gap-1">
                          <MapPin size={16} />
                          {meeting.location}
                        </span>
                      )}
                      {meeting._count?.documents > 0 && (
                        <span className="flex items-center gap-1 text-primary-600">
                          <FileText size={16} />
                          {meeting._count.documents} documents
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="ml-4">
                    {getStatusBadge(myStatus)}
                  </div>
                </div>

                {meeting.description && (
                  <p className="mt-3 text-sm text-gray-600 line-clamp-2">
                    {meeting.description}
                  </p>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
