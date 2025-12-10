import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout/Layout';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';

const ITDashboardHome: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [loginTime, setLoginTime] = useState<string>('');
  const [latenessMinutes, setLatenessMinutes] = useState<number>(0);
  const [stats, setStats] = useState({
    pending: 0,
    underReview: 0,
    solved: 0,
    notSolved: 0,
    total: 0
  });

  useEffect(() => {
    if (user?.role !== 'IT') {
      navigate('/');
      return;
    }
    loadData();
  }, [user, navigate]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load login tracking
      try {
        const loginResponse = await api.get('/auth/login-tracking');
        if (loginResponse.data.loginTime) {
          setLoginTime(loginResponse.data.loginTime);
          setLatenessMinutes(loginResponse.data.latenessMinutes || 0);
        }
      } catch (err) {
        console.error('Failed to load login tracking:', err);
      }

      // Load ticket stats
      try {
        const ticketsResponse = await api.get('/it-tickets?limit=1000');
        const tickets = ticketsResponse.data.tickets || [];
        setStats({
          pending: tickets.filter((t: any) => t.status === 'Pending').length,
          underReview: tickets.filter((t: any) => t.status === 'UnderReview').length,
          solved: tickets.filter((t: any) => t.status === 'Solved').length,
          notSolved: tickets.filter((t: any) => t.status === 'NotSolved').length,
          total: tickets.length
        });
      } catch (err) {
        console.error('Failed to load ticket stats:', err);
      }
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
      <div className="py-8 px-4 sm:px-6 lg:px-8" style={{ backgroundColor: '#f7f6f5' }}>
        {/* IT User Information and Login Tracking */}
        <div className="mb-8 grid grid-cols-1 lg:grid-cols-6 gap-6 items-stretch">
          {/* Login Tracking Card */}
          <div className="lg:col-span-1">
            <div className="bg-white p-6 h-full flex flex-col justify-center border border-gray-200 border-l-4 border-l-slate-800 shadow-sm">
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

          {/* IT User Information Card */}
          <div className="lg:col-span-5">
            <div className="bg-white p-8 h-full border border-gray-200 border-l-4 border-l-slate-800 shadow-sm flex items-center justify-center">
              <div className="text-center">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
                  IT Support Specialist
                </p>
                <p className="text-3xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">
                  {user?.fullName || 'Unknown'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-5 mb-8">
          <div className="bg-white p-6 shadow-sm border border-gray-100">
            <div className="text-center">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Pending</p>
              <p className="text-4xl font-bold mb-1 tracking-tight text-yellow-600">{stats.pending}</p>
            </div>
          </div>
          <div className="bg-white p-6 shadow-sm border border-gray-100">
            <div className="text-center">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Under Review</p>
              <p className="text-4xl font-bold mb-1 tracking-tight text-blue-600">{stats.underReview}</p>
            </div>
          </div>
          <div className="bg-white p-6 shadow-sm border border-gray-100">
            <div className="text-center">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Solved</p>
              <p className="text-4xl font-bold mb-1 tracking-tight text-green-600">{stats.solved}</p>
            </div>
          </div>
          <div className="bg-white p-6 shadow-sm border border-gray-100">
            <div className="text-center">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Not Solved</p>
              <p className="text-4xl font-bold mb-1 tracking-tight text-red-600">{stats.notSolved}</p>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <button
            onClick={() => navigate('/it-new-tickets')}
            className="bg-white p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow text-left"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">New Tickets</div>
                <div className="text-4xl font-bold text-cyan-600 mb-1">{stats.pending + stats.underReview}</div>
                <div className="text-xs text-gray-400 font-medium">Click to view and manage</div>
              </div>
              <svg className="w-8 h-8 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </button>
          <button
            onClick={() => navigate('/it-tickets-list')}
            className="bg-white p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow text-left"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Tickets List</div>
                <div className="text-4xl font-bold text-purple-600 mb-1">{stats.solved + stats.notSolved}</div>
                <div className="text-xs text-gray-400 font-medium">View resolved tickets</div>
              </div>
              <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </button>
        </div>
      </div>
    </Layout>
  );
};

export default ITDashboardHome;
