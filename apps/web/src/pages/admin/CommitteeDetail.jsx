import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Pencil, Trash2, UserPlus } from 'lucide-react';
import toast from 'react-hot-toast';
import { committeesApi, usersApi } from '../../services/api';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import Modal from '../../components/common/Modal';

export default function CommitteeDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [committee, setCommittee] = useState(null);
  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState('');
  const [selectedRole, setSelectedRole] = useState('member');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    try {
      const [committeeRes, usersRes] = await Promise.all([
        committeesApi.getById(id),
        usersApi.getAll(),
      ]);
      setCommittee(committeeRes.data);
      setAllUsers(usersRes.data);
    } catch (error) {
      toast.error('Failed to load committee');
      navigate('/admin/committees');
    } finally {
      setLoading(false);
    }
  };

  const handleAddMember = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      await committeesApi.addMember(id, {
        userId: selectedUser,
        role: selectedRole,
      });
      toast.success('Member added');
      setShowAddMemberModal(false);
      setSelectedUser('');
      setSelectedRole('member');
      fetchData();
    } catch (error) {
      toast.error(error.message || 'Failed to add member');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateRole = async (userId, newRole) => {
    try {
      await committeesApi.updateMember(id, userId, { role: newRole });
      toast.success('Role updated');
      fetchData();
    } catch (error) {
      toast.error(error.message || 'Failed to update role');
    }
  };

  const handleRemoveMember = async (userId, userName) => {
    if (!window.confirm(`Remove ${userName} from this committee?`)) {
      return;
    }

    try {
      await committeesApi.removeMember(id, userId);
      toast.success('Member removed');
      fetchData();
    } catch (error) {
      toast.error(error.message || 'Failed to remove member');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // Get users not already in committee
  const existingMemberIds = committee.members.map((m) => m.user.id);
  const availableUsers = allUsers.filter((u) => !existingMemberIds.includes(u.id));

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate('/admin/committees')}
          className="p-2 rounded-lg hover:bg-gray-100"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-bold">{committee.name}</h1>
          <p className="text-gray-500">{committee.description || 'No description'}</p>
        </div>
      </div>

      {/* Members Section */}
      <div className="card">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Members ({committee.members.length})</h2>
          <button
            onClick={() => setShowAddMemberModal(true)}
            className="btn btn-primary flex items-center gap-2"
            disabled={availableUsers.length === 0}
          >
            <UserPlus size={18} />
            Add Member
          </button>
        </div>

        {committee.members.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No members in this committee</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left border-b">
                  <th className="pb-3 font-medium">Name</th>
                  <th className="pb-3 font-medium">Email</th>
                  <th className="pb-3 font-medium">Role</th>
                  <th className="pb-3 font-medium">Joined</th>
                  <th className="pb-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {committee.members.map((member) => (
                  <tr key={member.id} className="border-b last:border-0">
                    <td className="py-3">{member.user.name}</td>
                    <td className="py-3 text-gray-500">{member.user.email}</td>
                    <td className="py-3">
                      <select
                        value={member.role}
                        onChange={(e) => handleUpdateRole(member.user.id, e.target.value)}
                        className="px-2 py-1 border rounded text-sm"
                      >
                        <option value="member">Member</option>
                        <option value="organiser">Organiser</option>
                      </select>
                    </td>
                    <td className="py-3 text-gray-500">
                      {new Date(member.joinedAt).toLocaleDateString()}
                    </td>
                    <td className="py-3">
                      <button
                        onClick={() => handleRemoveMember(member.user.id, member.user.name)}
                        className="p-1 rounded hover:bg-red-50 text-red-500"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recent Meetings */}
      {committee.meetings?.length > 0 && (
        <div className="card mt-6">
          <h2 className="text-lg font-semibold mb-4">Recent Meetings</h2>
          <div className="space-y-3">
            {committee.meetings.map((meeting) => (
              <div
                key={meeting.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div>
                  <p className="font-medium">{meeting.title}</p>
                  <p className="text-sm text-gray-500">
                    {new Date(meeting.scheduledAt).toLocaleString()}
                  </p>
                </div>
                <span
                  className={`px-2 py-1 text-xs rounded-full ${
                    meeting.status === 'scheduled'
                      ? 'bg-green-100 text-green-800'
                      : meeting.status === 'cancelled'
                      ? 'bg-red-100 text-red-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {meeting.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Member Modal */}
      <Modal
        isOpen={showAddMemberModal}
        onClose={() => setShowAddMemberModal(false)}
        title="Add Member to Committee"
      >
        <form onSubmit={handleAddMember}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Select User *
            </label>
            <select
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              className="input"
              required
            >
              <option value="">Choose a user...</option>
              {availableUsers.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name} ({user.email})
                </option>
              ))}
            </select>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Role *
            </label>
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              className="input"
              required
            >
              <option value="member">Member</option>
              <option value="organiser">Organiser</option>
            </select>
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setShowAddMemberModal(false)}
              className="btn btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !selectedUser}
              className="btn btn-primary"
            >
              {saving ? 'Adding...' : 'Add Member'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
