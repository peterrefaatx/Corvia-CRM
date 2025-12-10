import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import Layout from '../components/Layout/Layout';
import api from '../services/api';
import { Calendar, CalendarDays } from 'lucide-react';

interface QCStats {
  today: {
    pending: number;
    reviewed: number;
    qualified: number;
    disqualified: number;
    duplicate: number;
    callback: number;
    overrideQualified: number;
  };
  thisMonth: {
    pending: number;
    reviewed: number;
    qualified: number;
    disqualified: number;
    duplicate: number;
    callback: number;
    overrideQualified: number;
  };
  assignedCampaigns: Array<{
    id: string;
    name: string;
    pendingCount: number;
    reviewedToday: number;
  }>;
  qualityMetrics: {
    qualificationRate: number;
    overrideRate: number;
    avgReviewTime: number;
  };
}

const QCAnalytics: React.FC = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<QCStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<'today' | 'month'>('today');
  const [loginTime, setLoginTime] = useState<string>('');
  const [latenessMinutes, setLatenessMinutes] = useState<number>(0);

  useEffect(() => {
    loadQCStats();
  }, []);

  const loadQCStats = async () => {
    try {
      setLoading(true);
      const response = await api.get('/qc/analytics');
      setStats(response.data);
      
      // Fetch login tracking
      try {
        const userResponse = await api.get('/auth/me');
        
        if (userResponse.data.todayLoginTime) {
          const loginDate = new Date(userResponse.data.todayLoginTime);
          setLoginTime(loginDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }));
        }
        setLatenessMinutes(userResponse.data.todayLatenessMinutes || 0);
      } catch (err) {
        console.error('Failed to load user data:', err);
      }
    } catch (error) {
      console.error('Failed to load QC analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#fafafa' }}><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>
      </Layout>
    );
  }

  const currentStats = selectedPeriod === 'today' ? stats?.today : stats?.thisMonth;

  return (
    <Layout>
      <div className="py-8 px-4 sm:px-6 lg:px-8" style={{ backgroundColor: '#f7f6f5' }}>
        {/* QC Information and Attendance Cards */}
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

          {/* QC Information Card */}
          <div className="lg:col-span-5">
            <div className="p-8 h-full flex items-center justify-center" style={{ backgroundColor: '#F4F6FA', border: '1px solid #E5E7EB', borderLeft: '4px solid #D1D5DB', borderRadius: '0' }}>
              <div className="text-center">
                <p className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-4">Quality Control</p>
                <p className="text-2xl font-extrabold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">{user?.fullName || 'Unknown'}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Section */}
        <div className="mb-8 relative">
          {/* Period Toggle Icon - Top Right */}
          <button
            onClick={() => setSelectedPeriod(selectedPeriod === 'today' ? 'month' : 'today')}
            className="absolute top-0 right-0 p-2 rounded-lg hover:bg-gray-100 transition-colors group z-10"
            title={selectedPeriod === 'today' ? 'Switch to Month View' : 'Switch to Today View'}
          >
            {selectedPeriod === 'today' ? (
              <Calendar className="w-6 h-6 text-primary" />
            ) : (
              <CalendarDays className="w-6 h-6 text-primary" />
            )}
          </button>

          {/* Primary Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-5 mb-6">
            {/* Pending Leads */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <div className="text-center">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Pending Review</p>
                <p className="text-4xl font-bold mb-1 tracking-tight" style={{ color: '#f59e0b' }}>{currentStats?.pending || 0}</p>
              </div>
            </div>

            {/* Reviewed */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <div className="text-center">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Reviewed</p>
                <p className="text-4xl font-bold mb-1 tracking-tight" style={{ color: '#0891b2' }}>{currentStats?.reviewed || 0}</p>
              </div>
            </div>

            {/* Qualified */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <div className="text-center">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Qualified</p>
                <p className="text-4xl font-bold mb-1 tracking-tight" style={{ color: '#059669' }}>{currentStats?.qualified || 0}</p>
              </div>
            </div>

            {/* Disqualified */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <div className="text-center">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Disqualified</p>
                <p className="text-4xl font-bold mb-1 tracking-tight" style={{ color: '#dc2626' }}>{currentStats?.disqualified || 0}</p>
              </div>
            </div>
          </div>

          {/* Secondary Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <div className="text-center">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Duplicate</p>
                <p className="text-3xl font-bold tracking-tight" style={{ color: '#2563eb' }}>{currentStats?.duplicate || 0}</p>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <div className="text-center">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Callback</p>
                <p className="text-3xl font-bold tracking-tight" style={{ color: '#1e293b' }}>{currentStats?.callback || 0}</p>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <div className="text-center">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Override Qualified</p>
                <p className="text-3xl font-bold tracking-tight" style={{ color: '#ea580c' }}>{currentStats?.overrideQualified || 0}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Assigned Campaigns */}
        {stats?.assignedCampaigns && stats.assignedCampaigns.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-4">Assigned Campaigns</h2>
            <div className="space-y-3">
              {stats.assignedCampaigns.map((campaign) => (
                <div key={campaign.id} className="flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition-colors border-l-4 border-blue-600 rounded">
                  <div>
                    <p className="font-semibold text-gray-900">{campaign.name}</p>
                    <p className="text-xs text-gray-600 mt-1">
                      {campaign.pendingCount} pending • {campaign.reviewedToday} reviewed today
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    {campaign.pendingCount > 0 && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800 border border-yellow-200">
                        {campaign.pendingCount}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default QCAnalytics;





