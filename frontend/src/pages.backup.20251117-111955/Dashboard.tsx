// This is the complete Agent Dashboard with all features
// Copy this content to frontend/src/pages/Dashboard.tsx

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

  // Redirect users to their appropriate dashboards
  useEffect(() => {
    if (user?.role === 'Manager') {
      navigate('/admin');
    } else if (user?.role === 'Client') {
      navigate('/client');
    } else if (user?.role === 'QualityControl') {
      navigate('/qc-analytics');
    } else if (user?.role === 'TeamLeader') {
      navigate('/team-leader-dashboard');
    } else if (user?.role === 'AccountManager') {
      navigate('/account-manager-dashboard');
    } else if (user?.role === 'IT') {
      navigate('/it-dashboard');
    } else if (user?.role === 'SeniorAgent') {
      navigate('/senior-agent-dashboard');
    }
    // Only Agent stays on this dashboard
  }, [user, navigate]);

  useEffect(() => {
    loadDashboardData();
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      // Load role-specific target levels, names, and visibility settings
      const targetResponse = await api.get('/settings/public/target-levels');
      
      console.log('🔍 Dashboard Settings Debug:');
      console.log('Target Response:', targetResponse.data);
      
      const finalSettings = {
        todayPerformance: targetResponse.data.todayPerformance,
        monthlyOverview: targetResponse.data.monthlyOverview,
        targetLevels: targetResponse.data.targetLevels,
        levelNames: targetResponse.data.levelNames
      };
      
      console.log('Final Dashboard Settings:', finalSettings);
      
      setDashboardSettings(finalSettings);
    } catch (error) {
      console.error('Failed to load settings:', error);
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
        },
        targetLevels: {
          level1: 40,
          level2: 60,
          level3: 80,
          level4: 100
        },
        levelNames: {
          level1: 'BRONZE',
          level2: 'SILVER',
          level3: 'GOLD',
          level4: 'PLATINUM'
        }
      };
      setDashboardSettings(defaults);
    }
  };

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError('');
      
      const statsResponse = await api.get('/dashboard/stats');
      
      setTodayStats(statsResponse.data.today);
      setMonthStats(statsResponse.data.month);
      
      // Fetch login tracking data
      if (user && user.role !== 'Manager' && user.role !== 'Client') {
        try {
          const userResponse = await api.get('/auth/me');
          
          if (userResponse.data.todayLoginTime) {
            const loginDate = new Date(userResponse.data.todayLoginTime);
            const formattedTime = loginDate.toLocaleTimeString('en-US', { 
              hour: '2-digit', 
              minute: '2-digit', 
              hour12: true 
            });
            setLoginTime(formattedTime);
          } else {
            setLoginTime('');
          }
          setLatenessMinutes(userResponse.data.todayLatenessMinutes || 0);
        } catch (err) {
          console.error('Failed to load login tracking:', err);
        }
      }

    } catch (error: any) {
      console.error('Failed to load dashboard data:', error);
      setError(`Failed to load dashboard: ${error.response?.data?.error || error.message}`);
      
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

  const StatCard: React.FC<{ 
    title: string; 
    value: number; 
    color: string; 
    description?: string;
  }> = ({ title, value, color, description }) => {
    return (
      <div 
        className="bg-white p-6 shadow-sm border border-gray-100"
      >
        <div>
          <p className="text-xs uppercase tracking-wider mb-3 font-semibold" style={{ color: '#6b7280' }}>
            {title}
          </p>
          <p className="text-4xl mb-1 tracking-tight font-bold" style={{ color }}>
            {value}
          </p>
          {description && (
            <p className="text-xs text-gray-400 font-medium">{description}</p>
          )}
        </div>
      </div>
    );
  };

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

  return (
    <Layout>
      <div className="py-8 px-4 sm:px-6 lg:px-8" style={{ backgroundColor: '#f7f6f5' }}>
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

        {/* Agent Information */}
        <div className="mb-8 grid grid-cols-1 lg:grid-cols-6 gap-6 items-stretch">
          {/* Login Tracking Card */}
          {user && user.role !== 'Manager' && user.role !== 'Client' && (
            <div className="lg:col-span-1">
              <div className="bg-white p-6 h-full flex flex-col justify-center border border-gray-100 border-l-4 border-l-gray-100">
                <div className="space-y-4">
                  <div className="text-center">
                    <p className="text-xs uppercase tracking-wider mb-2 font-semibold" style={{ color: '#6b7280' }}>
                      Login Time
                    </p>
                    <p className="text-2xl bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent font-bold">
                      {loginTime || '--:--'}
                    </p>
                  </div>

                  <div className="border-t border-gray-200"></div>

                  <div className="text-center">
                    <p className="text-xs uppercase tracking-wider mb-2 font-semibold" style={{ color: '#6b7280' }}>
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
          )}

          {/* Agent Information Card */}
          <div className={user && user.role !== 'Manager' && user.role !== 'Client' ? 'lg:col-span-5' : 'lg:col-span-6'}>
            <div className="bg-white p-8 h-full border border-gray-100 border-l-4 border-l-gray-100">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 h-full items-center">
                <div className="text-center">
                  <p className="text-xs uppercase tracking-wider mb-3 font-semibold" style={{ color: '#6b7280' }}>
                    Agent
                  </p>
                  <p className="text-2xl bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent font-bold">
                    {user?.fullName || 'Unknown'}
                  </p>
                </div>
                
                <div className="text-center border-l border-r border-gray-200">
                  <p className="text-xs uppercase tracking-wider mb-3 font-semibold" style={{ color: '#6b7280' }}>
                    Team
                  </p>
                  <p className="text-xl bg-gradient-to-r from-cyan-600 to-blue-600 bg-clip-text text-transparent font-bold">
                    {user?.team?.name || 'Not Assigned'}
                  </p>
                </div>
                
                <div className="text-center">
                  <p className="text-xs uppercase tracking-wider mb-3 font-semibold" style={{ color: '#6b7280' }}>
                    Team Leader
                  </p>
                  <p className="text-2xl bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent font-bold">
                    {getTeamLeaderName()}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Grid with Progress Bar on Left */}
        <div className="grid grid-cols-1 lg:grid-cols-6 gap-6 mb-8">
          {/* Vertical Progress Bar - Left Side */}
          {monthStats && dashboardSettings?.targetLevels && (
            <div className="lg:col-span-1">
              <div className="bg-white h-full flex flex-col rounded-xl shadow-sm border border-gray-200">
                {/* Progress Section */}
                <div className="flex-1 px-8 py-5 flex items-center gap-6">
                  {/* Bar */}
                  <div className="relative" style={{ width: '12px' }}>
                    {/* Background bar (full height - represents max target) */}
                    <div className="w-full h-full bg-gray-200 rounded-full relative" style={{ minHeight: '240px' }}>
                      {/* Green progress bar (current qualified leads) - positioned at bottom */}
                      {(() => {
                        const percentage = Math.min((monthStats.qualified / dashboardSettings.targetLevels.level4) * 100, 100);
                        const minHeight = monthStats.qualified > 0 ? Math.max(percentage, 3) : 0;
                        return (
                          <div 
                            className="absolute bottom-0 w-full bg-gradient-to-t from-emerald-600 via-emerald-500 to-green-400 rounded-full transition-all duration-700 ease-out shadow-inner"
                            style={{ 
                              height: `${minHeight}%`,
                              minHeight: monthStats.qualified > 0 ? '8px' : '0'
                            }}
                          />
                        );
                      })()}
                    </div>

                    {/* Current number badge - positioned at top of green bar */}
                    {monthStats.qualified > 0 && (
                      <div 
                        className="absolute -left-10 transition-all duration-700 ease-out"
                        style={{ 
                          bottom: `${Math.min((monthStats.qualified / dashboardSettings.targetLevels.level4) * 100, 100)}%`,
                          transform: 'translateY(50%)'
                        }}
                      >
                        <div className="bg-emerald-600 text-white px-2 py-1 rounded shadow-lg text-xs font-bold whitespace-nowrap">
                          {monthStats.qualified}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Labels */}
                  <div className="flex-1 relative" style={{ minHeight: '240px' }}>
                    {(() => {
                      const tiers = [
                        { level: dashboardSettings.targetLevels.level1, name: dashboardSettings.levelNames?.level1 || 'BRONZE', color: '#cd7f32' },
                        { level: dashboardSettings.targetLevels.level2, name: dashboardSettings.levelNames?.level2 || 'SILVER', color: '#c0c0c0' },
                        { level: dashboardSettings.targetLevels.level3, name: dashboardSettings.levelNames?.level3 || 'GOLD', color: '#ffd700' },
                        { level: dashboardSettings.targetLevels.level4, name: dashboardSettings.levelNames?.level4 || 'PLATINUM', color: '#e5e4e2' }
                      ];
                      return tiers;
                    })().map((tier) => {
                      const position = (tier.level / dashboardSettings.targetLevels.level4) * 100;
                      const isAchieved = monthStats.qualified >= tier.level;
                      return (
                        <div 
                          key={tier.level}
                          className="absolute left-0 right-0"
                          style={{ 
                            bottom: `${position}%`,
                            transform: 'translateY(50%)'
                          }}
                        >
                          <div className="flex items-baseline gap-1">
                            <span className={`text-xl font-bold leading-none ${
                              isAchieved ? 'text-gray-900' : 'text-gray-300'
                            }`}>
                              {tier.level}
                            </span>
                            <span 
                              className="text-[9px] font-semibold tracking-wide leading-none"
                              style={{ 
                                color: isAchieved ? tier.color : '#d1d5db'
                              }}
                            >
                              {tier.name}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Footer */}
                <div className="px-5 py-3 bg-gray-50 border-t border-gray-100">
                  <div className="text-center">
                    {(() => {
                      const levels = [
                        dashboardSettings.targetLevels.level1,
                        dashboardSettings.targetLevels.level2,
                        dashboardSettings.targetLevels.level3,
                        dashboardSettings.targetLevels.level4
                      ];
                      const names = [
                        dashboardSettings.levelNames?.level1 || 'BRONZE',
                        dashboardSettings.levelNames?.level2 || 'SILVER',
                        dashboardSettings.levelNames?.level3 || 'GOLD',
                        dashboardSettings.levelNames?.level4 || 'PLATINUM'
                      ];
                      const colors = ['#cd7f32', '#c0c0c0', '#ffd700', '#e5e4e2'];
                      
                      for (let i = 0; i < levels.length; i++) {
                        if (monthStats.qualified < levels[i]) {
                          const remaining = levels[i] - monthStats.qualified;
                          return (
                            <div>
                              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                                Next Milestone
                              </p>
                              <p className="text-2xl font-bold text-gray-900 leading-none mt-1">
                                {remaining}
                              </p>
                              <p 
                                className="text-[10px] font-semibold tracking-wide mt-1"
                                style={{ color: colors[i] }}
                              >
                                to {names[i]}
                              </p>
                            </div>
                          );
                        }
                      }
                      
                      return (
                        <div className="py-1">
                          <p className="text-sm font-bold text-emerald-600">
                            ✓ All Targets Achieved
                          </p>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Right Side - Stats */}
          <div className="lg:col-span-5 space-y-8">
            {/* Today's Performance */}
            <div>
              <div className="grid gap-5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}>
                {dashboardSettings?.todayPerformance?.showTotal && (
                  <StatCard 
                    title="Total" 
                    value={todayStats?.total || 0} 
                    color="#000000"
                  />
                )}
                {dashboardSettings?.todayPerformance?.showPending && (
                  <StatCard 
                    title="Pending" 
                    value={todayStats?.pending || 0} 
                    color="#f59e0b"
                  />
                )}
                {dashboardSettings?.todayPerformance?.showQualified && (
                  <StatCard 
                    title="Qualified" 
                    value={todayStats?.qualified || 0} 
                    color="#059669"
                  />
                )}
                {dashboardSettings?.todayPerformance?.showDisqualified && (
                  <StatCard 
                    title="Disqualified" 
                    value={todayStats?.disqualified || 0} 
                    color="#dc2626"
                  />
                )}
                {dashboardSettings?.todayPerformance?.showDuplicate && (
                  <StatCard 
                    title="Duplicate" 
                    value={todayStats?.duplicate || 0} 
                    color="#2563eb"
                  />
                )}
                {dashboardSettings?.todayPerformance?.showCallback && (
                  <StatCard 
                    title="Callback" 
                    value={todayStats?.callback || 0} 
                    color="#1e293b"
                  />
                )}
              </div>
            </div>

            {/* Monthly Overview */}
            <div>
              <h2 className="text-2xl font-bold text-slate-800 mb-6 tracking-tight">This Month</h2>
              <div className="grid gap-5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}>
                {dashboardSettings?.monthlyOverview?.showTotal && (
                  <StatCard 
                    title="Total" 
                    value={monthStats?.total || 0} 
                    color="#000000"
                  />
                )}
                {dashboardSettings?.monthlyOverview?.showQualified && (
                  <StatCard 
                    title="Qualified" 
                    value={monthStats?.qualified || 0} 
                    color="#059669"
                  />
                )}
                {dashboardSettings?.monthlyOverview?.showDisqualified && (
                  <StatCard 
                    title="Disqualified" 
                    value={monthStats?.disqualified || 0} 
                    color="#dc2626"
                  />
                )}
                {dashboardSettings?.monthlyOverview?.showDuplicate && (
                  <StatCard 
                    title="Duplicate" 
                    value={monthStats?.duplicate || 0} 
                    color="#2563eb"
                  />
                )}
                {dashboardSettings?.monthlyOverview?.showPending && (
                  <StatCard 
                    title="Pending" 
                    value={monthStats?.pending || 0} 
                    color="#f59e0b"
                  />
                )}
                {dashboardSettings?.monthlyOverview?.showCallback && (
                  <StatCard 
                    title="Callback" 
                    value={monthStats?.callback || 0} 
                    color="#1e293b"
                  />
                )}
              </div>
            </div>
          </div>
        </div>



      </div>
    </Layout>
  );
};

export default Dashboard;
