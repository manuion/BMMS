import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { meetingsApi } from '../../services/api';

export default function CreateMeeting() {
  const { getOrganiserCommittees } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const committees = getOrganiserCommittees();
  const initialCommittee = searchParams.get('committeeId') || committees[0]?.id || '';

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    committeeId: initialCommittee,
    scheduledAt: '',
    endTime: '',
    location: '',
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      const res = await meetingsApi.create(formData);
      toast.success('Meeting scheduled successfully');
      navigate(`/organiser/meetings/${res.data.id}`);
    } catch (error) {
      toast.error(error.message || 'Failed to create meeting');
    } finally {
      setSaving(false);
    }
  };

  // Get minimum date (today)
  const today = new Date().toISOString().slice(0, 16);

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-lg hover:bg-gray-100"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-2xl font-bold">Schedule Meeting</h1>
      </div>

      <div className="card">
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Committee *
            </label>
            <select
              value={formData.committeeId}
              onChange={(e) => setFormData({ ...formData, committeeId: e.target.value })}
              className="input"
              required
            >
              <option value="">Select committee...</option>
              {committees.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Meeting Title *
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="input"
              placeholder="e.g., Q4 Board Review"
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
              placeholder="Brief description of the meeting agenda..."
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
                min={today}
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
                min={formData.scheduledAt || today}
              />
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Location *
            </label>
            <input
              type="text"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              className="input"
              placeholder="e.g., Board Room A, 5th Floor"
              required
            />
          </div>

          <div className="flex justify-end gap-3">
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
              {saving ? 'Scheduling...' : 'Schedule Meeting'}
            </button>
          </div>
        </form>
      </div>

      <div className="mt-4 p-4 bg-blue-50 rounded-lg text-sm text-blue-700">
        <p className="font-medium mb-1">Next Steps:</p>
        <ul className="list-disc list-inside">
          <li>After creating the meeting, you can upload agenda documents</li>
          <li>All committee members will receive a notification</li>
          <li>Members can accept or decline the meeting invitation</li>
        </ul>
      </div>
    </div>
  );
}
