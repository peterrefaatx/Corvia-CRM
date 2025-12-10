import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout/Layout';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import api from '../services/api';
import { usePageTitle } from '../hooks/usePageTitle';

interface TeamMember {
  id: string;
  name: string;
  email: string;
  positionTitle: string;
  permissionSet: any;
  status: 'active' | 'inactive';
  isAvailable: boolean;
  createdAt: string;
  updatedAt: string;
  _count: {
    assignedLeads: number;
    assignedTasks: number;
  };
}

interface PermissionSet {
  leads: {
    view_all: boolean;
    view_assigned: boolean;
  };
  tasks: {
    view_tasks: boolean;
    complete_tasks: boolean;
    assign_tasks: boolean;
  };
  pipeline: {
    view_pipeline: boolean;
    full_access: boolean;
    mark_closed: boolean;
    mark_dead: boolean;
  };
  team_management: {
    create_users: boolean;
    edit_users: boolean;
    delete_users: boolean;
    set_permissions: boolean;
  };
}

const defaultPermissions: PermissionSet = {
  leads: {
    view_all: false,
    view_assigned: true
  },
  tasks: {
    view_tasks: true,
    complete_tasks: true,
    assign_tasks: false
  },
  pipeline: {
    view_pipeline: false,
    full_access: false,
    mark_closed: false,
    mark_dead: false
  },
  team_management: {
    create_users: false,
    edit_users: false,
    delete_users: false,
    set_permissions: false
  }
};

interface Position {
  id: string;
  title: string;
  description: string | null;
  permissionSet: PermissionSet;
  isActive: boolean;
  _count: {
    teamMembers: number;
  };
}

