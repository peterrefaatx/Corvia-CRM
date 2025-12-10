import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout/Layout';
import api from '../services/api';

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

const AccountManagerDashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [teams, setTeams] = useState<TeamStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [loginTime, setLoginTime] = useState<string>('');
  const [latenessMinutes, setLatenessMinutes] = useState<number>(0);

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

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-600"></div>
        </div>
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
            <div className="bg-white rounded-lg p-6 h-full flex flex-col justify-center border border-gray-200 border-l-4" style={{ borderLeftColor: '#f5f5f4' }}>
              <div className="space-y-4">
                <div className="text-center">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                    Login Time
                  </p>
                  <p className="text-2xl font-bold text-slate-800">
                    {loginTime || '--:--'}
                  </p>
                </div>

                <div className="border-t border-gray-200"></div>

                <div className="text-center">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                    Lateness
                  </p>
                  <p className={`text-2xl font-bold ${
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
            <div className="bg-white rounded-2xl p-8 h-full border border-gray-300/50 border-l-4 shadow-sm flex items-center justify-center" style={{ borderLeftColor: '#f5f5f4' }}>
              <div className="text-center">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Account Manager</p>
                <p className="text-2xl font-black tracking-tight" style={{ color: '#2D3748' }}>{user?.fullName || 'Unknown'}</p>
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
              className="bg-white rounded-2xl p-6 border border-gray-300/50 border-l-4 shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-1"
              style={{ borderLeftColor: '#f5f5f4' }}
            >
              {/* Team Header */}
              <div className="mb-6 pb-4 border-b border-gray-200">
                <h3 className="text-xl font-black text-gray-900 tracking-tight mb-1">{team.teamName}</h3>
                <div className="flex items-center text-sm text-gray-600">
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  {team.teamLeaderName}
                </div>
              </div>

              {/* Total Agents */}
              <div className="mb-4 bg-gradient-to-r from-purple-50 to-purple-100/50 rounded-xl p-4">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-semibold text-purple-700 uppercase tracking-wider">Total Agents</span>
                  <span className="text-2xl font-black text-purple-700">{team.totalAgents}</span>
                </div>
              </div>

              {/* Today's Stats */}
              <div className="mb-5">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Today</p>
                <div className="bg-cyan-50 rounded-xl p-4">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-sm font-medium text-cyan-900">Total Leads</span>
                    <span className="text-2xl font-black text-cyan-600">{team.todayLeads}</span>
                  </div>
                  <div className="flex justify-between items-center pt-3 border-t border-cyan-200">
                    <span className="text-sm font-medium text-cyan-900">Daily Target</span>
                    <span className="text-2xl font-black text-cyan-600">{team.dailyTarget}</span>
                  </div>
                  {team.dailyTarget > 0 && (
                    <div className="mt-3">
                      <div className="flex justify-between text-xs text-cyan-700 mb-1">
                        <span>Progress</span>
                        <span>{Math.round((team.todayLeads / team.dailyTarget) * 100)}%</span>
                      </div>
                      <div className="w-full bg-cyan-200 rounded-full h-2">
                        <div 
                          className="bg-cyan-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${Math.min((team.todayLeads / team.dailyTarget) * 100, 100)}%` }}
                        ></div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* View Reports Button */}
              <button
                onClick={() => navigate('/account-manager-reports')}
                className="w-full bg-gradient-to-r from-purple-600 to-purple-700 text-white py-3 rounded-xl hover:from-purple-700 hover:to-purple-800 transition-all duration-200 font-semibold shadow-sm hover:shadow-md"
              >
                View Reports
              </button>
            </div>
          ))}
        </div>

        {teams.length === 0 && !loading && (
          <div className="text-center py-12">
            <p className="text-gray-500">No teams assigned yet.</p>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default AccountManagerDashboard;
