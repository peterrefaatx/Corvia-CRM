import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import Layout from '../components/Layout/Layout';
import api from '../services/api';
import {
  CheckCircle,
  XCircle,
  Clock,
  Activity,
  Calendar,
  CalendarDays
} from 'lucide-react';

interface CampaignProgress {
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
  progress: string;
}

interface QualityMetrics {
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
}

interface Activity {
  id: string;
  type: string;
  description: string;
  agentName: string;
  campaignName: string;
  serialNumber: string;
  timestamp: string;
  status: string;
}

const TeamLeaderDashboard: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [metricsPeriod, setMetricsPeriod] = useState<'today' | 'month'>('today');
  const [campaignProgress, setCampaignProgress] = useState<CampaignProgress[]>([]);
  const [qualityMetrics, setQualityMetrics] = useState<QualityMetrics | null>(null);
  const [completionMetrics, setCompletionMetrics] = useState<any>(null);
  const [recentActivity, setRecentActivity] = useState<Activity[]>([]);
  const [loginTime, setLoginTime] = useState<string>('');
  const [latenessMinutes, setLatenessMinutes] = useState<number>(0);

  // Load dismissed activities from localStorage
  const getDismissedActivities = (): Set<string> => {
    try {
      const dismissed = localStorage.getItem('dismissedActivities');
      return dismissed ? new Set(JSON.parse(dismissed)) : new Set();
    } catch {
      return new Set();
    }
  };

  // Save dismissed activities to localStorage
  const saveDismissedActivities = (ids: Set<string>) => {
    try {
      localStorage.setItem('dismissedActivities', JSON.stringify(Array.from(ids)));
    } catch (error) {
      console.error('Failed to save dismissed activities:', error);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/team-leader/dashboard-enhanced?period=month`);

      const data = response.data;
      setCampaignProgress(data.campaignProgress);
      setQualityMetrics(data.qualityMetrics);
      setCompletionMetrics(data.completionMetrics);
      
      // Filter out dismissed activities
      const dismissedIds = getDismissedActivities();
      const filteredActivities = data.recentActivity.filter(
        (activity: Activity) => !dismissedIds.has(activity.id)
      );
      setRecentActivity(filteredActivities);
      
      // Fetch login tracking data
      try {
        const userResponse = await api.get('/auth/me');
        if (userResponse.data.todayLoginTime) {
          const loginDate = new Date(userResponse.data.todayLoginTime);
          setLoginTime(loginDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }));
        }
        setLatenessMinutes(userResponse.data.todayLatenessMinutes || 0);
      } catch (err) {
        console.error('Failed to load login tracking:', err);
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClearActivities = () => {
    // Get current dismissed IDs
    const dismissedIds = getDismissedActivities();
    
    // Add all current activity IDs to dismissed list
    recentActivity.forEach(activity => {
      dismissedIds.add(activity.id);
    });
    
    // Save to localStorage
    saveDismissedActivities(dismissedIds);
    
    // Clear the display
    setRecentActivity([]);
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'qualified':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'disqualified':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'callback':
        return <Clock className="w-4 h-4 text-blue-500" />;
      default:
        return <Activity className="w-4 h-4 text-gray-500" />;
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-screen">
          <div className="text-xl text-gray-600">Loading dashboard...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-6 bg-gray-50 min-h-screen">
      {/* Team Leader Information and Attendance Cards */}
      <div className="mb-8 grid grid-cols-1 lg:grid-cols-6 gap-6 items-stretch">
        {/* Login Tracking Card */}
        <div className="lg:col-span-1">
          <div className="bg-white p-6 h-full flex flex-col justify-center border border-gray-100 border-l-4 border-l-gray-100">
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

        {/* Team Leader Information Card */}
        <div className="lg:col-span-5">
          <div className="bg-white p-8 h-full border border-gray-100 border-l-4 border-l-gray-100 shadow-sm">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 h-full items-center">
              <div className="text-center">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Team Leader</p>
                <p className="text-2xl font-black tracking-tight" style={{ color: '#2D3748' }}>{user?.fullName || 'Unknown'}</p>
              </div>
              
              <div className="text-center">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Team</p>
                <p className="text-2xl font-black text-cyan-600 tracking-tight">{user?.team?.name || 'Not Assigned'}</p>
              </div>
              
              <div className="text-center">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Role</p>
                <p className="text-2xl font-black tracking-tight" style={{ color: '#2D3748' }}>
                  {user?.role === 'TeamLeader' ? 'Team Leader' : user?.role || 'N/A'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quality Metrics Section with Period Toggle */}
      {qualityMetrics && (
        <div className="bg-white rounded-lg shadow p-6 mb-6 relative">
          {/* Period Toggle Icon - Top Right */}
          <button
            onClick={() => setMetricsPeriod(metricsPeriod === 'today' ? 'month' : 'today')}
            className="absolute top-4 right-4 p-2 rounded-lg hover:bg-gray-100 transition-colors group z-10"
            title={metricsPeriod === 'today' ? 'Switch to Month View' : 'Switch to Today View'}
          >
            {metricsPeriod === 'today' ? (
              <Calendar className="w-6 h-6 text-blue-600" />
            ) : (
              <CalendarDays className="w-6 h-6 text-purple-600" />
            )}
          </button>

          {/* Metrics Display */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 pt-8">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-1">Quality Rate</p>
              <p className="text-3xl font-bold text-blue-600">
                {metricsPeriod === 'today' ? qualityMetrics.today.qualityRate : qualityMetrics.month.qualityRate}%
              </p>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-1">Qualified</p>
              <p className="text-3xl font-bold text-green-600">
                {metricsPeriod === 'today' ? qualityMetrics.today.qualifiedLeads : qualityMetrics.month.qualifiedLeads}
              </p>
            </div>
            <div className="text-center p-4 bg-red-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-1">Disqualified</p>
              <p className="text-3xl font-bold text-red-600">
                {metricsPeriod === 'today' ? qualityMetrics.today.disqualifiedLeads : qualityMetrics.month.disqualifiedLeads}
              </p>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-1">Callback</p>
              <p className="text-3xl font-bold text-gray-900">
                {metricsPeriod === 'today' ? qualityMetrics.today.callbackLeads : qualityMetrics.month.callbackLeads}
              </p>
            </div>
            <div className="text-center p-4 bg-yellow-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-1">Pending</p>
              <p className="text-3xl font-bold text-yellow-600">
                {metricsPeriod === 'today' ? qualityMetrics.today.pendingLeads : qualityMetrics.month.pendingLeads}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-4">
            <div className="text-center p-4 bg-cyan-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-1">Duplicate</p>
              <p className="text-3xl font-bold text-cyan-600">
                {metricsPeriod === 'today' ? qualityMetrics.today.duplicateLeads : qualityMetrics.month.duplicateLeads}
              </p>
            </div>
            <div className="text-center p-4 bg-orange-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-1">Total Leads</p>
              <p className="text-3xl font-bold text-orange-600">
                {metricsPeriod === 'today' ? qualityMetrics.today.totalLeads : qualityMetrics.month.totalLeads}
              </p>
            </div>
            <div className="text-center p-4 bg-pink-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-1">Daily Target</p>
              <p className="text-3xl font-bold text-pink-600">{qualityMetrics.dailyTarget}</p>
            </div>
            <div className="text-center p-4 bg-indigo-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-1">Active Campaigns</p>
              <p className="text-3xl font-bold text-indigo-600">{qualityMetrics.activeCampaigns}</p>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-1">Active Agents</p>
              <p className="text-3xl font-bold text-purple-600">{qualityMetrics.activeAgents}</p>
            </div>
          </div>
        </div>
      )}

      {/* Completion Percentage Cards */}
      {completionMetrics && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {/* Daily Completion */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-center mb-4">
              <p className="text-sm text-gray-600 mb-2">Daily Completion</p>
              <p className="text-5xl font-bold text-blue-600">
                {completionMetrics.dailyCompletion}%
              </p>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-4">
              <div
                className={`h-4 rounded-full transition-all ${
                  completionMetrics.dailyCompletion >= 100 ? 'bg-green-500' :
                  completionMetrics.dailyCompletion >= 75 ? 'bg-yellow-500' :
                  'bg-red-500'
                }`}
                style={{ width: `${Math.min(completionMetrics.dailyCompletion, 100)}%` }}
              />
            </div>
          </div>

          {/* Monthly Completion */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-center mb-4">
              <p className="text-sm text-gray-600 mb-2">Monthly Completion</p>
              <p className="text-5xl font-bold text-purple-600">
                {completionMetrics.monthlyCompletion}%
              </p>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-4">
              <div
                className={`h-4 rounded-full transition-all ${
                  completionMetrics.monthlyCompletion >= 100 ? 'bg-green-500' :
                  completionMetrics.monthlyCompletion >= 75 ? 'bg-yellow-500' :
                  'bg-red-500'
                }`}
                style={{ width: `${Math.min(completionMetrics.monthlyCompletion, 100)}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Campaign Progress Table */}
      <div className="mb-6">
        <div className="bg-white rounded-lg shadow overflow-hidden">
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
                {campaignProgress.map((campaign) => (
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
                    <td className="px-4 py-4 whitespace-nowrap text-center font-semibold text-cyan-600">
                      {campaign.duplicate}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-center font-semibold text-red-600">
                      {campaign.disqualified}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-center font-semibold text-gray-600">{campaign.missed}</td>
                    <td className="px-4 py-4 whitespace-nowrap text-center font-bold">{campaign.total}</td>
                  </tr>
                ))}
                {campaignProgress.length === 0 && (
                  <tr>
                    <td colSpan={10} className="px-4 py-8 text-center text-gray-500">
                      No active campaigns
                    </td>
                  </tr>
                )}
                {campaignProgress.length > 0 && (
                  <tr className="border-t-2 border-yellow-300">
                    <td className="py-2 bg-white"></td>
                    <td className="py-2 pl-2 whitespace-nowrap text-sm bg-yellow-100">TOTAL</td>
                    <td className="px-4 py-2 whitespace-nowrap text-center text-sm bg-yellow-100">
                      {campaignProgress.reduce((sum, c) => sum + c.target, 0)}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-center text-sm text-yellow-700 bg-yellow-100">
                      {campaignProgress.reduce((sum, c) => sum + c.pending, 0)}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-center text-sm text-gray-900 bg-yellow-100">
                      {campaignProgress.reduce((sum, c) => sum + c.callback, 0)}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-center text-sm text-green-700 bg-yellow-100">
                      {campaignProgress.reduce((sum, c) => sum + c.achieved, 0)}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-center text-sm text-cyan-700 bg-yellow-100">
                      {campaignProgress.reduce((sum, c) => sum + c.duplicate, 0)}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-center text-sm text-red-700 bg-yellow-100">
                      {campaignProgress.reduce((sum, c) => sum + c.disqualified, 0)}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-center text-sm text-gray-700 bg-yellow-100">
                      {campaignProgress.reduce((sum, c) => sum + c.missed, 0)}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-center text-sm bg-yellow-100">
                      {campaignProgress.reduce((sum, c) => sum + c.total, 0)}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Recent Activity Feed */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Activity className="w-5 h-5 text-blue-600" />
            Recent Activity Feed
          </h2>
          <div className="flex gap-2">
            <button
              onClick={fetchDashboardData}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium flex items-center gap-2"
              title="Refresh activity feed"
            >
              <Activity className="w-4 h-4" />
              Refresh
            </button>
            <button
              onClick={handleClearActivities}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
              title="Clear activity feed"
            >
              Clear
            </button>
          </div>
        </div>
        <div className="space-y-2">
          {recentActivity.slice(0, 4).map((activity) => (
            <div
              key={activity.id}
              className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
            >
              {getActivityIcon(activity.type)}
              <div className="flex-1">
                <p className="text-sm text-gray-900">{activity.description}</p>
                <p className="text-xs text-gray-500">
                  {activity.campaignName} • {new Date(activity.timestamp).toLocaleString()}
                </p>
              </div>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                activity.status === 'Qualified' ? 'bg-green-100 text-green-800' :
                activity.status === 'Disqualified' ? 'bg-red-100 text-red-800' :
                'bg-blue-100 text-blue-800'
              }`}>
                {activity.status}
              </span>
            </div>
          ))}
          {recentActivity.length === 0 && (
            <p className="text-center text-gray-500 py-4">No recent activity</p>
          )}
        </div>
      </div>
    </div>
    </Layout>
  );
};

export default TeamLeaderDashboard;
