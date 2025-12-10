import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout/Layout';
import api from '../services/api';
import { usePageTitle } from '../hooks/usePageTitle';
import { X, Calendar, CalendarDays } from 'lucide-react';

interface TeamStats {
  teamId: string;
  teamName: string;
  teamLeaderName: string;
  totalAgents: number;
  todayLeads: number;
  dailyTarget: number;
  monthLeads: number;
  qualified: number;
  pending: number;
  disqualified: number;
}

interface TeamDetails {
  qualityMetrics: {
    today: {
      totalLeads: number;
      qualifiedLeads: number;
      disqualifiedLeads: number;
      callbackLeads: number;
      pendingLeads: number;
      duplicateLeads: number;
      qualityRate: number;
    };
    month: {
      totalLeads: number;
      qualifiedLeads: number;
      disqualifiedLeads: number;
      callbackLeads: number;
      pendingLeads: number;
      duplicateLeads: number;
      qualityRate: number;
    };
    dailyTarget: number;
    activeCampaigns: number;
    activeAgents: number;
  };
  completionMetrics: {
    dailyCompletion: number;
    monthlyCompletion: number;
  };
  campaignProgress: Array<{
    campaignId: string;
    campaignName: string;
    timezone: string;
    target: number;
    pending: number;
    callback: number;
    achieved: number;
    duplicate: number;
    disqualified: number;
    missed: number;
    total: number;
    targetReached: boolean;
  }>;
}

interface TeamMember {
  agentId: string;
  agentName: string;
  role: string;
  todayLeads: number;
  monthLeads: number;
  qualified: number;
}

interface TeamMembersData {
  team: {
    id: string;
    name: string;
    teamLeaderName: string;
    agents: TeamMember[];
  };
}

