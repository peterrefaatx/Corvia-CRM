// AdminDashboard.tsx - Premium Modern Design with SVG Icons
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout/Layout';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';

interface AdminCard {
  title: string;
  description: string;
  link: string;
  icon: string;
  available: boolean;
}

const AdminDashboard: React.FC = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    activeUsers: 0,
    activeCampaigns: 0,
    teams: 0,
    pendingQC: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const [usersRes, campaignsRes, teamsRes, leadsRes] = await Promise.all([
        api.get('/users'),
        api.get('/campaigns'),
        api.get('/teams'),
        api.get('/leads')
      ]);

      const users = Array.isArray(usersRes.data) ? usersRes.data : [];
      const campaigns = Array.isArray(campaignsRes.data) ? campaignsRes.data : [];
      const teams = Array.isArray(teamsRes.data) ? teamsRes.data : [];
      const leads = Array.isArray(leadsRes.data) ? leadsRes.data : [];

      setStats({
        activeUsers: users.filter((u: any) => u.isActive).length,
        activeCampaigns: campaigns.filter((c: any) => c.isActive).length,
        teams: teams.length,
        pendingQC: leads.filter((l: any) => l.status === 'Pending').length
      });
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const adminCards: AdminCard[] = [
    {
      title: 'User Management',
      description: 'Manage accounts, roles, and permissions',
      link: '/admin/users',
      icon: 'users',
      available: true
    },
    {
      title: 'Campaign Management',
      description: 'Create and configure campaigns',
      link: '/admin/campaigns',
      icon: 'megaphone',
      available: true
    },
    {
      title: 'Team Management',
      description: 'Organize teams and assign leaders',
      link: '/admin/teams',
      icon: 'team',
      available: true
    },
    {
      title: 'Analytics & Reports',
      description: 'Performance metrics and insights',
      link: '/admin/analytics',
      icon: 'chart',
      available: true
    },
    {
      title: 'System Settings',
      description: 'Configure system preferences',
      link: '/admin/settings',
      icon: 'settings',
      available: true
    },
    {
      title: 'Accounts',
      description: 'Assign personnel to account managers',
      link: '/account-manager-management',
      icon: 'link',
      available: true
    }
  ];

  const getIcon = (iconName: string) => {
    switch(iconName) {
      case 'users':
        return <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />;
      case 'megaphone':
        return <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />;
      case 'team':
        return <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />;
      case 'chart':
        return <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />;
      case 'settings':
        return <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />;
      case 'link':
        return <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-indigo-200 border-t-indigo-600 mx-auto mb-4"></div>
            <p className="text-slate-600 font-medium">Loading dashboard...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="py-8 px-4 sm:px-6 lg:px-8" style={{ backgroundColor: '#f7f6f5' }}>
          
          {/* Admin Name Card */}
          <div className="mb-8">
            <div className="bg-white rounded-lg py-16 px-12 border border-gray-200 border-l-4 border-l-slate-800">
              <div className="text-center">
                <p className="text-xs uppercase tracking-wider mb-5" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 600 }}>
                  Administrator
                </p>
                <p className="text-4xl bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 700 }}>
                  {user?.fullName || 'Unknown'}
                </p>
              </div>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
            {/* Active Users */}
            <div className="bg-white rounded-xl p-6 border border-slate-100 border-l-4 border-l-slate-200">
              <div className="flex items-center mb-4">
                <svg className="w-10 h-10 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
              <p className="text-3xl text-slate-900 mb-1" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 700 }}>{stats.activeUsers}</p>
              <p className="text-sm text-slate-500" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 500 }}>Active Users</p>
            </div>

            {/* Active Campaigns */}
            <div className="bg-white rounded-xl p-6 border border-slate-100 border-l-4 border-l-slate-200">
              <div className="flex items-center mb-4">
                <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                </svg>
              </div>
              <p className="text-3xl text-slate-900 mb-1" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 700 }}>{stats.activeCampaigns}</p>
              <p className="text-sm text-slate-500" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 500 }}>Active Campaigns</p>
            </div>

            {/* Teams */}
            <div className="bg-white rounded-xl p-6 border border-slate-100 border-l-4 border-l-slate-200">
              <div className="flex items-center mb-4">
                <svg className="w-10 h-10 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <p className="text-3xl text-slate-900 mb-1" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 700 }}>{stats.teams}</p>
              <p className="text-sm text-slate-500" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 500 }}>Total Teams</p>
            </div>

            {/* Pending QC */}
            <div className="bg-white rounded-xl p-6 border border-slate-100 border-l-4 border-l-slate-200">
              <div className="flex items-center mb-4">
                <svg className="w-10 h-10 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-3xl text-slate-900 mb-1" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 700 }}>{stats.pendingQC}</p>
              <p className="text-sm text-slate-500" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 500 }}>QC Review Queue</p>
            </div>
          </div>

          {/* Management Tools */}
          <div className="mb-10">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {adminCards.map((card, index) => (
                <Link
                  key={card.title}
                  to={card.available ? card.link : '#'}
                  onClick={!card.available ? (e) => e.preventDefault() : undefined}
                  className={`bg-white rounded-xl p-6 border border-slate-100 border-l-4 border-l-slate-200 transition-all duration-200 ${
                    card.available ? 'hover:border-l-indigo-500 hover:bg-slate-50' : 'opacity-50 cursor-not-allowed'
                  }`}
                >
                  <div className="flex items-start space-x-4">
                    <svg className="w-12 h-12 text-indigo-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      {getIcon(card.icon)}
                    </svg>
                    <div className="flex-1">
                      <h3 className="text-lg text-slate-900 mb-2" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 600 }}>
                        {card.title}
                      </h3>
                      <p className="text-sm text-slate-600 leading-relaxed" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 400 }}>
                        {card.description}
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* System Status */}
          <div>
            <div className="bg-white rounded-xl p-8 border border-slate-100 border-l-4 border-l-slate-200">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Database */}
                <div className="flex items-center space-x-4">
                  <svg className="w-10 h-10 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                  </svg>
                  <div>
                    <p className="text-sm text-slate-900" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 600 }}>Database</p>
                    <p className="text-xs text-green-600" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 500 }}>Connected</p>
                  </div>
                </div>

                {/* API Server */}
                <div className="flex items-center space-x-4">
                  <svg className="w-10 h-10 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
                  </svg>
                  <div>
                    <p className="text-sm text-slate-900" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 600 }}>API Server</p>
                    <p className="text-xs text-green-600" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 500 }}>Running</p>
                  </div>
                </div>

                {/* WebSocket */}
                <div className="flex items-center space-x-4">
                  <svg className="w-10 h-10 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <div>
                    <p className="text-sm text-slate-900" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 600 }}>Real-time</p>
                    <p className="text-xs text-green-600" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 500 }}>Active</p>
                  </div>
                </div>

                {/* Backup */}
                <div className="flex items-center space-x-4">
                  <svg className="w-10 h-10 text-blue-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                  </svg>
                  <div>
                    <p className="text-sm text-slate-900" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 600 }}>Last Backup</p>
                    <p className="text-xs text-blue-600" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 500 }}>Today 2:00 AM</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
    </Layout>
  );
};

export default AdminDashboard;

