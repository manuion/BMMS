import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, Users, Pencil, Trash2, X, UserPlus } from 'lucide-react';
import toast from 'react-hot-toast';
import { committeesApi, usersApi } from '../../services/api';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import Modal from '../../components/common/Modal';

export default function Committees() {
  const [committees, setCommittees] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingCommittee, setEditingCommittee] = useState(null);
  const [formData, setFormData] = useState({ name: '', description: '' });
  const [selectedMembers, setSelectedMembers] = useState([]); // [{userId, role}]
  const [saving, setSaving] = useState(false);
  const [userSearch, setUserSearch] = useState('');

  useEffect(() => {
    fetchCommittees();
    fetchUsers();
  }, []);

  const fetchCommittees = async () => {
    try {
      const res = await committeesApi.getAll();
      setCommittees(res.data);
    } catch (error) {
      toast.error('Failed to load committees');
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await usersApi.getAll();
      setUsers(res.data || []);
    } catch (error) {
      console.error('Failed to load users');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      if (editingCommittee) {
        await committeesApi.update(editingCommittee.id, formData);
        toast.success('Committee updated');
      } else {
        // Create committee
        const res = await committeesApi.create(formData);
        const newCommitteeId = res.data.id;

        // Add selected members
        if (selectedMembers.length > 0) {
          for (const member of selectedMembers) {
            try {
              await committeesApi.addMember(newCommitteeId, {
                userId: member.userId,
                role: member.role,
              });
            } catch (err) {
              console.error(`Failed to add member ${member.userId}:`, err);
            }
          }
        }
        toast.success('Committee created with members');
      }
      setShowModal(false);
      setEditingCommittee(null);
      setFormData({ name: '', description: '' });
      setSelectedMembers([]);
      fetchCommittees();
    } catch (error) {
      toast.error(error.message || 'Failed to save committee');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (committee) => {
    setEditingCommittee(committee);
    setFormData({ name: committee.name, description: committee.description || '' });
    setSelectedMembers([]); // Don't preload members for edit - that's in CommitteeDetail
    setShowModal(true);
  };

  const handleDelete = async (committee) => {
    if (!window.confirm(`Are you sure you want to deactivate "${committee.name}"?`)) {
      return;
    }

    try {
      await committeesApi.delete(committee.id);
      toast.success('Committee deactivated');
      fetchCommittees();
    } catch (error) {
      toast.error(error.message || 'Failed to delete committee');
    }
  };

  const handleAddMember = (userId) => {
    if (selectedMembers.find((m) => m.userId === userId)) return;
    setSelectedMembers([...selectedMembers, { userId, role: 'member' }]);
    setUserSearch('');
  };

  const handleRemoveMember = (userId) => {
    setSelectedMembers(selectedMembers.filter((m) => m.userId !== userId));
  };

  const handleChangeRole = (userId, role) => {
    setSelectedMembers(
      selectedMembers.map((m) => (m.userId === userId ? { ...m, role } : m))
    );
  };

  const filteredCommittees = committees.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  const availableUsers = users.filter(
    (u) =>
      u.isActive &&
      !selectedMembers.find((m) => m.userId === u.id) &&
      (u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
        u.email.toLowerCase().includes(userSearch.toLowerCase()))
  );

  const getSelectedUser = (userId) => users.find((u) => u.id === userId);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="page-title mb-0">Committees</h1>
        <button
          onClick={() => {
            setEditingCommittee(null);
            setFormData({ name: '', description: '' });
            setSelectedMembers([]);
            setShowModal(true);
          }}
          className="btn btn-primary flex items-center gap-2"
        >
          <Plus size={20} />
          Add Committee
        </button>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Search committees..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-10"
          />
        </div>
      </div>

      {/* Committees Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredCommittees.map((committee) => (
          <div key={committee.id} className="card">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="font-semibold text-lg">{committee.name}</h3>
                <p className="text-sm text-gray-500">
                  {committee.description || 'No description'}
                </p>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => handleEdit(committee)}
                  className="p-1 rounded hover:bg-gray-100"
                >
                  <Pencil size={16} className="text-gray-500" />
                </button>
                <button
                  onClick={() => handleDelete(committee)}
                  className="p-1 rounded hover:bg-gray-100"
                >
                  <Trash2 size={16} className="text-red-500" />
                </button>
              </div>
            </div>

            <div className="flex items-center gap-4 text-sm text-gray-600 mb-4">
              <span className="flex items-center gap-1">
                <Users size={16} />
                {committee.members?.length || 0} members
              </span>
              <span>{committee._count?.meetings || 0} meetings</span>
            </div>

            {/* Members Preview */}
            {committee.members?.length > 0 && (
              <div className="border-t pt-4">
                <p className="text-xs text-gray-500 mb-2">Members:</p>
                <div className="flex flex-wrap gap-1">
                  {committee.members.slice(0, 3).map((member) => (
                    <span
                      key={member.id}
                      className={`px-2 py-1 text-xs rounded-full ${
                        member.role === 'organiser'
                          ? 'bg-primary-100 text-primary-700'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {member.user?.name}
                      {member.role === 'organiser' && ' (O)'}
                    </span>
                  ))}
                  {committee.members.length > 3 && (
                    <span className="px-2 py-1 text-xs bg-gray-100 rounded-full">
                      +{committee.members.length - 3} more
                    </span>
                  )}
                </div>
              </div>
            )}

            <Link
              to={`/admin/committees/${committee.id}`}
              className="block mt-4 text-sm text-primary-600 hover:text-primary-700"
            >
              View Details →
            </Link>
          </div>
        ))}
      </div>

      {filteredCommittees.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500">No committees found</p>
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingCommittee ? 'Edit Committee' : 'Create Committee'}
        size="lg"
      >
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="input"
              placeholder="Enter committee name"
              required
            />
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="input"
              rows={3}
              placeholder="Enter committee description"
            />
          </div>

          {/* Add Members Section - Only for new committees */}
          {!editingCommittee && (
            <div className="mb-6 border-t pt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <UserPlus size={16} className="inline mr-2" />
                Add Members (Optional)
              </label>
              <p className="text-xs text-gray-500 mb-3">
                You can add members now or later from the committee detail page.
              </p>

              {/* User Search */}
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                <input
                  type="text"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="Search users to add..."
                  className="input pl-9 text-sm"
                />
              </div>

              {/* User Search Results */}
              {userSearch && availableUsers.length > 0 && (
                <div className="border rounded-lg max-h-40 overflow-y-auto mb-3">
                  {availableUsers.slice(0, 5).map((user) => (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => handleAddMember(user.id)}
                      className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-50 text-left"
                    >
                      <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-sm font-medium">
                        {user.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{user.name}</p>
                        <p className="text-xs text-gray-500 truncate">{user.email}</p>
                      </div>
                      <Plus size={16} className="text-gray-400" />
                    </button>
                  ))}
                </div>
              )}

              {/* Selected Members */}
              {selectedMembers.length > 0 && (
                <div className="border rounded-lg divide-y">
                  {selectedMembers.map((member) => {
                    const user = getSelectedUser(member.userId);
                    if (!user) return null;
                    return (
                      <div
                        key={member.userId}
                        className="flex items-center gap-3 px-3 py-2"
                      >
                        <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-sm font-medium">
                          {user.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{user.name}</p>
                          <p className="text-xs text-gray-500 truncate">{user.email}</p>
                        </div>
                        <select
                          value={member.role}
                          onChange={(e) => handleChangeRole(member.userId, e.target.value)}
                          className="text-sm border rounded px-2 py-1"
                        >
                          <option value="member">Member</option>
                          <option value="organiser">Organiser</option>
                        </select>
                        <button
                          type="button"
                          onClick={() => handleRemoveMember(member.userId)}
                          className="p-1 hover:bg-red-50 rounded"
                        >
                          <X size={16} className="text-red-500" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {selectedMembers.length === 0 && !userSearch && (
                <p className="text-sm text-gray-400 text-center py-4 border rounded-lg bg-gray-50">
                  No members added yet
                </p>
              )}
            </div>
          )}

          {editingCommittee && (
            <p className="text-sm text-gray-500 mb-4 bg-gray-50 p-3 rounded">
              To add or manage members, go to the{' '}
              <Link
                to={`/admin/committees/${editingCommittee.id}`}
                className="text-primary-600 hover:underline"
              >
                committee detail page
              </Link>
              .
            </p>
          )}

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="btn btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="btn btn-primary"
            >
              {saving
                ? 'Saving...'
                : editingCommittee
                ? 'Update'
                : selectedMembers.length > 0
                ? `Create with ${selectedMembers.length} member${selectedMembers.length > 1 ? 's' : ''}`
                : 'Create'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