const AccountManagerDashboard: React.FC = () => {
  usePageTitle('ACM Dashboard');
  const { user } = useAuth();
  const navigate = useNavigate();
  const [teams, setTeams] = useState<TeamStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [loginTime, setLoginTime] = useState<string>('');
  const [latenessMinutes, setLatenessMinutes] = useState<number>(0);
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  const [teamDetails, setTeamDetails] = useState<TeamDetails | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [metricsPeriod, setMetricsPeriod] = useState<'today' | 'month'>('today');
  const [selectedTeamMembers, setSelectedTeamMembers] = useState<string | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMembersData | null>(null);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [selectedTeamCampaigns, setSelectedTeamCampaigns] = useState<string | null>(null);
  const [teamCampaigns, setTeamCampaigns] = useState<TeamDetails | null>(null);
  const [loadingCampaigns, setLoadingCampaigns] = useState(false);

  useEffect(() => {
    if (user?.role !== 'AccountManager') {
      navigate('/');
    }
  }, [user, navigate]);

  useEffect(() => {
    loadTeamsData();
  }, []);

  const loadTeamsData = async () => {
    try {
      setLoading(true);
      setError('');
      
      const response = await api.get('/account-manager/teams');
      setTeams(response.data.teams);

      // Fetch login tracking data
      try {
        const loginResponse = await api.get('/auth/login-tracking');
        if (loginResponse.data.loginTime) {
          setLoginTime(loginResponse.data.loginTime);
          setLatenessMinutes(loginResponse.data.latenessMinutes || 0);
        }
      } catch (err) {
        console.error('Failed to load login tracking:', err);
      }
    } catch (error: any) {
      console.error('Failed to load teams data:', error);
      setError(`Failed to load teams: ${error.response?.data?.error || error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const loadTeamDetails = async (teamId: string) => {
    try {
      setLoadingDetails(true);
      setSelectedTeam(teamId);
      
      // Fetch team details from ACM endpoint
      const response = await api.get(`/account-manager/team/${teamId}/details`);
      
      setTeamDetails(response.data);
    } catch (error: any) {
      console.error('Failed to load team details:', error);
      setError(`Failed to load team details: ${error.response?.data?.error || error.message}`);
    } finally {
      setLoadingDetails(false);
    }
  };

  const closeModal = () => {
    setSelectedTeam(null);
    setTeamDetails(null);
    setMetricsPeriod('today');
  };

  const loadTeamMembers = async (teamId: string) => {
    try {
      setLoadingMembers(true);
      setSelectedTeamMembers(teamId);
      
      const response = await api.get(`/account-manager/team/${teamId}`);
      setTeamMembers(response.data);
    } catch (error: any) {
      console.error('Failed to load team members:', error);
      setError(`Failed to load team members: ${error.response?.data?.error || error.message}`);
    } finally {
      setLoadingMembers(false);
    }
  };

  const closeMembersModal = () => {
    setSelectedTeamMembers(null);
    setTeamMembers(null);
  };

  const loadTeamCampaigns = async (teamId: string) => {
    try {
      setLoadingCampaigns(true);
      setSelectedTeamCampaigns(teamId);
      
      const response = await api.get(`/account-manager/team/${teamId}/details`);
      setTeamCampaigns(response.data);
    } catch (error: any) {
      console.error('Failed to load team campaigns:', error);
      setError(`Failed to load team campaigns: ${error.response?.data?.error || error.message}`);
    } finally {
      setLoadingCampaigns(false);
    }
  };

  const closeCampaignsModal = () => {
    setSelectedTeamCampaigns(null);
    setTeamCampaigns(null);
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
      <div className="py-6 px-4 sm:px-6 lg:px-8" style={{ backgroundColor: '#F5F5F5' }}>
        {/* Account Manager Information and Attendance Cards */}
        <div className="mb-8 grid grid-cols-1 lg:grid-cols-6 gap-6 items-stretch">
          {/* Login Tracking Card */}
          <div className="lg:col-span-1">
            <div className="p-6 h-full flex flex-col justify-center" style={{ backgroundColor: '#F4F6FA', border: '1px solid #E5E7EB', borderLeft: '4px solid #D1D5DB', borderRadius: '0' }}>
              <div className="space-y-4">
                <div className="text-center">
                  <p className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-3">
                    Login Time
                  </p>
                  <p className="text-2xl font-extrabold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">
                    {loginTime || '--:--'}
                  </p>
                </div>

                <div className="border-t border-gray-200"></div>

                <div className="text-center">
                  <p className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-3">
                    Lateness
                  </p>
                  <p className={`text-2xl font-extrabold ${
                    latenessMinutes > 0 ? 'text-red-600' : 'text-emerald-600'
                  }`}>
                    {latenessMinutes > 0 ? (() => {
                      const hours = Math.floor(latenessMinutes / 60);
                      const mins = latenessMinutes % 60;
                      return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
                    })() : '✓'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Account Manager Information Card */}
          <div className="lg:col-span-5">
            <div className="p-8 h-full flex items-center justify-center" style={{ backgroundColor: '#F4F6FA', border: '1px solid #E5E7EB', borderLeft: '4px solid #D1D5DB', borderRadius: '0' }}>
              <div className="text-center">
                <p className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-4">Account Manager</p>
                <p className="text-2xl font-extrabold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">{user?.fullName || 'Unknown'}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-red-800">{error}</p>
              </div>
              <div className="ml-auto">
                <button 
                  onClick={loadTeamsData}
                  className="text-sm bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700"
                >
                  Retry
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Teams Overview */}
        <div className={`grid gap-6 ${
          teams.length === 1 ? 'grid-cols-1' : 
          teams.length === 2 ? 'grid-cols-1 md:grid-cols-2' : 
          'grid-cols-1 md:grid-cols-2 xl:grid-cols-3'
        }`}>
          {teams.map((team) => (
            <div 
              key={team.teamId} 
              className="p-6 bg-white"
              style={{ border: '1px solid #E5E7EB', borderLeft: '4px solid #0891B2', borderRadius: '0' }}
            >
              {/* Team Header */}
              <div className="mb-6 pb-4 border-b border-gray-300">
                <h3 className="text-xl font-black text-slate-800 tracking-tight mb-2">{team.teamName}</h3>
                <div className="flex items-center text-sm text-gray-600">
                  <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <span className="font-medium">{team.teamLeaderName}</span>
                </div>
              </div>

              {/* Total Agents */}
              <div className="mb-5 p-4 bg-white border border-gray-200">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Total Agents</span>
                  <span className="text-3xl font-black text-slate-800">{team.totalAgents}</span>
                </div>
              </div>

              {/* Today's Stats */}
              <div className="mb-5">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Today's Performance</p>
                <div className="bg-white border border-gray-200 p-4 space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-semibold text-gray-700">Total Leads</span>
                    <span className="text-2xl font-black text-slate-800">{team.todayLeads}</span>
                  </div>
                  <div className="border-t border-gray-200"></div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-semibold text-gray-700">Daily Target</span>
                    <span className="text-2xl font-black text-slate-800">{team.dailyTarget}</span>
                  </div>
                  {team.dailyTarget > 0 && (
                    <>
                      <div className="border-t border-gray-200"></div>
                      <div>
                        <div className="flex justify-between text-xs font-semibold text-gray-600 mb-2">
                          <span>Progress</span>
                          <span>{Math.round((team.todayLeads / team.dailyTarget) * 100)}%</span>
                        </div>
                        <div className="w-full bg-gray-200 h-2.5">
                          <div 
                            className="bg-primary h-2.5 transition-all duration-300"
                            style={{ width: `${Math.min((team.todayLeads / team.dailyTarget) * 100, 100)}%` }}
                          ></div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => loadTeamMembers(team.teamId)}
                  className="bg-purple-600 text-white py-2.5 hover:bg-purple-700 transition-colors font-semibold text-sm"
                  style={{ border: '1px solid #9333EA' }}
                >
                  Members
                </button>
                <button
                  onClick={() => loadTeamCampaigns(team.teamId)}
                  className="bg-orange-600 text-white py-2.5 hover:bg-orange-700 transition-colors font-semibold text-sm"
                  style={{ border: '1px solid #EA580C' }}
                >
                  Campaigns
                </button>
                <button
                  onClick={() => loadTeamDetails(team.teamId)}
                  className="bg-primary text-white py-2.5 bg-primary-hover transition-colors font-semibold text-sm"
                  style={{ border: '1px solid #0891B2' }}
                >
                  Details
                </button>
              </div>
            </div>
          ))}
        </div>

        {teams.length === 0 && !loading && (
          <div className="text-center py-12">
            <p className="text-gray-500">No teams assigned yet.</p>
          </div>
        )}

        {/* Team Campaigns Modal */}
        {selectedTeamCampaigns && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              {/* Modal Header */}
              <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-900">
                  {teams.find(t => t.teamId === selectedTeamCampaigns)?.teamName} - Campaigns
                </h2>
                <button
                  onClick={closeCampaignsModal}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Modal Content */}
              <div className="p-6">
                {loadingCampaigns ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                  </div>
                ) : teamCampaigns ? (
                  <>
                    {/* Summary Card */}
                    <div className="mb-6 p-4 bg-gradient-to-r from-orange-50 to-red-50 rounded-lg border border-orange-200">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="text-center">
                          <p className="text-sm text-gray-600 font-medium mb-1">Total Campaigns</p>
                          <p className="text-3xl font-bold text-orange-600">
                            {teamCampaigns.campaignProgress.length}
                          </p>
                        </div>
                        <div className="text-center">
                          <p className="text-sm text-gray-600 font-medium mb-1">Total Daily Target</p>
                          <p className="text-3xl font-bold text-red-600">
                            {teamCampaigns.campaignProgress.reduce((sum, c) => sum + c.target, 0)}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Campaigns List */}
                    <div className="space-y-3">
                      <h3 className="text-lg font-bold text-gray-900 mb-4">
                        Campaign Details
                      </h3>
                      
                      {teamCampaigns.campaignProgress.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                          No campaigns assigned to this team
                        </div>
                      ) : (
                        <div className="grid gap-4">
                          {teamCampaigns.campaignProgress.map((campaign) => (
                            <div
                              key={campaign.campaignId}
                              className={`p-5 rounded-lg border-2 transition-all ${
                                campaign.targetReached 
                                  ? 'bg-green-50 border-green-300 shadow-sm' 
                                  : 'bg-white border-gray-200 hover:shadow-md'
                              }`}
                            >
                              <div className="flex items-start justify-between mb-3">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-2">
                                    <h4 className="font-bold text-lg text-gray-900">
                                      {campaign.campaignName}
                                    </h4>
                                    {campaign.targetReached && (
                                      <span className="px-2 py-1 bg-green-500 text-white text-xs font-bold rounded-full">
                                        ✓ TARGET REACHED
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-sm text-gray-600">
                                    <span className="font-medium">Timezone:</span> {campaign.timezone}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <p className="text-sm text-gray-600 mb-1">Daily Target</p>
                                  <p className="text-3xl font-black text-orange-600">
                                    {campaign.target}
                                  </p>
                                </div>
                              </div>

                              {/* Campaign Stats */}
                              <div className="grid grid-cols-4 gap-3 mt-4 pt-4 border-t border-gray-200">
                                <div className="text-center">
                                  <p className="text-xs text-gray-500 mb-1">Achieved</p>
                                  <p className="text-xl font-bold text-green-600">{campaign.achieved}</p>
                                </div>
                                <div className="text-center">
                                  <p className="text-xs text-gray-500 mb-1">Pending</p>
                                  <p className="text-xl font-bold text-yellow-600">{campaign.pending}</p>
                                </div>
                                <div className="text-center">
                                  <p className="text-xs text-gray-500 mb-1">Callback</p>
                                  <p className="text-xl font-bold text-gray-900">{campaign.callback}</p>
                                </div>
                                <div className="text-center">
                                  <p className="text-xs text-gray-500 mb-1">Total</p>
                                  <p className="text-xl font-bold text-primary">{campaign.total}</p>
                                </div>
                              </div>

                              {/* Progress Bar */}
                              {campaign.target > 0 && (
                                <div className="mt-4">
                                  <div className="flex justify-between text-xs text-gray-600 mb-1">
                                    <span>Progress</span>
                                    <span>{Math.round((campaign.achieved / campaign.target) * 100)}%</span>
                                  </div>
                                  <div className="w-full bg-gray-200 rounded-full h-3">
                                    <div 
                                      className={`h-3 rounded-full transition-all ${
                                        campaign.targetReached ? 'bg-green-500' : 'bg-orange-500'
                                      }`}
                                      style={{ width: `${Math.min((campaign.achieved / campaign.target) * 100, 100)}%` }}
                                    ></div>
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                ) : null}
              </div>
            </div>
          </div>
        )}

        {/* Team Members Modal */}
        {selectedTeamMembers && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
              {/* Modal Header */}
              <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-900">
                  {teams.find(t => t.teamId === selectedTeamMembers)?.teamName} - Members
                </h2>
                <button
                  onClick={closeMembersModal}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Modal Content */}
              <div className="p-6">
                {loadingMembers ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                  </div>
                ) : teamMembers ? (
                  <>
                    {/* Team Leader Info */}
                    <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-blue-50 rounded-lg border border-blue-200">
                      <div className="flex items-center">
                        <svg className="w-6 h-6 mr-3 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div>
                          <p className="text-sm text-gray-600 font-medium">Team Leader</p>
                          <p className="text-lg font-bold text-gray-900">{teamMembers.team.teamLeaderName}</p>
                        </div>
                      </div>
                    </div>

                    {/* Team Members List */}
                    <div className="space-y-3">
                      <h3 className="text-lg font-bold text-gray-900 mb-4">
                        Team Members ({teamMembers.team.agents.length})
                      </h3>
                      
                      {teamMembers.team.agents.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                          No team members found
                        </div>
                      ) : (
                        <div className="grid gap-3">
                          {teamMembers.team.agents.map((member) => (
                            <div
                              key={member.agentId}
                              className="p-4 bg-white border border-gray-200 rounded-lg hover:shadow-md transition-shadow"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-3">
                                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-500 rounded-full flex items-center justify-center text-white font-bold">
                                    {member.agentName.charAt(0).toUpperCase()}
                                  </div>
                                  <div>
                                    <p className="font-semibold text-gray-900">{member.agentName}</p>
                                    <p className="text-sm text-gray-500">
                                      {member.role === 'SeniorAgent' ? 'Senior Agent' : 'Agent'}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex space-x-6 text-center">
                                  <div>
                                    <p className="text-xs text-gray-500 mb-1">Today</p>
                                    <p className="text-lg font-bold text-primary">{member.todayLeads}</p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-gray-500 mb-1">Month</p>
                                    <p className="text-lg font-bold text-primary">{member.monthLeads}</p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-gray-500 mb-1">Qualified</p>
                                    <p className="text-lg font-bold text-green-600">{member.qualified}</p>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                ) : null}
              </div>
            </div>
          </div>
        )}

        {/* Team Details Modal */}
        {selectedTeam && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg max-w-7xl w-full max-h-[90vh] overflow-y-auto">
              {/* Modal Header */}
              <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-900">
                  {teams.find(t => t.teamId === selectedTeam)?.teamName} - Details
                </h2>
                <button
                  onClick={closeModal}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Modal Content */}
              <div className="p-6">
                {loadingDetails ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                  </div>
                ) : teamDetails ? (
                  <>
                    {/* Quality Metrics Section */}
                    <div className="bg-white rounded-lg shadow p-6 mb-6 relative">
                      {/* Period Toggle Icon */}
                      <button
                        onClick={() => setMetricsPeriod(metricsPeriod === 'today' ? 'month' : 'today')}
                        className="absolute top-4 right-4 p-2 rounded-lg hover:bg-gray-100 transition-colors group z-10"
                        title={metricsPeriod === 'today' ? 'Switch to Month View' : 'Switch to Today View'}
                      >
                        {metricsPeriod === 'today' ? (
                          <Calendar className="w-6 h-6 text-primary" />
                        ) : (
                          <CalendarDays className="w-6 h-6 text-primary" />
                        )}
                      </button>

                      {/* Metrics Display */}
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 pt-8">
                        <div className="text-center p-4 bg-primary-light rounded-lg">
                          <p className="text-sm text-gray-600 mb-1">Quality Rate</p>
                          <p className="text-3xl font-bold text-primary">
                            {metricsPeriod === 'today' ? teamDetails.qualityMetrics.today.qualityRate : teamDetails.qualityMetrics.month.qualityRate}%
                          </p>
                        </div>
                        <div className="text-center p-4 bg-green-50 rounded-lg">
                          <p className="text-sm text-gray-600 mb-1">Qualified</p>
                          <p className="text-3xl font-bold text-green-600">
                            {metricsPeriod === 'today' ? teamDetails.qualityMetrics.today.qualifiedLeads : teamDetails.qualityMetrics.month.qualifiedLeads}
                          </p>
                        </div>
                        <div className="text-center p-4 bg-red-50 rounded-lg">
                          <p className="text-sm text-gray-600 mb-1">Disqualified</p>
                          <p className="text-3xl font-bold text-red-600">
                            {metricsPeriod === 'today' ? teamDetails.qualityMetrics.today.disqualifiedLeads : teamDetails.qualityMetrics.month.disqualifiedLeads}
                          </p>
                        </div>
                        <div className="text-center p-4 bg-gray-50 rounded-lg">
                          <p className="text-sm text-gray-600 mb-1">Callback</p>
                          <p className="text-3xl font-bold text-gray-900">
                            {metricsPeriod === 'today' ? teamDetails.qualityMetrics.today.callbackLeads : teamDetails.qualityMetrics.month.callbackLeads}
                          </p>
                        </div>
                        <div className="text-center p-4 bg-yellow-50 rounded-lg">
                          <p className="text-sm text-gray-600 mb-1">Pending</p>
                          <p className="text-3xl font-bold text-yellow-600">
                            {metricsPeriod === 'today' ? teamDetails.qualityMetrics.today.pendingLeads : teamDetails.qualityMetrics.month.pendingLeads}
                          </p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-4">
                        <div className="text-center p-4 bg-primary-light rounded-lg">
                          <p className="text-sm text-gray-600 mb-1">Duplicate</p>
                          <p className="text-3xl font-bold text-primary">
                            {metricsPeriod === 'today' ? teamDetails.qualityMetrics.today.duplicateLeads : teamDetails.qualityMetrics.month.duplicateLeads}
                          </p>
                        </div>
                        <div className="text-center p-4 bg-orange-50 rounded-lg">
                          <p className="text-sm text-gray-600 mb-1">Total Leads</p>
                          <p className="text-3xl font-bold text-orange-600">
                            {metricsPeriod === 'today' ? teamDetails.qualityMetrics.today.totalLeads : teamDetails.qualityMetrics.month.totalLeads}
                          </p>
                        </div>
                        <div className="text-center p-4 bg-pink-50 rounded-lg">
                          <p className="text-sm text-gray-600 mb-1">Daily Target</p>
                          <p className="text-3xl font-bold text-pink-600">{teamDetails.qualityMetrics.dailyTarget}</p>
                        </div>
                        <div className="text-center p-4 bg-primary-light rounded-lg">
                          <p className="text-sm text-gray-600 mb-1">Active Campaigns</p>
                          <p className="text-3xl font-bold text-primary">{teamDetails.qualityMetrics.activeCampaigns}</p>
                        </div>
                        <div className="text-center p-4 bg-primary-light rounded-lg">
                          <p className="text-sm text-gray-600 mb-1">Active Agents</p>
                          <p className="text-3xl font-bold text-primary">{teamDetails.qualityMetrics.activeAgents}</p>
                        </div>
                      </div>
                    </div>

                    {/* Completion Percentage Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                      {/* Daily Completion */}
                      <div className="bg-white rounded-lg shadow p-6">
                        <div className="text-center mb-4">
                          <p className="text-sm text-gray-600 mb-2">Daily Completion</p>
                          <p className="text-5xl font-bold text-primary">
                            {teamDetails.completionMetrics.dailyCompletion}%
                          </p>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-4">
                          <div
                            className={`h-4 rounded-full transition-all ${
                              teamDetails.completionMetrics.dailyCompletion >= 100 ? 'bg-green-500' :
                              teamDetails.completionMetrics.dailyCompletion >= 75 ? 'bg-yellow-500' :
                              'bg-red-500'
                            }`}
                            style={{ width: `${Math.min(teamDetails.completionMetrics.dailyCompletion, 100)}%` }}
                          />
                        </div>
                      </div>

                      {/* Monthly Completion */}
                      <div className="bg-white rounded-lg shadow p-6">
                        <div className="text-center mb-4">
                          <p className="text-sm text-gray-600 mb-2">Monthly Completion</p>
                          <p className="text-5xl font-bold text-primary">
                            {teamDetails.completionMetrics.monthlyCompletion}%
                          </p>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-4">
                          <div
                            className={`h-4 rounded-full transition-all ${
                              teamDetails.completionMetrics.monthlyCompletion >= 100 ? 'bg-green-500' :
                              teamDetails.completionMetrics.monthlyCompletion >= 75 ? 'bg-yellow-500' :
                              'bg-red-500'
                            }`}
                            style={{ width: `${Math.min(teamDetails.completionMetrics.monthlyCompletion, 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Campaign Progress Table */}
                    <div className="bg-white rounded-lg shadow overflow-hidden">
                      <div className="px-6 py-4 bg-gradient-to-r from-blue-50 to-blue-50 border-b border-gray-200">
                        <h3 className="text-lg font-bold text-gray-900">
                          Campaign Progress - Today's Report
                        </h3>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="min-w-full">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Campaign</th>
                              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Timezone</th>
                              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Target</th>
                              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Pending</th>
                              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Callback</th>
                              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Achieved</th>
                              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Duplicate</th>
                              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Disqualified</th>
                              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Missed</th>
                              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Total</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200">
                            {teamDetails.campaignProgress.map((campaign) => (
                              <tr 
                                key={campaign.campaignId}
                                className={`${campaign.targetReached ? 'bg-green-50' : 'bg-white'} hover:bg-gray-50 transition`}
                              >
                                <td className="px-4 py-4 whitespace-nowrap font-medium">{campaign.campaignName}</td>
                                <td className="px-4 py-4 whitespace-nowrap text-center text-sm text-gray-600">{campaign.timezone}</td>
                                <td className="px-4 py-4 whitespace-nowrap text-center font-semibold">{campaign.target}</td>
                                <td className="px-4 py-4 whitespace-nowrap text-center font-semibold text-yellow-600">
                                  {campaign.pending}
                                </td>
                                <td className="px-4 py-4 whitespace-nowrap text-center font-semibold text-gray-900">
                                  {campaign.callback}
                                </td>
                                <td className="px-4 py-4 whitespace-nowrap text-center font-semibold text-green-600">
                                  {campaign.achieved}
                                </td>
                                <td className="px-4 py-4 whitespace-nowrap text-center font-semibold text-primary">
                                  {campaign.duplicate}
                                </td>
                                <td className="px-4 py-4 whitespace-nowrap text-center font-semibold text-red-600">
                                  {campaign.disqualified}
                                </td>
                                <td className="px-4 py-4 whitespace-nowrap text-center font-semibold text-gray-600">{campaign.missed}</td>
                                <td className="px-4 py-4 whitespace-nowrap text-center font-bold">{campaign.total}</td>
                              </tr>
                            ))}
                            {teamDetails.campaignProgress.length === 0 && (
                              <tr>
                                <td colSpan={10} className="px-4 py-8 text-center text-gray-500">
                                  No active campaigns
                                </td>
                              </tr>
                            )}
                            {teamDetails.campaignProgress.length > 0 && (
                              <tr className="border-t-2 border-yellow-300">
                                <td className="py-2 bg-white"></td>
                                <td className="py-2 pl-2 whitespace-nowrap text-sm bg-yellow-100">TOTAL</td>
                                <td className="px-4 py-2 whitespace-nowrap text-center text-sm bg-yellow-100">
                                  {teamDetails.campaignProgress.reduce((sum, c) => sum + c.target, 0)}
                                </td>
                                <td className="px-4 py-2 whitespace-nowrap text-center text-sm text-yellow-700 bg-yellow-100">
                                  {teamDetails.campaignProgress.reduce((sum, c) => sum + c.pending, 0)}
                                </td>
                                <td className="px-4 py-2 whitespace-nowrap text-center text-sm text-gray-900 bg-yellow-100">
                                  {teamDetails.campaignProgress.reduce((sum, c) => sum + c.callback, 0)}
                                </td>
                                <td className="px-4 py-2 whitespace-nowrap text-center text-sm text-green-700 bg-yellow-100">
                                  {teamDetails.campaignProgress.reduce((sum, c) => sum + c.achieved, 0)}
                                </td>
                                <td className="px-4 py-2 whitespace-nowrap text-center text-sm text-blue-700 bg-yellow-100">
                                  {teamDetails.campaignProgress.reduce((sum, c) => sum + c.duplicate, 0)}
                                </td>
                                <td className="px-4 py-2 whitespace-nowrap text-center text-sm text-red-700 bg-yellow-100">
                                  {teamDetails.campaignProgress.reduce((sum, c) => sum + c.disqualified, 0)}
                                </td>
                                <td className="px-4 py-2 whitespace-nowrap text-center text-sm text-gray-700 bg-yellow-100">
                                  {teamDetails.campaignProgress.reduce((sum, c) => sum + c.missed, 0)}
                                </td>
                                <td className="px-4 py-2 whitespace-nowrap text-center text-sm bg-yellow-100">
                                  {teamDetails.campaignProgress.reduce((sum, c) => sum + c.total, 0)}
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </>
                ) : null}
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default AccountManagerDashboard;





