// TeamManagement.tsx
import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout/Layout';
import api from '../services/api';

interface Team {
  id: string;
  name: string;
  teamLeader?: {
    id: string;
    fullName: string;
    username: string;
  };
  _count?: {
    users: number;
    leads: number;
  };
  dailyTarget?: number;
  members?: Array<{
    id: string;
    fullName: string;
    role: string;
  }>;
}

interface CreateTeamForm {
  name: string;
  teamLeaderUserId?: string;
}

interface TeamLeader {
  id: string;
  fullName: string;
  username: string;
}

const TeamManagement: React.FC = () => {
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamLeaders, setTeamLeaders] = useState<TeamLeader[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string>('');
  const [showTeamMembersModal, setShowTeamMembersModal] = useState(false);
  const [selectedTeamForMembers, setSelectedTeamForMembers] = useState<Team | null>(null);

  const [createForm, setCreateForm] = useState<CreateTeamForm>({
    name: '',
    teamLeaderUserId: ''
  });

  const [editForm, setEditForm] = useState<CreateTeamForm>({
    name: '',
    teamLeaderUserId: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setError('');
      const [teamsResponse, usersResponse, campaignsResponse] = await Promise.all([
        api.get('/teams'),
        api.get('/users'),
        api.get('/campaigns/all')
      ]);
      
      // Extract teams from response
      const teamsData = teamsResponse.data.data || teamsResponse.data;
      
      // Extract campaigns
      const campaignsData = campaignsResponse.data.data || campaignsResponse.data;
      
      // Extract team leaders from users
      const usersData = usersResponse.data.data || usersResponse.data;
      const leaders = usersData.filter((user: any) => user.role === 'TeamLeader');
      setTeamLeaders(leaders);
      
      // Calculate daily target for each team (sum of all campaign targets assigned to team)
      const teamsWithTargets = teamsData.map((team: Team) => {
        const teamCampaigns = campaignsData.filter((campaign: any) =>
          campaign.teams?.some((ct: any) => ct.team.id === team.id)
        );
        const dailyTarget = teamCampaigns.reduce((sum: number, campaign: any) => {
          return sum + (campaign.leadsTarget || 0);
        }, 0);
        
        // Get team members (Agents, Senior Agents, and TeamLeaders)
        const teamMembers = usersData
          .filter((user: any) => {
            const isInTeam = user.team?.id === team.id;
            const isCorrectRole = user.role === 'Agent' || user.role === 'SeniorAgent' || user.role === 'TeamLeader';
            return isInTeam && isCorrectRole;
          })
          .map((user: any) => ({
            id: user.id,
            fullName: user.fullName,
            role: user.role
          }))
          .sort((a: any, b: any) => {
            // Prioritize team leader
            if (a.role === 'TeamLeader') return -1;
            if (b.role === 'TeamLeader') return 1;
            return 0;
          });
        
        return {
          ...team,
          dailyTarget,
          members: teamMembers
        };
      });
      
      setTeams(teamsWithTargets);
    } catch (error) {
      console.error('Failed to load data:', error);
      setError('Failed to load data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!createForm.name.trim()) {
      setError('Please enter a team name');
      return;
    }

    setActionLoading('create');
    setError('');
    try {
      await api.post('/teams', {
        name: createForm.name,
        teamLeaderUserId: createForm.teamLeaderUserId || null
      });
      
      await loadData();
      setShowCreateModal(false);
      setCreateForm({ name: '', teamLeaderUserId: '' });
      setError('');
    } catch (error: any) {
      console.error('Failed to create team:', error);
      const errorMessage = error.response?.data?.error || error.response?.data?.message || 'Failed to create team';
      setError(errorMessage);
    } finally {
      setActionLoading(null);
    }
  };

  const handleEditTeam = (team: Team) => {
    setSelectedTeam(team);
    setEditForm({
      name: team.name,
      teamLeaderUserId: team.teamLeader?.id || ''
    });
    setShowEditModal(true);
    setError('');
  };

  const handleUpdateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedTeam) return;

    setActionLoading('edit');
    setError('');
    try {
      await api.put(`/teams/${selectedTeam.id}`, {
        name: editForm.name,
        teamLeaderUserId: editForm.teamLeaderUserId || null
      });
      
      await loadData();
      setShowEditModal(false);
      setSelectedTeam(null);
      setError('');
    } catch (error: any) {
      console.error('Failed to update team:', error);
      const errorMessage = error.response?.data?.error || error.response?.data?.message || 'Failed to update team';
      setError(errorMessage);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteTeam = async () => {
    if (!selectedTeam) return;

    setActionLoading('delete');
    setError('');
    try {
      const response = await api.delete(`/teams/${selectedTeam.id}`);
      
      await loadData();
      setShowDeleteModal(false);
      setSelectedTeam(null);
      
      // Show success message with details
      const details = [];
      if (response.data.usersAffected > 0) {
        details.push(`${response.data.usersAffected} user${response.data.usersAffected !== 1 ? 's' : ''}`);
      }
      if (response.data.leadsAffected > 0) {
        details.push(`${response.data.leadsAffected} lead${response.data.leadsAffected !== 1 ? 's' : ''}`);
      }
      
      if (details.length > 0) {
        setError(`Team "${selectedTeam.name}" deleted successfully! ${details.join(' and ')} ${details.length > 1 ? 'were' : 'was'} disassociated from the team.`);
      } else {
        setError(`Team "${selectedTeam.name}" deleted successfully!`);
      }
      
      // Clear success message after 5 seconds
      setTimeout(() => setError(''), 5000);
    } catch (error: any) {
      console.error('Failed to delete team:', error);
      
      // More specific error messages
      let errorMessage = 'Failed to delete team. Please try again.';
      if (error.response?.status === 404) {
        errorMessage = 'Team not found. It may have been already deleted.';
      } else if (error.response?.status === 403) {
        errorMessage = 'You do not have permission to delete teams.';
      } else if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      }
      
      setError(errorMessage);
    } finally {
      setActionLoading(null);
    }
  };

  const openDeleteModal = (team: Team) => {
    setSelectedTeam(team);
    setShowDeleteModal(true);
    setError('');
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
              Create Team
            </button>
          </div>
        </div>

        {/* Error/Success Message */}
        {error && (
          <div className={`mb-6 p-4 rounded-lg ${
            error.includes('successfully') 
              ? 'bg-green-50 border border-green-200 text-green-700'
              : 'bg-red-50 border border-red-200 text-red-700'
          }`}>
            <div className="flex items-center">
              <div className="flex-shrink-0">
                {error.includes('successfully') ? (
                  <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium">{error}</p>
              </div>
              <div className="ml-auto">
                <button 
                  onClick={() => setError('')}
                  className="text-sm bg-transparent hover:bg-white hover:bg-opacity-20 px-2 py-1 rounded"
                >
                  ×
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Teams Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Team Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Team Leader</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Members</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Daily Target</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {teams.map((team) => (
                <tr key={team.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{team.name}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-600">
                      {team.teamLeader ? team.teamLeader.fullName : <span className="text-gray-400 italic">No team leader</span>}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-600">{team.members?.length || 0}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-600">{team.dailyTarget || 0}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => {
                        setSelectedTeamForMembers(team);
                        setShowTeamMembersModal(true);
                      }}
                      className="inline-flex items-center px-3 py-1.5 bg-primary-light text-primary hover:bg-primary-light rounded text-xs font-medium mr-2"
                    >
                      View Members
                    </button>
                    <button
                      onClick={() => handleEditTeam(team)}
                      className="inline-flex items-center px-3 py-1.5 bg-primary-light text-primary hover:bg-primary-light rounded text-xs font-medium"
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {teams.length === 0 && !loading && (
          <div className="glass rounded-2xl shadow-soft border border-neutral-200/30">
            <div className="text-center py-16">
              <div className="mx-auto h-16 w-16 text-neutral-300 mb-6">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-16 h-16">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <p className="text-neutral-600 text-lg font-medium mb-2" style={{ letterSpacing: '0.01em' }}>No teams found</p>
              <p className="text-neutral-500 text-sm" style={{ letterSpacing: '0.01em' }}>Create your first team to get started</p>
            </div>
          </div>
        )}

        {/* Create Team Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-neutral-900/40 backdrop-blur-sm overflow-y-auto h-full w-full z-50 flex items-start justify-center pt-8 pb-8">
            <div className="relative mx-auto p-8 w-full max-w-md glass-strong rounded-3xl shadow-glass border border-neutral-200/50">
              <div>
                <h3 className="text-2xl font-semibold text-neutral-900 mb-6" style={{ letterSpacing: '-0.01em' }}>Create New Team</h3>
                
                <form onSubmit={handleCreateTeam} className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-2.5" style={{ letterSpacing: '0.01em' }}>Team Name *</label>
                    <input
                      type="text"
                      required
                      value={createForm.name}
                      onChange={(e) => setCreateForm({...createForm, name: e.target.value})}
                      className="w-full px-4 py-3.5 bg-white/80 backdrop-blur-sm border border-neutral-200/50 rounded-2xl shadow-subtle placeholder-neutral-400 text-neutral-900 focus:outline-none focus:ring-2 focus:ring-mint-400 focus:border-mint-400 smooth-transition"
                      placeholder="e.g., Sales Team Alpha"
                      style={{ letterSpacing: '0.01em' }}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-2.5" style={{ letterSpacing: '0.01em' }}>Team Leader</label>
                    <select
                      value={createForm.teamLeaderUserId || ''}
                      onChange={(e) => setCreateForm({...createForm, teamLeaderUserId: e.target.value})}
                      className="w-full px-4 py-3.5 bg-white/80 backdrop-blur-sm border border-neutral-200/50 rounded-2xl shadow-subtle text-neutral-900 focus:outline-none focus:ring-2 focus:ring-mint-400 focus:border-mint-400 smooth-transition"
                      style={{ letterSpacing: '0.01em' }}
                    >
                      <option value="">No team leader</option>
                      {teamLeaders.map((leader) => (
                        <option key={leader.id} value={leader.id}>
                          {leader.fullName} ({leader.username})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex justify-end space-x-3 pt-4">
                    <button
                      type="button"
                      onClick={() => setShowCreateModal(false)}
                      className="px-5 py-2.5 text-sm font-medium text-neutral-700 glass rounded-xl shadow-subtle hover:shadow-gentle smooth-transition"
                      style={{ letterSpacing: '0.01em' }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={actionLoading === 'create'}
                      className="px-6 py-3 text-sm font-medium text-white rounded-2xl shadow-gentle hover:shadow-hover smooth-transition hover-lift gradient-mint disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:transform-none"
                      style={{ letterSpacing: '0.01em' }}
                    >
                      {actionLoading === 'create' ? 'Creating...' : 'Create Team'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Edit Team Modal */}
        {showEditModal && selectedTeam && (
          <div className="fixed inset-0 bg-neutral-900/40 backdrop-blur-sm overflow-y-auto h-full w-full z-50 flex items-start justify-center pt-8 pb-8">
            <div className="relative mx-auto p-8 w-full max-w-md glass-strong rounded-3xl shadow-glass border border-neutral-200/50">
              <div>
                <h3 className="text-2xl font-semibold text-neutral-900 mb-6" style={{ letterSpacing: '-0.01em' }}>Edit Team</h3>
                
                <form onSubmit={handleUpdateTeam} className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-2.5" style={{ letterSpacing: '0.01em' }}>Team Name *</label>
                    <input
                      type="text"
                      required
                      value={editForm.name}
                      onChange={(e) => setEditForm({...editForm, name: e.target.value})}
                      className="w-full px-4 py-3.5 bg-white/80 backdrop-blur-sm border border-neutral-200/50 rounded-2xl shadow-subtle placeholder-neutral-400 text-neutral-900 focus:outline-none focus:ring-2 focus:ring-mint-400 focus:border-mint-400 smooth-transition"
                      style={{ letterSpacing: '0.01em' }}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-2.5" style={{ letterSpacing: '0.01em' }}>Team Leader</label>
                    <select
                      value={editForm.teamLeaderUserId || ''}
                      onChange={(e) => setEditForm({...editForm, teamLeaderUserId: e.target.value})}
                      className="w-full px-4 py-3.5 bg-white/80 backdrop-blur-sm border border-neutral-200/50 rounded-2xl shadow-subtle text-neutral-900 focus:outline-none focus:ring-2 focus:ring-mint-400 focus:border-mint-400 smooth-transition"
                      style={{ letterSpacing: '0.01em' }}
                    >
                      <option value="">No team leader</option>
                      {teamLeaders.map((leader) => (
                        <option key={leader.id} value={leader.id}>
                          {leader.fullName} ({leader.username})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex justify-between items-center pt-6 border-t border-neutral-200/50 mt-6">
                    <button
                      type="button"
                      onClick={() => {
                        setShowEditModal(false);
                        openDeleteModal(selectedTeam);
                      }}
                      className="px-4 py-2.5 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-xl transition-colors border border-red-200"
                      style={{ letterSpacing: '0.01em' }}
                    >
                      Delete Team
                    </button>
                    <div className="flex space-x-3">
                      <button
                        type="button"
                        onClick={() => {
                          setShowEditModal(false);
                          setSelectedTeam(null);
                        }}
                        className="px-5 py-2.5 text-sm font-medium text-neutral-700 glass rounded-xl shadow-subtle hover:shadow-gentle smooth-transition"
                        style={{ letterSpacing: '0.01em' }}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={actionLoading === 'edit'}
                        className="px-6 py-3 text-sm font-medium text-white rounded-2xl shadow-gentle hover:shadow-hover smooth-transition hover-lift gradient-mint disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:transform-none"
                        style={{ letterSpacing: '0.01em' }}
                      >
                        {actionLoading === 'edit' ? 'Updating...' : 'Update Team'}
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Show Team Members Modal */}
        {showTeamMembersModal && selectedTeamForMembers && (
          <div className="fixed inset-0 bg-neutral-900/40 backdrop-blur-sm overflow-y-auto h-full w-full z-50 flex items-start justify-center pt-8 pb-8">
            <div className="relative mx-auto p-8 w-full max-w-md glass-strong rounded-3xl shadow-glass border border-neutral-200/50">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-semibold text-neutral-900" style={{ letterSpacing: '-0.01em' }}>
                  Team Members: {selectedTeamForMembers.name}
                </h3>
                <button
                  onClick={() => {
                    setShowTeamMembersModal(false);
                    setSelectedTeamForMembers(null);
                  }}
                  className="text-neutral-400 hover:text-neutral-600 smooth-transition p-2 rounded-xl hover:bg-neutral-100/50"
                >
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="space-y-3">
                {selectedTeamForMembers.members && selectedTeamForMembers.members.length > 0 ? (
                  selectedTeamForMembers.members.map((member) => (
                    <div
                      key={member.id}
                      className="glass rounded-xl p-4 border border-neutral-200/30"
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-neutral-900" style={{ letterSpacing: '0.01em' }}>
                          {member.fullName}
                        </p>
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                          member.role === 'TeamLeader' ? 'bg-primary-light/80 text-primary border border-primary200/50' :
                          member.role === 'SeniorAgent' ? 'bg-primary-light/80 text-primary border border-primary200/50' :
                          member.role === 'Agent' ? 'bg-green-100/80 text-green-700 border border-green-200/50' :
                          'bg-neutral-100/80 text-neutral-700 border border-neutral-200/50'
                        }`} style={{ letterSpacing: '0.01em' }}>
                          {member.role === 'SeniorAgent' ? 'Senior Agent' : member.role}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-neutral-500 text-center py-8" style={{ letterSpacing: '0.01em' }}>
                    No members in this team
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Delete Team Modal */}
        {showDeleteModal && selectedTeam && (
          <div className="fixed inset-0 bg-neutral-900/40 backdrop-blur-sm overflow-y-auto h-full w-full z-50 flex items-start justify-center pt-8 pb-8">
            <div className="relative mx-auto p-8 w-full max-w-md glass-strong rounded-3xl shadow-glass border border-neutral-200/50">
              <div className="text-center">
                <div className="mx-auto flex items-center justify-center h-14 w-14 rounded-2xl bg-red-100/80 mb-6 shadow-subtle">
                  <span className="text-red-600 text-2xl">⚠️</span>
                </div>
                <h3 className="text-2xl font-semibold text-neutral-900 mb-6" style={{ letterSpacing: '-0.01em' }}>Delete Team</h3>
                <div className="mt-2">
                  <p className="text-sm text-neutral-600 mb-4" style={{ letterSpacing: '0.01em' }}>
                    Are you sure you want to delete <strong className="text-neutral-900">{selectedTeam.name}</strong>?
                  </p>
                  {(selectedTeam._count && (selectedTeam._count.users > 0 || selectedTeam._count.leads > 0)) && (
                    <div className="mt-4 mb-4 p-4 glass rounded-xl border border-primary200/50 shadow-subtle">
                      <p className="text-sm text-primary font-medium mb-2" style={{ letterSpacing: '0.01em' }}>
                        📊 This team has:
                      </p>
                      <ul className="text-xs text-primary mt-1 list-disc list-inside space-y-1" style={{ letterSpacing: '0.01em' }}>
                        {selectedTeam._count.users > 0 && (
                          <li>{selectedTeam._count.users} member{selectedTeam._count.users !== 1 ? 's' : ''}</li>
                        )}
                        {selectedTeam._count.leads > 0 && (
                          <li>{selectedTeam._count.leads} lead{selectedTeam._count.leads !== 1 ? 's' : ''}</li>
                        )}
                      </ul>
                      <p className="text-xs text-primary mt-3" style={{ letterSpacing: '0.01em' }}>
                        All members and leads will be kept in the database but will no longer be associated with this team.
                      </p>
                    </div>
                  )}
                  <p className="text-sm text-neutral-600" style={{ letterSpacing: '0.01em' }}>
                    This action cannot be undone.
                  </p>
                </div>
                <div className="flex justify-center space-x-3 pt-4">
                  <button
                    onClick={() => {
                      setShowDeleteModal(false);
                      setSelectedTeam(null);
                    }}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDeleteTeam}
                    disabled={actionLoading === 'delete'}
                    className="px-6 py-3 text-sm font-medium text-white rounded-2xl shadow-gentle hover:shadow-hover smooth-transition hover-lift bg-gradient-to-br from-red-400 to-red-500 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:transform-none"
                    style={{ letterSpacing: '0.01em' }}
                  >
                    {actionLoading === 'delete' ? 'Deleting...' : 'Delete Team'}
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

export default TeamManagement;















