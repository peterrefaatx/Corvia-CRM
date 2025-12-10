import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout/Layout';
import api from '../services/api';
import { useToast } from '../contexts/ToastContext';
import { getRoleBadgeColor, getRoleLabel } from '../utils/roleBadgeColors';

interface User {
  id: string;
  serialNumber?: string;
  username: string;
  email: string;
  role: string;
  fullName: string;
  isActive: boolean;
  createdAt: string;
  team?: {
    id: string;
    name: string;
  };
  managedTeam?: any;
}

interface Team {
  id: string;
  name: string;
  teamLeader?: {
    id: string;
    fullName: string;
  };
}

interface CreateUserForm {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
  role: string;
  fullName: string;
  teamId: string;
}

interface EditUserForm {
  username: string;
  email: string;
  role: string;
  fullName: string;
  teamId: string;
  isActive: boolean;
}

const UserManagement: React.FC = () => {
  const { showToast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showResetPasswordModal, setShowResetPasswordModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const [createForm, setCreateForm] = useState<CreateUserForm>({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'Agent',
    fullName: '',
    teamId: ''
  });

  const [editForm, setEditForm] = useState<EditUserForm>({
    username: '',
    email: '',
    role: 'Agent',
    fullName: '',
    teamId: '',
    isActive: true
  });

  const [resetPassword, setResetPassword] = useState({
    newPassword: '',
    confirmPassword: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [usersResponse, teamsResponse] = await Promise.all([
        api.get('/users'),
        api.get('/teams')
      ]);
      
      // Sort users by role priority: Manager -> Account Manager -> Team Leader -> Senior Agent -> Agent -> QC
      const rolePriority: { [key: string]: number } = {
        'Manager': 1,
        'AccountManager': 2,
        'TeamLeader': 3,
        'SeniorAgent': 4,
        'Agent': 5,
        'QualityControl': 6,
        'Client': 7
      };
      
      const sortedUsers = usersResponse.data.sort((a: User, b: User) => {
        return (rolePriority[a.role] || 999) - (rolePriority[b.role] || 999);
      });
      
      setUsers(sortedUsers);
      setTeams(teamsResponse.data);
    } catch (error) {
      console.error('Failed to load data:', error);
      showToast('Failed to load user data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (createForm.password !== createForm.confirmPassword) {
      showToast('Passwords do not match', 'error');
      return;
    }

    if (createForm.password.length < 8) {
      showToast('Password must be at least 8 characters long', 'error');
      return;
    }

    setActionLoading('create');
    try {
      const { confirmPassword, ...submitData } = createForm;
      await api.post('/users', submitData);
      
      setShowCreateModal(false);
      setCreateForm({
        username: '',
        email: '',
        password: '',
        confirmPassword: '',
        role: 'Agent',
        fullName: '',
        teamId: ''
      });
      
      await loadData();
      showToast('User created successfully!', 'success');
    } catch (error: any) {
      console.error('Failed to create user:', error);
      showToast(error.response?.data?.error || 'Failed to create user', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleEditUser = (user: User) => {
    setSelectedUser(user);
    setEditForm({
      username: user.username,
      email: user.email,
      role: user.role,
      fullName: user.fullName,
      teamId: user.team?.id || '',
      isActive: user.isActive
    });
    setShowEditModal(true);
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedUser) return;

    setActionLoading('edit');
    try {
      await api.put(`/users/${selectedUser.id}`, editForm);
      
      setShowEditModal(false);
      setSelectedUser(null);
      await loadData();
      showToast('User updated successfully!', 'success');
    } catch (error: any) {
      console.error('Failed to update user:', error);
      showToast(error.response?.data?.error || 'Failed to update user', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleQuickStatusUpdate = async (user: User, isActive: boolean) => {
    setActionLoading(user.id);
    try {
      await api.put(`/users/${user.id}`, {
        ...user,
        isActive
      });
      await loadData();
    } catch (error: any) {
      console.error('Failed to update user:', error);
      showToast(error.response?.data?.error || 'Failed to update user', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;

    setActionLoading('delete');
    try {
      await api.delete(`/users/${selectedUser.id}`);
      
      setShowDeleteModal(false);
      setSelectedUser(null);
      await loadData();
      showToast('User deleted successfully!', 'success');
    } catch (error: any) {
      console.error('Failed to delete user:', error);
      showToast(error.response?.data?.error || 'Failed to delete user', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (resetPassword.newPassword !== resetPassword.confirmPassword) {
      showToast('Passwords do not match', 'error');
      return;
    }

    if (resetPassword.newPassword.length < 8) {
      showToast('Password must be at least 8 characters long', 'error');
      return;
    }

    setActionLoading('reset-password');
    try {
      await api.post(`/users/${selectedUser?.id}/reset-password`, {
        newPassword: resetPassword.newPassword
      });
      
      setShowResetPasswordModal(false);
      setResetPassword({ newPassword: '', confirmPassword: '' });
      setSelectedUser(null);
      
      showToast('Password reset successfully!', 'success');
    } catch (error: any) {
      console.error('Failed to reset password:', error);
      showToast(error.response?.data?.error || 'Failed to reset password', 'error');
    } finally {
      setActionLoading(null);
    }
  };


  const getAvailableTeams = (role: string, currentUser?: User) => {
    if (role === 'Manager') return [];
    
    return teams.filter(team => {
      if (role === 'TeamLeader') {
        // For TeamLeader role, only show teams without a team leader or teams where this user is already leader
        return !team.teamLeader || (currentUser && team.teamLeader.id === currentUser.id);
      }
      return true;
    });
  };

  if (loading) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#fafafa' }}><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="py-6 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-between items-center">
            <button
              onClick={() => window.history.back()}
              className="flex items-center text-neutral-600 hover:text-neutral-900 smooth-transition"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              <span className="text-sm font-medium">Back</span>
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-primary bg-primary-hover text-white px-4 py-2 rounded-md text-sm font-medium"
            >
              Create New User
            </button>
          </div>
        </div>

        {/* Users Table */}
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Serial
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Team
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {users.map((user) => (
                <tr key={user.id} className={user.isActive ? '' : 'bg-gray-50'}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-semibold text-gray-900">
                      {user.serialNumber || 'N/A'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {user.fullName}
                        {!user.isActive && (
                          <span className="ml-2 text-xs text-gray-500">(Inactive)</span>
                        )}
                      </div>
                      <div className="text-sm text-gray-500">
                        {user.username} • {user.email}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`role-badge inline-flex text-xs font-semibold rounded-full px-2 py-1 ${getRoleBadgeColor(user.role)}`}>
                      {getRoleLabel(user.role)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {user.team?.name || 'No Team'}
                    {user.managedTeam && (
                      <span className="text-xs text-primary ml-1">(Leads {user.managedTeam.name})</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button
                      onClick={() => handleQuickStatusUpdate(user, !user.isActive)}
                      disabled={actionLoading === user.id}
                      className={`status-badge inline-flex text-xs font-semibold rounded-full px-2 py-1 border ${
                        user.isActive 
                          ? 'bg-green-100 text-green-800 border-green-200 hover:bg-green-200' 
                          : 'bg-red-100 text-red-800 border-red-200 hover:bg-red-200'
                      } ${actionLoading === user.id ? 'opacity-50' : ''}`}
                    >
                      {user.isActive ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button
                      onClick={() => handleEditUser(user)}
                      className="text-primary hover:text-cyan-900 font-medium"
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Create User Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
            <div className="relative w-full max-w-2xl glass-strong shadow-glass border border-neutral-200/50 overflow-hidden">
              {/* Modal Header */}
              <div className="px-6 py-4 border-b border-neutral-200/50 bg-gradient-to-r from-blue-50 to-blue-50">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-semibold text-neutral-900">Create New User</h3>
                    <p className="text-sm text-neutral-600 mt-1">Add a new user to the system</p>
                  </div>
                  <button
                    onClick={() => setShowCreateModal(false)}
                    className="text-neutral-400 hover:text-neutral-600 transition-colors"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Modal Body */}
              <form onSubmit={handleCreateUser} className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-2">Full Name *</label>
                    <input
                      type="text"
                      required
                      value={createForm.fullName}
                      onChange={(e) => setCreateForm({...createForm, fullName: e.target.value})}
                      className="w-full px-4 py-2.5 border border-neutral-300 focus:ring-2 focus:ring-primary500 focus:border-transparent transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-2">Username *</label>
                    <input
                      type="text"
                      required
                      value={createForm.username}
                      onChange={(e) => setCreateForm({...createForm, username: e.target.value})}
                      className="w-full px-4 py-2.5 border border-neutral-300 focus:ring-2 focus:ring-primary500 focus:border-transparent transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-2">Email *</label>
                    <input
                      type="email"
                      required
                      value={createForm.email}
                      onChange={(e) => setCreateForm({...createForm, email: e.target.value})}
                      className="w-full px-4 py-2.5 border border-neutral-300 focus:ring-2 focus:ring-primary500 focus:border-transparent transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-2">Role *</label>
                    <select
                      value={createForm.role}
                      onChange={(e) => setCreateForm({...createForm, role: e.target.value, teamId: ''})}
                      className="w-full px-4 py-2.5 border border-neutral-300 focus:ring-2 focus:ring-primary500 focus:border-transparent transition-all"
                    >
                      <option value="Agent">Agent</option>
                      <option value="SeniorAgent">Senior Agent</option>
                      <option value="QualityControl">QC Agent</option>
                      <option value="TeamLeader">Team Leader</option>
                      <option value="AccountManager">Account Manager</option>
                      <option value="Manager">Manager</option>
                      <option value="Client">Client</option>`n                      <option value="IT">IT Support</option>
                    </select>
                  </div>

                  {createForm.role !== 'Manager' && (
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-neutral-700 mb-2">Team</label>
                      <select
                        value={createForm.teamId}
                        onChange={(e) => setCreateForm({...createForm, teamId: e.target.value})}
                        className="w-full px-4 py-2.5 border border-neutral-300 focus:ring-2 focus:ring-primary500 focus:border-transparent transition-all"
                      >
                        <option value="">Select Team</option>
                        {getAvailableTeams(createForm.role).map((team) => (
                          <option key={team.id} value={team.id}>
                            {team.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-2">Password *</label>
                    <input
                      type="password"
                      required
                      value={createForm.password}
                      onChange={(e) => setCreateForm({...createForm, password: e.target.value})}
                      className="w-full px-4 py-2.5 border border-neutral-300 focus:ring-2 focus:ring-primary500 focus:border-transparent transition-all"
                    />
                    <p className="text-xs text-neutral-500 mt-1">Minimum 8 characters</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-2">Confirm Password *</label>
                    <input
                      type="password"
                      required
                      value={createForm.confirmPassword}
                      onChange={(e) => setCreateForm({...createForm, confirmPassword: e.target.value})}
                      className="w-full px-4 py-2.5 border border-neutral-300 focus:ring-2 focus:ring-primary500 focus:border-transparent transition-all"
                    />
                  </div>
                </div>

                {/* Modal Footer */}
                <div className="flex justify-end space-x-3 mt-6 pt-6 border-t border-neutral-200/50">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-6 py-2.5 text-sm font-medium text-neutral-700 bg-white border border-neutral-300 hover:bg-neutral-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading === 'create'}
                    className="px-6 py-2.5 text-sm font-medium text-white bg-primary bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {actionLoading === 'create' ? 'Creating...' : 'Create User'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Edit User Modal */}
        {showEditModal && selectedUser && (
          <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
            <div className="relative w-full max-w-2xl glass-strong rounded-2xl shadow-glass border border-neutral-200/50 overflow-hidden">
              {/* Modal Header */}
              <div className="px-6 py-4 border-b border-neutral-200/50 bg-gradient-to-r from-blue-50 to-blue-50">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-semibold text-neutral-900">Edit User</h3>
                    <p className="text-sm text-neutral-600 mt-1">{selectedUser.fullName}</p>
                  </div>
                  <button
                    onClick={() => setShowEditModal(false)}
                    className="text-neutral-400 hover:text-neutral-600 transition-colors"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Modal Body */}
              <form onSubmit={handleUpdateUser} className="p-6">
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div>
                    <label className="block text-xs font-medium text-neutral-500 uppercase tracking-wide mb-2">Full Name *</label>
                    <input
                      type="text"
                      required
                      value={editForm.fullName}
                      onChange={(e) => setEditForm({...editForm, fullName: e.target.value})}
                      className="block w-full px-3 py-2 rounded-lg border border-neutral-200/50 bg-white/80 backdrop-blur-sm shadow-subtle text-neutral-900 focus:outline-none focus:ring-2 focus:ring-primary400 focus:border-primary400 transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-neutral-500 uppercase tracking-wide mb-2">Username *</label>
                    <input
                      type="text"
                      required
                      value={editForm.username}
                      onChange={(e) => setEditForm({...editForm, username: e.target.value})}
                      className="block w-full px-3 py-2 rounded-lg border border-neutral-200/50 bg-white/80 backdrop-blur-sm shadow-subtle text-neutral-900 focus:outline-none focus:ring-2 focus:ring-primary400 focus:border-primary400 transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-neutral-500 uppercase tracking-wide mb-2">Email *</label>
                    <input
                      type="email"
                      required
                      value={editForm.email}
                      onChange={(e) => setEditForm({...editForm, email: e.target.value})}
                      className="block w-full px-3 py-2 rounded-lg border border-neutral-200/50 bg-white/80 backdrop-blur-sm shadow-subtle text-neutral-900 focus:outline-none focus:ring-2 focus:ring-primary400 focus:border-primary400 transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-neutral-500 uppercase tracking-wide mb-2">Role *</label>
                    <select
                      value={editForm.role}
                      onChange={(e) => setEditForm({...editForm, role: e.target.value, teamId: ''})}
                      className="block w-full px-3 py-2 rounded-lg border border-neutral-200/50 bg-white/80 backdrop-blur-sm shadow-subtle text-neutral-900 focus:outline-none focus:ring-2 focus:ring-primary400 focus:border-primary400 transition-all"
                    >
                      <option value="Agent">Agent</option>
                      <option value="SeniorAgent">Senior Agent</option>
                      <option value="QualityControl">QC Agent</option>
                      <option value="TeamLeader">Team Leader</option>
                      <option value="AccountManager">Account Manager</option>
                      <option value="Manager">Manager</option>
                      <option value="Client">Client</option>`n                      <option value="IT">IT Support</option>
                    </select>
                  </div>

                  {editForm.role !== 'Manager' && (
                    <div>
                      <label className="block text-xs font-medium text-neutral-500 uppercase tracking-wide mb-2">Team</label>
                      <select
                        value={editForm.teamId}
                        onChange={(e) => setEditForm({...editForm, teamId: e.target.value})}
                        className="block w-full px-3 py-2 rounded-lg border border-neutral-200/50 bg-white/80 backdrop-blur-sm shadow-subtle text-neutral-900 focus:outline-none focus:ring-2 focus:ring-primary400 focus:border-primary400 transition-all"
                      >
                        <option value="">Select Team</option>
                        {getAvailableTeams(editForm.role, selectedUser).map((team) => (
                          <option key={team.id} value={team.id}>
                            {team.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-medium text-neutral-500 uppercase tracking-wide mb-2">Status</label>
                    <select
                      value={editForm.isActive ? 'active' : 'inactive'}
                      onChange={(e) => setEditForm({...editForm, isActive: e.target.value === 'active'})}
                      className="block w-full px-3 py-2 rounded-lg border border-neutral-200/50 bg-white/80 backdrop-blur-sm shadow-subtle text-neutral-900 focus:outline-none focus:ring-2 focus:ring-primary400 focus:border-primary400 transition-all"
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex justify-between items-center pt-6 border-t border-neutral-200/50">
                  <div className="flex space-x-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowEditModal(false);
                        setShowResetPasswordModal(true);
                      }}
                      className="px-4 py-2.5 text-sm font-medium text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-xl hover:bg-yellow-100 transition-colors shadow-subtle"
                    >
                      🔑 Reset Password
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowEditModal(false);
                        setShowDeleteModal(true);
                      }}
                      className="px-4 py-2.5 text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-xl hover:bg-red-100 transition-colors shadow-subtle"
                    >
                      🗑️ Delete User
                    </button>
                  </div>
                  <div className="flex space-x-3">
                    <button
                      type="button"
                      onClick={() => setShowEditModal(false)}
                      className="px-5 py-2.5 text-sm font-medium text-neutral-700 glass rounded-xl shadow-subtle hover:shadow-gentle transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={actionLoading === 'edit'}
                      className="px-5 py-2.5 text-sm font-medium text-white rounded-xl shadow-gentle hover:shadow-hover transition-all bg-gradient-to-r from-blue-500 to-blue-500 hover:from-blue-600 hover:to-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {actionLoading === 'edit' ? 'Updating...' : '✓ Update User'}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Reset Password Modal */}
        {showResetPasswordModal && selectedUser && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-full max-w-md shadow-lg rounded-md bg-white">
              <div className="mt-3">
                <h3 className="text-lg font-medium text-gray-900 mb-4">
                  Reset Password for {selectedUser.fullName}
                </h3>
                
                <form onSubmit={handleResetPassword} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">New Password *</label>
                    <input
                      type="password"
                      required
                      value={resetPassword.newPassword}
                      onChange={(e) => setResetPassword({...resetPassword, newPassword: e.target.value})}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary500 focus:ring-primary500"
                      placeholder="Minimum 8 characters"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Confirm Password *</label>
                    <input
                      type="password"
                      required
                      value={resetPassword.confirmPassword}
                      onChange={(e) => setResetPassword({...resetPassword, confirmPassword: e.target.value})}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary500 focus:ring-primary500"
                    />
                  </div>

                  <div className="flex justify-end space-x-3 pt-4">
                    <button
                      type="button"
                      onClick={() => {
                        setShowResetPasswordModal(false);
                        setSelectedUser(null);
                        setResetPassword({ newPassword: '', confirmPassword: '' });
                      }}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={actionLoading === 'reset-password'}
                      className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-md bg-primary-hover disabled:opacity-50"
                    >
                      {actionLoading === 'reset-password' ? 'Resetting...' : 'Reset Password'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteModal && selectedUser && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-full max-w-md shadow-lg rounded-md bg-white">
              <div className="mt-3 text-center">
                <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
                  <span className="text-red-600 text-xl">⚠️</span>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mt-3">Delete User</h3>
                <div className="mt-2">
                  <p className="text-sm text-gray-500">
                    Are you sure you want to delete <strong>{selectedUser.fullName}</strong>?
                  </p>
                  <p className="text-sm text-gray-500 mt-2">
                    This action cannot be undone. The user will be permanently removed from the system.
                  </p>
                </div>
                <div className="flex justify-center space-x-3 pt-4">
                  <button
                    onClick={() => {
                      setShowDeleteModal(false);
                      setSelectedUser(null);
                    }}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDeleteUser}
                    disabled={actionLoading === 'delete'}
                    className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50"
                  >
                    {actionLoading === 'delete' ? 'Deleting...' : 'Delete User'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default UserManagement;




