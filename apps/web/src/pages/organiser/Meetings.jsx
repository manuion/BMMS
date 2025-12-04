import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Search, Calendar, FileText, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { meetingsApi, committeesApi } from '../../services/api';
import LoadingSpinner from '../../components/common/LoadingSpinner';

export default function Meetings() {
  const { getOrganiserCommittees } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [meetings, setMeetings] = useState([]);
  const [committees, setCommittees] = useState([]);
  const [selectedCommittee, setSelectedCommittee] = useState(
    searchParams.get('committeeId') || ''
  );
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const organiserCommittees = getOrganiserCommittees();
    setCommittees(organiserCommittees);
    if (!selectedCommittee && organiserCommittees.length > 0) {
      setSelectedCommittee(organiserCommittees[0].id);
    }
  }, []);

  useEffect(() => {
    if (selectedCommittee) {
      fetchMeetings();
    }
  }, [selectedCommittee]);

  const fetchMeetings = async () => {
    setLoading(true);
    try {
      const res = await meetingsApi.getAll({ committeeId: selectedCommittee });
      setMeetings(res.data);
    } catch (error) {
      toast.error('Failed to load meetings');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (meeting) => {
    if (!window.confirm(`Are you sure you want to cancel "${meeting.title}"?`)) {
      return;
    }

    try {
      await meetingsApi.delete(meeting.id);
      toast.success('Meeting cancelled');
      fetchMeetings();
    } catch (error) {
      toast.error(error.message || 'Failed to cancel meeting');
    }
  };

  const filteredMeetings = meetings.filter((m) =>
    m.title.toLowerCase().includes(search.toLowerCase())
  );

  const upcomingMeetings = filteredMeetings.filter(
    (m) => new Date(m.scheduledAt) >= new Date() && m.status !== 'cancelled'
  );
  const pastMeetings = filteredMeetings.filter(
    (m) => new Date(m.scheduledAt) < new Date() || m.status === 'cancelled'
  );

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="page-title mb-0">Meetings</h1>
        <button
          onClick={() => navigate(`/organiser/meetings/new?committeeId=${selectedCommittee}`)}
          className="btn btn-primary flex items-center gap-2"
          disabled={!selectedCommittee}
        >
          <Plus size={20} />
          Schedule Meeting
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-6">
        <select
          value={selectedCommittee}
          onChange={(e) => setSelectedCommittee(e.target.value)}
          className="input max-w-xs"
        >
          {committees.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Search meetings..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-10"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <LoadingSpinner size="lg" />
        </div>
      ) : (
        <>
          {/* Upcoming Meetings */}
          <div className="mb-8">
            <h2 className="text-lg font-semibold mb-4">
              Upcoming ({upcomingMeetings.length})
            </h2>
            {upcomingMeetings.length === 0 ? (
              <div className="card text-center py-8 text-gray-500">
                No upcoming meetings
              </div>
            ) : (
              <div className="space-y-3">
                {upcomingMeetings.map((meeting) => (
                  <MeetingCard
                    key={meeting.id}
                    meeting={meeting}
                    onView={() => navigate(`/organiser/meetings/${meeting.id}`)}
                    onDelete={() => handleDelete(meeting)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Past/Cancelled Meetings */}
          {pastMeetings.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-4">
                Past / Cancelled ({pastMeetings.length})
              </h2>
              <div className="space-y-3 opacity-75">
                {pastMeetings.map((meeting) => (
                  <MeetingCard
                    key={meeting.id}
                    meeting={meeting}
                    onView={() => navigate(`/organiser/meetings/${meeting.id}`)}
                    isPast
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function MeetingCard({ meeting, onView, onDelete, isPast }) {
  return (
    <div
      className="card flex items-center justify-between cursor-pointer hover:shadow-lg transition-shadow"
      onClick={onView}
    >
      <div className="flex items-center gap-4">
        <div className="p-3 rounded-lg bg-primary-100">
          <Calendar className="text-primary-600" size={24} />
        </div>
        <div>
          <h3 className="font-semibold">{meeting.title}</h3>
          <p className="text-sm text-gray-500">
            {new Date(meeting.scheduledAt).toLocaleString()}
          </p>
          <p className="text-sm text-gray-500">{meeting.location}</p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <FileText size={16} />
          {meeting._count?.documents || 0} docs
        </div>

        <span
          className={`px-2 py-1 text-xs rounded-full ${
            meeting.status === 'scheduled'
              ? 'bg-green-100 text-green-800'
              : meeting.status === 'rescheduled'
              ? 'bg-yellow-100 text-yellow-800'
              : meeting.status === 'cancelled'
              ? 'bg-red-100 text-red-800'
              : 'bg-gray-100 text-gray-800'
          }`}
        >
          {meeting.status}
        </span>

        {!isPast && onDelete && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="p-2 rounded hover:bg-red-50 text-red-500"
          >
            <Trash2 size={18} />
          </button>
        )}
      </div>
    </div>
  );
}
