import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Building2, FileText, Users } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { committeesApi, meetingsApi } from '../../services/api';
import LoadingSpinner from '../../components/common/LoadingSpinner';

export default function OrganiserDashboard() {
  const { user, getOrganiserCommittees } = useAuth();
  const navigate = useNavigate();

  const [committees, setCommittees] = useState([]);
  const [selectedCommittee, setSelectedCommittee] = useState(null);
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const organiserCommittees = getOrganiserCommittees();
    setCommittees(organiserCommittees);

    if (organiserCommittees.length > 0) {
      setSelectedCommittee(organiserCommittees[0]);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (selectedCommittee) {
      fetchMeetings();
    }
  }, [selectedCommittee]);

  const fetchMeetings = async () => {
    try {
      const res = await meetingsApi.getAll({
        committeeId: selectedCommittee.id,
        upcoming: 'true',
      });
      setMeetings(res.data);
    } catch (error) {
      console.error('Failed to fetch meetings:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (committees.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <Building2 size={48} className="text-gray-300 mb-4" />
        <h2 className="text-xl font-semibold text-gray-700 mb-2">No Committees Assigned</h2>
        <p className="text-gray-500">You are not an organiser in any committee yet.</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="page-title">Organiser Dashboard</h1>

      {/* Committee Selector */}
      <div className="card mb-6">
        <h2 className="text-lg font-semibold mb-4">Select Committee</h2>
        <div className="flex flex-wrap gap-3">
          {committees.map((committee) => (
            <button
              key={committee.id}
              onClick={() => setSelectedCommittee(committee)}
              className={`px-4 py-2 rounded-lg border transition-colors ${
                selectedCommittee?.id === committee.id
                  ? 'border-primary-500 bg-primary-50 text-primary-700'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              {committee.name}
            </button>
          ))}
        </div>
      </div>

      {selectedCommittee && (
        <>
          {/* Quick Actions */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <button
              onClick={() => navigate(`/organiser/meetings/new?committeeId=${selectedCommittee.id}`)}
              className="card flex items-center gap-4 hover:shadow-lg transition-shadow text-left"
            >
              <div className="p-3 rounded-lg bg-primary-100">
                <Calendar className="text-primary-600" size={24} />
              </div>
              <div>
                <p className="font-semibold">Schedule Meeting</p>
                <p className="text-sm text-gray-500">Create a new meeting</p>
              </div>
            </button>

            <button
              onClick={() => navigate('/organiser/meetings')}
              className="card flex items-center gap-4 hover:shadow-lg transition-shadow text-left"
            >
              <div className="p-3 rounded-lg bg-green-100">
                <FileText className="text-green-600" size={24} />
              </div>
              <div>
                <p className="font-semibold">Manage Meetings</p>
                <p className="text-sm text-gray-500">View all meetings</p>
              </div>
            </button>

            <div className="card flex items-center gap-4">
              <div className="p-3 rounded-lg bg-purple-100">
                <Users className="text-purple-600" size={24} />
              </div>
              <div>
                <p className="font-semibold">{meetings.length}</p>
                <p className="text-sm text-gray-500">Upcoming Meetings</p>
              </div>
            </div>
          </div>

          {/* Upcoming Meetings */}
          <div className="card">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">
                Upcoming Meetings - {selectedCommittee.name}
              </h2>
              <button
                onClick={() => navigate(`/organiser/meetings/new?committeeId=${selectedCommittee.id}`)}
                className="btn btn-primary text-sm"
              >
                + New Meeting
              </button>
            </div>

            {meetings.length === 0 ? (
              <p className="text-gray-500 text-center py-8">
                No upcoming meetings for this committee
              </p>
            ) : (
              <div className="space-y-3">
                {meetings.map((meeting) => (
                  <div
                    key={meeting.id}
                    onClick={() => navigate(`/organiser/meetings/${meeting.id}`)}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100"
                  >
                    <div>
                      <p className="font-medium">{meeting.title}</p>
                      <p className="text-sm text-gray-500">
                        {new Date(meeting.scheduledAt).toLocaleString()} • {meeting.location}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-sm font-medium">
                          {meeting._count?.documents || 0} docs
                        </p>
                        <p className="text-xs text-gray-500">
                          {meeting._count?.responses || 0} responses
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
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
