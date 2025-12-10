import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout/Layout';
import api from '../services/api';

interface Stats {
  total: number;
  qualified: number;
  disqualified: number;
  duplicate: number;
  pending: number;
  callback: number;
}

interface TeamLeader {
  id: string;
  fullName: string;
  username: string;
}

interface TeamWithLeader {
  id: string;
  name: string;
  teamLeader: TeamLeader | null;
}

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [todayStats, setTodayStats] = useState<Stats | null>(null);
  const [monthStats, setMonthStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [dashboardSettings, setDashboardSettings] = useState<any>(null);
  const [loginTime, setLoginTime] = useState<string>('');
  const [latenessMinutes, setLatenessMinutes] = useState<number>(0);

  // Redirect Managers to Admin Dashboard, Clients to Client Dashboard, and QC to QC Analytics
  useEffect(() => {
    if (user?.role === 'Manager') {
      navigate('/admin');
    } else if (user?.role === 'Client') {
      navigate('/client');
    } else if (user?.role === 'QualityControl') {
      navigate('/qc-analytics');
    } else if (user?.role === 'TeamLeader') {
      navigate('/team-leader-dashboard');
    }
  }, [user, navigate]);

  useEffect(() => {
    loadDashboardData();
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const response = await api.get('/settings');
      console.log('Dashboard settings loaded:', response.data.dashboard);
      setDashboardSettings(response.data.dashboard);
    } catch (error) {
      console.error('Failed to load settings:', error);
      // Use defaults if settings fail to load
      const defaults = {
        todayPerformance: {
          showTotal: true,
          showQualified: true,
          showDisqualified: true,
          showPending: true,
          showCallback: true,
          showDuplicate: true
        },
        monthlyOverview: {
          showTotal: true,
          showQualified: true,
          showDisqualified: true,
          showDuplicate: true,
          showPending: false,
          showCallback: false
        }
      };
      console.log('Using default settings:', defaults);
      setDashboardSettings(defaults);
    }
  };

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError('');
      
      console.log('Loading dashboard data for user:', user?.id);
      
      const statsResponse = await api.get('/dashboard/stats');
      
      console.log('Dashboard stats loaded:', statsResponse.data);
      
      // Backend now returns { today: {...}, month: {...} }
      setTodayStats(statsResponse.data.today);
      setMonthStats(statsResponse.data.month);
      
      // Fetch login tracking data
      if (user && user.role !== 'Manager' && user.role !== 'Client') {
        try {
          console.log('Fetching login tracking data for role:', user.role);
          const userResponse = await api.get('/auth/me');
          console.log('User response:', userResponse.data);
          console.log('Today login time:', userResponse.data.todayLoginTime);
          console.log('Lateness minutes:', userResponse.data.todayLatenessMinutes);
          
          if (userResponse.data.todayLoginTime) {
            const loginDate = new Date(userResponse.data.todayLoginTime);
            const formattedTime = loginDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
            console.log('Formatted login time:', formattedTime);
            setLoginTime(formattedTime);
          } else {
            console.log('No login time found');
            setLoginTime('');
          }
          setLatenessMinutes(userResponse.data.todayLatenessMinutes || 0);
        } catch (err) {
          console.error('Failed to load login tracking:', err);
        }
      }
      
      // Hardcoded target levels
      setDashboardSettings({
        dashboard: {
          targetLevels: {
            level1: 40,
            level2: 60,
            level3: 80,
            level4: 100
          }
        }
      });

    } catch (error: any) {
      console.error('Failed to load dashboard data:', error);
      setError(`Failed to load dashboard: ${error.response?.data?.error || error.message}`);
      
      // Set empty stats
      const emptyStats = {
        total: 0,
        qualified: 0,
        disqualified: 0,
        duplicate: 0,
        pending: 0,
        callback: 0
      };
      
      setTodayStats(emptyStats);
      setMonthStats(emptyStats);
    } finally {
      setLoading(false);
    }
  };

  const StatCard: React.FC<{ title: string; value: number; color: string; description?: string }> = ({ 
    title, value, color, description
  }) => {
    // Map border colors to background colors
    const getBackgroundClass = (borderColor: string) => {
      const colorMap: { [key: string]: string } = {
        '#06b6d4': 'bg-white',      // cyan - Total
        '#f59e0b': 'bg-yellow-50',  // orange - Pending
        '#10b981': 'bg-green-50',   // green - Qualified
        '#ef4444': 'bg-red-50',     // red - Disqualified
        '#3b82f6': 'bg-blue-50',    // blue - Duplicate
        '#000000': 'bg-gray-50'     // black - Callback
      };
      return colorMap[borderColor] || 'bg-gray-50';
    };

    return (
      <div className={`${getBackgroundClass(color)} shadow hover:shadow-md transition-all duration-200 p-6 rounded-lg border-l-4`} style={{ borderLeftColor: color }}>
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">{title}</p>
        <p className="text-4xl font-bold mb-1" style={{ color: '#2D3748' }}>{value}</p>
        {description && (
          <p className="text-xs text-gray-500">{description}</p>
        )}
      </div>
    );
  };

  // Helper function to get team leader name
  const getTeamLeaderName = (): string => {
    if (!user?.team) {
      return 'No Team Assigned';
    }

    const teamWithLeader = user.team as TeamWithLeader;
    
    if (teamWithLeader.teamLeader) {
      return teamWithLeader.teamLeader.fullName;
    }
    
    return 'Not Assigned';
  };

  if (loading || !dashboardSettings) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-600"></div>
        </div>
      </Layout>
    );
  }

  console.log('Rendering dashboard with settings:', dashboardSettings);

  return (
    <Layout>
      <div className="py-6 px-4 sm:px-6 lg:px-8">
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
                  onClick={loadDashboardData}
                  className="text-sm bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700"
                >
                  Retry
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Agent Information and Attendance Cards */}
        <div className="mb-8 grid grid-cols-1 lg:grid-cols-6 gap-6 items-stretch">
          {/* Login Tracking Card - Only for non-Manager and non-Client roles */}
          {user && user.role !== 'Manager' && user.role !== 'Client' && (
            <div className="lg:col-span-1">
              <div className="bg-white rounded-2xl p-6 h-full flex flex-col justify-center border border-gray-300/50 border-l-4 border-l-cyan-500 shadow-sm">
                <div className="space-y-6">
                  {/* Login Time */}
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Login Time</p>
                    <p className="text-3xl font-black tracking-tight" style={{ color: '#2D3748' }}>
                      {loginTime || '--:--'}
                    </p>
                  </div>

                  <div className="h-px bg-gradient-to-r from-transparent via-gray-300 to-transparent"></div>

                  {/* Lateness */}
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Lateness</p>
                    <p className={`text-3xl font-black tracking-tight ${
                      latenessMinutes > 0 ? 'text-red-500' : 'text-emerald-500'
                    }`}>
                      {latenessMinutes > 0 ? (() => {
                        const hours = Math.floor(latenessMinutes / 60);
                        const mins = latenessMinutes % 60;
                        return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
                      })() : '-'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Agent Information Card */}
          <div className={user && user.role !== 'Manager' && user.role !== 'Client' ? 'lg:col-span-5' : 'lg:col-span-6'}>
            <div className="bg-white rounded-2xl p-8 h-full border border-gray-300/50 border-l-4 border-l-cyan-500 shadow-sm">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 h-full items-center">
                <div className="text-center">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Agent</p>
                  <p className="text-2xl font-black tracking-tight" style={{ color: '#2D3748' }}>{user?.fullName || 'Unknown'}</p>
                </div>
                
                <div className="text-center">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Team</p>
                  <p className="text-2xl font-black text-cyan-600 tracking-tight">{user?.team?.name || 'Not Assigned'}</p>
                </div>
                
                <div className="text-center">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Team Leader</p>
                  <p className="text-2xl font-black tracking-tight" style={{ color: '#2D3748' }}>{getTeamLeaderName()}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Today's Leads */}
        <div className="mb-8">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <StatCard 
              title="Total" 
              value={todayStats?.total || 0} 
              color="#06b6d4"
              description="Submitted today"
            />
            <StatCard 
              title="Pending" 
              value={todayStats?.pending || 0} 
              color="#f59e0b"
            />
            <StatCard 
              title="Qualified" 
              value={todayStats?.qualified || 0} 
              color="#10b981"
            />
            <StatCard 
              title="Disqualified" 
              value={todayStats?.disqualified || 0} 
              color="#ef4444"
            />
            <StatCard 
              title="Duplicate" 
              value={todayStats?.duplicate || 0} 
              color="#3b82f6"
            />
            <StatCard 
              title="Callback" 
              value={todayStats?.callback || 0} 
              color="#000000"
            />
          </div>
        </div>

        {/* Monthly Overview */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4" style={{ color: '#2D3748' }}>Total Leads</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard 
              title="Total" 
              value={monthStats?.total || 0} 
              color="#06b6d4"
              description="This month"
            />
            <StatCard 
              title="Qualified" 
              value={monthStats?.qualified || 0} 
              color="#10b981"
            />
            <StatCard 
              title="Disqualified" 
              value={monthStats?.disqualified || 0} 
              color="#ef4444"
            />
            <StatCard 
              title="Duplicate" 
              value={monthStats?.duplicate || 0} 
              color="#3b82f6"
            />
          </div>
        </div>

        {/* Monthly Target Progress Bar */}
        {monthStats && (
          <div>
            <div className="bg-gradient-to-br from-white to-gray-50 shadow-lg hover:shadow-xl transition-all duration-300 p-6 rounded-lg border border-gray-200">
              <div>
                <div className="mb-5">
                  <h2 className="text-xl font-bold" style={{ color: '#2D3748' }}>Monthly Target</h2>
                  <p className="text-xs text-gray-500 mt-0.5">Progress toward your goal</p>
                </div>

                {/* Progress Bar */}
                <div className="relative">
                  {/* Level markers above bar */}
                  <div className="relative mb-3 h-5">
                    {[
                      { level: 40, position: 33.33 },
                      { level: 60, position: 50 },
                      { level: 80, position: 66.67 },
                      { level: 100, position: 83.33 },
                      { level: 120, position: 100 }
                    ].map(({ level, position }) => (
                      <div 
                        key={level}
                        className="absolute"
                        style={{ left: `${position}%`, transform: 'translateX(-50%)' }}
                      >
                        <div className={`inline-flex items-center justify-center min-w-[28px] h-5 px-1.5 rounded-md text-xs font-bold transition-all duration-300 ${
                          monthStats.qualified >= level 
                            ? 'text-emerald-700 bg-emerald-100 shadow-sm' 
                            : 'text-gray-400 bg-gray-100'
                        }`}>
                          {level}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Track */}
                  <div className="relative h-4 bg-gradient-to-r from-gray-100 to-gray-200 rounded-full overflow-hidden shadow-inner border border-gray-300/50">
                    {/* Progress fill - Solid #b1dd9e when < 40, Solid #3AA346 when >= 40 */}
                    <div 
                      className="h-full transition-all duration-1000 ease-out"
                      style={{ 
                        width: `${Math.min((monthStats.qualified / 120) * 100, 100)}%`,
                        backgroundColor: monthStats.qualified >= 40 ? '#3AA346' : '#b1dd9e'
                      }}
                    >
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </Layout>
  );
};

export default Dashboard;