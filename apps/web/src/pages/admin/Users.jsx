import { useEffect, useState } from 'react';
import { Plus, Search, Pencil, Trash2, Shield, ShieldOff } from 'lucide-react';
import toast from 'react-hot-toast';
import { usersApi } from '../../services/api';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import Modal from '../../components/common/Modal';

export default function Users() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    isAdmin: false,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await usersApi.getAll();
      setUsers(res.data);
    } catch (error) {
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      if (editingUser) {
        const updateData = { ...formData };
        delete updateData.password; // Don't update password through this form
        await usersApi.update(editingUser.id, updateData);
        toast.success('User updated');
      } else {
        await usersApi.create(formData);
        toast.success('User created');
      }
      setShowModal(false);
      setEditingUser(null);
      resetForm();
      fetchUsers();
    } catch (error) {
      toast.error(error.message || 'Failed to save user');
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      password: '',
      phone: '',
      isAdmin: false,
    });
  };

  const handleEdit = (user) => {
    setEditingUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      password: '',
      phone: user.phone || '',
      isAdmin: user.isAdmin,
    });
    setShowModal(true);
  };

  const handleDelete = async (user) => {
    if (!window.confirm(`Are you sure you want to deactivate "${user.name}"?`)) {
      return;
    }

    try {
      await usersApi.delete(user.id);
      toast.success('User deactivated');
      fetchUsers();
    } catch (error) {
      toast.error(error.message || 'Failed to deactivate user');
    }
  };

  const toggleAdmin = async (user) => {
    try {
      await usersApi.update(user.id, { isAdmin: !user.isAdmin });
      toast.success(`Admin access ${user.isAdmin ? 'removed' : 'granted'}`);
      fetchUsers();
    } catch (error) {
      toast.error(error.message || 'Failed to update user');
    }
  };

  const filteredUsers = users.filter(
    (u) =>
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase())
  );

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
        <h1 className="page-title mb-0">Users</h1>
        <button
          onClick={() => {
            setEditingUser(null);
            resetForm();
            setShowModal(true);
          }}
          className="btn btn-primary flex items-center gap-2"
        >
          <Plus size={20} />
          Add User
        </button>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Search users..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-10"
          />
        </div>
      </div>

      {/* Users Table */}
      <div className="card overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="text-left border-b">
              <th className="pb-3 font-medium">Name</th>
              <th className="pb-3 font-medium">Email</th>
              <th className="pb-3 font-medium">Phone</th>
              <th className="pb-3 font-medium">Role</th>
              <th className="pb-3 font-medium">Committees</th>
              <th className="pb-3 font-medium">Status</th>
              <th className="pb-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map((user) => (
              <tr key={user.id} className="border-b last:border-0">
                <td className="py-3 font-medium">{user.name}</td>
                <td className="py-3 text-gray-500">{user.email}</td>
                <td className="py-3 text-gray-500">{user.phone || '-'}</td>
                <td className="py-3">
                  <span
                    className={`px-2 py-1 text-xs rounded-full ${
                      user.isAdmin
                        ? 'bg-purple-100 text-purple-700'
                        : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {user.isAdmin ? 'Admin' : 'User'}
                  </span>
                </td>
                <td className="py-3">
                  {user.committeeMemberships?.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {user.committeeMemberships.slice(0, 2).map((m) => (
                        <span
                          key={m.id}
                          className={`px-2 py-0.5 text-xs rounded ${
                            m.role === 'organiser'
                              ? 'bg-primary-100 text-primary-700'
                              : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {m.committee?.name}
                        </span>
                      ))}
                      {user.committeeMemberships.length > 2 && (
                        <span className="text-xs text-gray-500">
                          +{user.committeeMemberships.length - 2}
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-gray-400 text-sm">None</span>
                  )}
                </td>
                <td className="py-3">
                  <span
                    className={`px-2 py-1 text-xs rounded-full ${
                      user.isActive
                        ? 'bg-green-100 text-green-700'
                        : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {user.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="py-3">
                  <div className="flex gap-1">
                    <button
                      onClick={() => toggleAdmin(user)}
                      className="p-1 rounded hover:bg-gray-100"
                      title={user.isAdmin ? 'Remove admin' : 'Make admin'}
                    >
                      {user.isAdmin ? (
                        <ShieldOff size={16} className="text-purple-500" />
                      ) : (
                        <Shield size={16} className="text-gray-400" />
                      )}
                    </button>
                    <button
                      onClick={() => handleEdit(user)}
                      className="p-1 rounded hover:bg-gray-100"
                    >
                      <Pencil size={16} className="text-gray-500" />
                    </button>
                    <button
                      onClick={() => handleDelete(user)}
                      className="p-1 rounded hover:bg-gray-100"
                    >
                      <Trash2 size={16} className="text-red-500" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredUsers.length === 0 && (
          <p className="text-center py-8 text-gray-500">No users found</p>
        )}
      </div>

      {/* Create/Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingUser ? 'Edit User' : 'Create User'}
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
              required
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email *
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="input"
              required
            />
          </div>

          {!editingUser && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Password *
              </label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="input"
                required={!editingUser}
                minLength={6}
              />
            </div>
          )}

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Phone
            </label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="input"
            />
          </div>

          <div className="mb-6">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.isAdmin}
                onChange={(e) => setFormData({ ...formData, isAdmin: e.target.checked })}
                className="rounded"
              />
              <span className="text-sm font-medium text-gray-700">Admin access</span>
            </label>
          </div>

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
              {saving ? 'Saving...' : editingUser ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