const ClientTeamMembers: React.FC = () => {
  usePageTitle('Team Members');
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showSuccess, showError } = useToast();
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [memberToDelete, setMemberToDelete] = useState<TeamMember | null>(null);
  
  // Position management state
  const [showPositionsModal, setShowPositionsModal] = useState(false);
  const [positions, setPositions] = useState<Position[]>([]);
  const [loadingPositions, setLoadingPositions] = useState(false);
  const [showAddPosition, setShowAddPosition] = useState(false);
  const [newPositionTitle, setNewPositionTitle] = useState('');
  const [newPositionDescription, setNewPositionDescription] = useState('');
  const [newPositionPermissions, setNewPositionPermissions] = useState<PermissionSet>(defaultPermissions);
  const [editingPosition, setEditingPosition] = useState<Position | null>(null);
  const [showPermissionsFor, setShowPermissionsFor] = useState<string | null>(null);
  const [editingPermissions, setEditingPermissions] = useState<Position | null>(null);

  useEffect(() => {
    loadTeamMembers();
  }, []);

  const loadTeamMembers = async () => {
    try {
      setLoading(true);
      const response = await api.get('/client/team-members');
      setTeamMembers(response.data);
    } catch (error: any) {
      console.error('Failed to load team members:', error);
      showError(error.response?.data?.error || 'Failed to load team members');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (member: TeamMember) => {
    try {
      await api.patch(`/client/team-members/${member.id}/status`);
      showSuccess(`Team member ${member.status === 'active' ? 'deactivated' : 'activated'} successfully`);
      loadTeamMembers();
    } catch (error: any) {
      console.error('Failed to toggle status:', error);
      showError(error.response?.data?.error || 'Failed to toggle status');
    }
  };

  const handleToggleAvailability = async (member: TeamMember) => {
    try {
      await api.patch(`/client/team-members/${member.id}/availability`, {
        isAvailable: !member.isAvailable
      });
      showSuccess(`${member.name} marked as ${member.isAvailable ? 'unavailable (day off)' : 'available'}`);
      loadTeamMembers();
    } catch (error: any) {
      console.error('Failed to toggle availability:', error);
      showError(error.response?.data?.error || 'Failed to toggle availability');
    }
  };

  const handleDeleteClick = (member: TeamMember) => {
    setMemberToDelete(member);
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    if (!memberToDelete) return;

    try {
      await api.delete(`/client/team-members/${memberToDelete.id}`);
      showSuccess('Team member deleted successfully');
      setShowDeleteModal(false);
      setMemberToDelete(null);
      loadTeamMembers();
    } catch (error: any) {
      console.error('Failed to delete team member:', error);
      showError(error.response?.data?.error || 'Failed to delete team member');
    }
  };

  // Position management functions
  const loadPositions = async () => {
    try {
      setLoadingPositions(true);
      const response = await api.get('/client/positions');
      setPositions(response.data);
    } catch (error: any) {
      console.error('Failed to load positions:', error);
      showError('Failed to load positions');
    } finally {
      setLoadingPositions(false);
    }
  };

  const handleOpenPositionsModal = () => {
    setShowPositionsModal(true);
    loadPositions();
  };

  const handleAddPosition = async () => {
    if (!newPositionTitle.trim()) {
      showError('Position title is required');
      return;
    }

    try {
      await api.post('/client/positions', {
        title: newPositionTitle.trim(),
        description: newPositionDescription.trim() || null,
        permissionSet: newPositionPermissions
      });
      showSuccess('Position created successfully');
      setNewPositionTitle('');
      setNewPositionDescription('');
      setNewPositionPermissions(defaultPermissions);
      setShowAddPosition(false);
      loadPositions();
    } catch (error: any) {
      console.error('Failed to create position:', error);
      showError(error.response?.data?.error || 'Failed to create position');
    }
  };

  const handleUpdatePosition = async () => {
    if (!editingPosition) return;

    try {
      await api.put(`/client/positions/${editingPosition.id}`, {
        title: editingPosition.title,
        description: editingPosition.description,
        permissionSet: editingPosition.permissionSet
      });
      showSuccess('Position updated successfully');
      setEditingPosition(null);
      loadPositions();
    } catch (error: any) {
      console.error('Failed to update position:', error);
      showError(error.response?.data?.error || 'Failed to update position');
    }
  };

  const handleUpdatePermissions = async () => {
    if (!editingPermissions) return;

    try {
      await api.put(`/client/positions/${editingPermissions.id}`, {
        title: editingPermissions.title,
        description: editingPermissions.description,
        permissionSet: editingPermissions.permissionSet
      });
      showSuccess('Permissions updated successfully');
      setEditingPermissions(null);
      loadPositions();
    } catch (error: any) {
      console.error('Failed to update permissions:', error);
      showError(error.response?.data?.error || 'Failed to update permissions');
    }
  };

  const handleDeletePosition = async (position: Position) => {
    if (position._count.teamMembers > 0) {
      showError(`Cannot delete position. ${position._count.teamMembers} team member(s) are assigned to this position.`);
      return;
    }

    if (!confirm(`Are you sure you want to delete the position "${position.title}"?`)) {
      return;
    }

    try {
      await api.delete(`/client/positions/${position.id}`);
      showSuccess('Position deleted successfully');
      loadPositions();
    } catch (error: any) {
      console.error('Failed to delete position:', error);
      showError(error.response?.data?.error || 'Failed to delete position');
    }
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
      <div className="min-h-screen" style={{ backgroundColor: '#fafafa' }}>
        {/* Header */}
        <div className="bg-white border-b border-gray-100 px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">Team Members</h1>
              <p className="text-sm text-gray-500 mt-1">Manage your team members and positions</p>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-3xl font-bold text-primary">{teamMembers.length}</p>
                <p className="text-xs text-gray-500 uppercase tracking-wide">Total Members</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <button
                onClick={handleOpenPositionsModal}
                className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors border border-gray-200"
              >
                Manage Positions
              </button>
              <button
                onClick={() => navigate('/client/team-members/create')}
                className="px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-hover transition-colors flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Member
              </button>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="px-8 py-6">
          {/* Team Members List */}
          {teamMembers.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-2xl border border-gray-100">
              <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-gray-100 mb-4">
                <svg className="h-8 w-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Team Members</h3>
              <p className="text-gray-500 mb-4">Get started by adding your first team member</p>
              <button
                onClick={() => navigate('/client/team-members/create')}
                className="px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg bg-primary-hover transition-colors"
              >
                + Add Team Member
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <table className="min-w-full divide-y divide-gray-100">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-4 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">Name</th>
                    <th className="px-6 py-4 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">Email</th>
                    <th className="px-6 py-4 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">Position</th>
                    <th className="px-6 py-4 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-4 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {teamMembers.map((member) => (
                    <tr key={member.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <div className="text-sm font-medium text-gray-900">{member.name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <div className="text-sm text-gray-600">{member.email}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <div className="text-sm text-gray-600">{member.positionTitle}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          member.status === 'active' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {member.status === 'active' ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => navigate(`/client/team-members/${member.id}/edit`)}
                            className="inline-flex items-center justify-center w-8 h-8 rounded-full text-gray-400 hover:text-primary bg-primary-light-hover transition-colors"
                            title="Edit"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleToggleStatus(member)}
                            className={`inline-flex items-center justify-center w-8 h-8 rounded-full transition-colors ${
                              member.status === 'active'
                                ? 'text-gray-400 hover:text-orange-600 hover:bg-orange-50'
                                : 'text-gray-400 hover:text-green-600 hover:bg-green-50'
                            }`}
                            title={member.status === 'active' ? 'Deactivate' : 'Activate'}
                          >
                            {member.status === 'active' ? (
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                              </svg>
                            ) : (
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            )}
                          </button>
                          <button
                            onClick={() => handleDeleteClick(member)}
                            className="inline-flex items-center justify-center w-8 h-8 rounded-full text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                            title="Delete"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Delete Confirmation Modal */}
        {showDeleteModal && memberToDelete && (
          <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Delete Team Member</h3>
              <p className="text-sm text-gray-600 mb-6">
                Are you sure you want to delete <strong>{memberToDelete.name}</strong>? This action cannot be undone.
              </p>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowDeleteModal(false);
                    setMemberToDelete(null);
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteConfirm}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Positions Management Modal */}
        {showPositionsModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[85vh] overflow-hidden">
              {/* Header */}
              <div className="bg-white px-6 py-5 border-b border-gray-200 flex justify-between items-center">
                <div>
                  <h3 className="text-xl font-semibold text-gray-900">Manage Positions</h3>
                  <p className="text-gray-500 text-sm mt-1">Create and manage team member positions</p>
                </div>
                <button
                  onClick={() => {
                    setShowPositionsModal(false);
                    setShowAddPosition(false);
                    setEditingPosition(null);
                  }}
                  className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg p-2 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Body */}
              <div className="p-6 overflow-y-auto max-h-[calc(85vh-140px)]">
                {/* Add Position Button/Form */}
                {showAddPosition ? (
                  <div className="mb-6 p-5 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border-2 border-primary200">
                    <h4 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Add New Position
                    </h4>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Position Title <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={newPositionTitle}
                          onChange={(e) => setNewPositionTitle(e.target.value)}
                          placeholder="e.g., Sales Representative"
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary500 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Description (Optional)
                        </label>
                        <textarea
                          value={newPositionDescription}
                          onChange={(e) => setNewPositionDescription(e.target.value)}
                          placeholder="Brief description of this position"
                          rows={2}
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary500 focus:border-transparent"
                        />
                      </div>
                      <div className="flex justify-end gap-3 pt-2">
                        <button
                          onClick={() => {
                            setShowAddPosition(false);
                            setNewPositionTitle('');
                            setNewPositionDescription('');
                          }}
                          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleAddPosition}
                          className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg bg-primary-hover transition-colors"
                        >
                          Add Position
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowAddPosition(true)}
                    className="mb-6 w-full px-4 py-3 text-sm font-medium text-primary bg-primary-light border-2 border-dashed border-primary300 rounded-xl hover:bg-primary-light hover:border-primary400 transition-all flex items-center justify-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add New Position
                  </button>
                )}

                {/* Positions List */}
                {loadingPositions ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary600"></div>
                  </div>
                ) : positions.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <p>No positions created yet</p>
                    <p className="text-sm mt-1">Add your first position to get started</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {positions.map((position) => (
                      <div key={position.id} className="border-2 border-gray-200 rounded-xl p-5 hover:border-primary300 hover:shadow-md transition-all bg-white">
                        {editingPosition?.id === position.id ? (
                          <div className="space-y-3">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Position Title</label>
                              <input
                                type="text"
                                value={editingPosition.title}
                                onChange={(e) => setEditingPosition({ ...editingPosition, title: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary500"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                              <textarea
                                value={editingPosition.description || ''}
                                onChange={(e) => setEditingPosition({ ...editingPosition, description: e.target.value })}
                                rows={2}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary500"
                              />
                            </div>
                            <div className="flex justify-end space-x-2">
                              <button
                                onClick={() => setEditingPosition(null)}
                                className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={handleUpdatePosition}
                                className="px-3 py-1.5 text-sm font-medium text-white bg-primary rounded-md bg-primary-hover"
                              >
                                Save
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div>
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center space-x-3">
                                  <h4 className="text-base font-semibold text-gray-900">{position.title}</h4>
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary-light text-primary">
                                    {position._count.teamMembers} {position._count.teamMembers === 1 ? 'member' : 'members'}
                                  </span>
                                </div>
                                {position.description && (
                                  <p className="text-sm text-gray-600 mt-1">{position.description}</p>
                                )}
                              </div>
                              <div className="flex items-center gap-1 ml-4">
                                <button
                                  onClick={() => setShowPermissionsFor(showPermissionsFor === position.id ? null : position.id)}
                                  className="inline-flex items-center justify-center w-8 h-8 rounded-full text-gray-400 hover:text-purple-600 hover:bg-purple-50 transition-colors"
                                  title="Permissions"
                                >
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                  </svg>
                                </button>
                                <button
                                  onClick={() => setEditingPosition(position)}
                                  className="inline-flex items-center justify-center w-8 h-8 rounded-full text-gray-400 hover:text-primary bg-primary-light-hover transition-colors"
                                  title="Edit"
                                >
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                  </svg>
                                </button>
                                <button
                                  onClick={() => handleDeletePosition(position)}
                                  disabled={position._count.teamMembers > 0}
                                  className={`inline-flex items-center justify-center w-8 h-8 rounded-full transition-colors ${
                                    position._count.teamMembers > 0
                                      ? 'text-gray-300 cursor-not-allowed'
                                      : 'text-gray-400 hover:text-red-600 hover:bg-red-50'
                                  }`}
                                  title={position._count.teamMembers > 0 ? 'Cannot delete position with members' : 'Delete'}
                                >
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              </div>
                            </div>
                            
                            {/* Permissions Panel */}
                            {showPermissionsFor === position.id && (() => {
                              let currentPosition = editingPermissions?.id === position.id ? editingPermissions : position;
                              
                              // Ensure pipeline permissions exist (for backward compatibility)
                              if (!currentPosition.permissionSet.pipeline) {
                                currentPosition = {
                                  ...currentPosition,
                                  permissionSet: {
                                    ...currentPosition.permissionSet,
                                    pipeline: {
                                      view_pipeline: false,
                                      full_access: false,
                                      mark_closed: false,
                                      mark_dead: false
                                    }
                                  }
                                };
                              }
                              
                              return (
                              <div className="mt-4 pt-4 border-t border-gray-200">
                                <div className="flex items-start justify-between mb-3">
                                  <div>
                                    <h5 className="text-sm font-semibold text-gray-900">Position Permissions</h5>
                                    <p className="text-xs text-gray-500 mt-1">These permissions apply to all team members in this position</p>
                                  </div>
                                  {editingPermissions?.id === position.id && (
                                    <div className="flex space-x-2 ml-4">
                                      <button
                                        onClick={() => {
                                          setEditingPermissions(null);
                                          loadPositions();
                                        }}
                                        className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                                      >
                                        Cancel
                                      </button>
                                      <button
                                        onClick={handleUpdatePermissions}
                                        className="px-3 py-1.5 text-sm font-medium text-white bg-primary rounded-md bg-primary-hover"
                                      >
                                        Save
                                      </button>
                                    </div>
                                  )}
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  {/* Leads Permissions */}
                                  <div className="bg-gray-50 p-3 rounded-md">
                                    <h6 className="text-xs font-semibold text-gray-700 mb-2 uppercase">Leads</h6>
                                    <div className="space-y-1.5">
                                      {Object.entries(currentPosition.permissionSet.leads).map(([key, value]) => {
                                        const label = key === 'view_all' ? 'Review Qualified Leads' : key.replace(/_/g, ' ');
                                        return (
                                        <div key={key} className="flex items-center justify-between px-3 py-2 hover:bg-white rounded-lg transition-colors">
                                          <span className="text-sm text-gray-700 capitalize">{label}</span>
                                          <button
                                            onClick={() => {
                                              const updated = { ...currentPosition };
                                              updated.permissionSet.leads[key as keyof typeof updated.permissionSet.leads] = !value;
                                              setEditingPermissions(updated);
                                            }}
                                            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                                              value ? 'bg-primary' : 'bg-gray-300'
                                            }`}
                                          >
                                            <span
                                              className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                                                value ? 'translate-x-5' : 'translate-x-1'
                                              }`}
                                            />
                                          </button>
                                        </div>
                                        );
                                      })}
                                    </div>
                                  </div>

                                  {/* Tasks Permissions */}
                                  <div className="bg-gray-50 p-3 rounded-md">
                                    <h6 className="text-xs font-semibold text-gray-700 mb-2 uppercase">Tasks</h6>
                                    <div className="space-y-1.5">
                                      {Object.entries(currentPosition.permissionSet.tasks).map(([key, value]) => (
                                        <div key={key} className="flex items-center justify-between px-3 py-2 hover:bg-white rounded-lg transition-colors">
                                          <span className="text-sm text-gray-700 capitalize">{key.replace(/_/g, ' ')}</span>
                                          <button
                                            onClick={() => {
                                              const updated = { ...currentPosition };
                                              updated.permissionSet.tasks[key as keyof typeof updated.permissionSet.tasks] = !value;
                                              setEditingPermissions(updated);
                                            }}
                                            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                                              value ? 'bg-primary' : 'bg-gray-300'
                                            }`}
                                          >
                                            <span
                                              className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                                                value ? 'translate-x-5' : 'translate-x-1'
                                              }`}
                                            />
                                          </button>
                                        </div>
                                      ))}
                                    </div>
                                  </div>

                                  {/* Pipeline Permissions */}
                                  <div className="bg-gray-50 p-3 rounded-md">
                                    <h6 className="text-xs font-semibold text-gray-700 mb-2 uppercase">Pipeline</h6>
                                    <div className="space-y-1.5">
                                      {['view_pipeline', 'full_access', 'mark_closed', 'mark_dead'].map((key) => {
                                        const value = currentPosition.permissionSet.pipeline[key as keyof typeof currentPosition.permissionSet.pipeline];
                                        return (
                                          <div key={key} className="flex items-center justify-between px-3 py-2 hover:bg-white rounded-lg transition-colors">
                                            <span className="text-sm text-gray-700 capitalize">{key.replace(/_/g, ' ')}</span>
                                            <button
                                              onClick={() => {
                                                const updated = { ...currentPosition };
                                                updated.permissionSet.pipeline[key as keyof typeof updated.permissionSet.pipeline] = !value;
                                                setEditingPermissions(updated);
                                              }}
                                              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                                                value ? 'bg-primary' : 'bg-gray-300'
                                              }`}
                                            >
                                              <span
                                                className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                                                  value ? 'translate-x-5' : 'translate-x-1'
                                                }`}
                                              />
                                            </button>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>

                                  {/* Team Management Permissions */}
                                  <div className="bg-gray-50 p-3 rounded-md">
                                    <h6 className="text-xs font-semibold text-gray-700 mb-2 uppercase">Team Management</h6>
                                    <div className="space-y-1.5">
                                      {Object.entries(currentPosition.permissionSet.team_management).map(([key, value]) => (
                                        <div key={key} className="flex items-center justify-between px-3 py-2 hover:bg-white rounded-lg transition-colors">
                                          <span className="text-sm text-gray-700 capitalize">{key.replace(/_/g, ' ')}</span>
                                          <button
                                            onClick={() => {
                                              const updated = { ...currentPosition };
                                              updated.permissionSet.team_management[key as keyof typeof updated.permissionSet.team_management] = !value;
                                              setEditingPermissions(updated);
                                            }}
                                            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                                              value ? 'bg-primary' : 'bg-gray-300'
                                            }`}
                                          >
                                            <span
                                              className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                                                value ? 'translate-x-5' : 'translate-x-1'
                                              }`}
                                            />
                                          </button>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              </div>
                              );
                            })()}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex justify-end">
                <button
                  onClick={() => {
                    setShowPositionsModal(false);
                    setShowAddPosition(false);
                    setEditingPosition(null);
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
        </div>
      </div>
    </Layout>
  );
};

export default ClientTeamMembers;





