import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Send } from 'lucide-react';
import toast from 'react-hot-toast';
import { meetingsApi } from '../../services/api';
import LoadingSpinner from '../../components/common/LoadingSpinner';

export default function EditMeeting() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    scheduledAt: '',
    endTime: '',
    location: '',
    status: 'scheduled',
  });
  const [saving, setSaving] = useState(false);
  const [sendingReminder, setSendingReminder] = useState(false);

  useEffect(() => {
    fetchMeeting();
  }, [id]);

  const fetchMeeting = async () => {
    try {
      const res = await meetingsApi.getById(id);
      const meeting = res.data;
      setFormData({
        title: meeting.title,
        description: meeting.description || '',
        scheduledAt: formatDateForInput(meeting.scheduledAt),
        endTime: meeting.endTime ? formatDateForInput(meeting.endTime) : '',
        location: meeting.location,
        status: meeting.status,
      });
    } catch (error) {
      toast.error('Failed to load meeting');
      navigate('/organiser/meetings');
    } finally {
      setLoading(false);
    }
  };

  const formatDateForInput = (dateString) => {
    const date = new Date(dateString);
    return date.toISOString().slice(0, 16);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      await meetingsApi.update(id, formData);
      toast.success('Meeting updated successfully');
      navigate(`/organiser/meetings/${id}`);
    } catch (error) {
      toast.error(error.message || 'Failed to update meeting');
    } finally {
      setSaving(false);
    }
  };

  const handleSendReminder = async () => {
    setSendingReminder(true);
    try {
      // This will trigger notifications to all pending members
      await meetingsApi.sendReminder(id);
      toast.success('Reminder sent to all pending members');
    } catch (error) {
      toast.error('Failed to send reminder');
    } finally {
      setSendingReminder(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-lg hover:bg-gray-100"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-2xl font-bold">Edit Meeting</h1>
      </div>

      <div className="card">
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Meeting Title *
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="input"
              required
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="input"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start Date & Time *
              </label>
              <input
                type="datetime-local"
                value={formData.scheduledAt}
                onChange={(e) => setFormData({ ...formData, scheduledAt: e.target.value })}
                className="input"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                End Time (Optional)
              </label>
              <input
                type="datetime-local"
                value={formData.endTime}
                onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                className="input"
                min={formData.scheduledAt}
              />
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Location *
            </label>
            <input
              type="text"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              className="input"
              required
            />
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              className="input"
            >
              <option value="scheduled">Scheduled</option>
              <option value="rescheduled">Rescheduled</option>
              <option value="cancelled">Cancelled</option>
              <option value="completed">Completed</option>
            </select>
          </div>

          <div className="flex justify-between">
            <button
              type="button"
              onClick={handleSendReminder}
              disabled={sendingReminder}
              className="btn btn-secondary flex items-center gap-2"
            >
              <Send size={16} />
              {sendingReminder ? 'Sending...' : 'Send Reminder'}
            </button>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="btn btn-primary"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
