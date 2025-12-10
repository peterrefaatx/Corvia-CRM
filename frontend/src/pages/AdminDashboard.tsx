// AdminDashboard.tsx - Premium Modern Design with SVG Icons
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout/Layout';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import { usePageTitle } from '../hooks/usePageTitle';
import { LineChart, Line, AreaChart, Area, BarChart, Bar, ResponsiveContainer, Tooltip } from 'recharts';

interface AdminCard {
  title: string;
  description: string;
  link: string;
  icon: string;
  available: boolean;
}





const AdminDashboard: React.FC = () => {
  usePageTitle('Admin Dashboard');
  const { user } = useAuth();
  const [stats, setStats] = useState({
    activeUsers: 0,
    activeCampaigns: 0,
    teams: 0,
    pendingQC: 0
  });
  const [loading, setLoading] = useState(true);
  const [kpiData, setKpiData] = useState({
    totalLeads: 0,
    monthlyLeads: 0,
    qualifiedLeads: 0,
    qualificationRate: 0,
    leadsThisWeek: 0,
    weeklyGrowth: 0,
    avgResponseTime: 0,
    topAgentName: '',
    topAgentLeads: 0
  });
  const [chartData, setChartData] = useState<any[]>([]);

  useEffect(() => {
    loadDashboardData();
    loadKPIData();
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
      
      let leads = [];
      if (Array.isArray(leadsRes.data)) {
        leads = leadsRes.data;
      } else if (leadsRes.data && Array.isArray(leadsRes.data.leads)) {
        leads = leadsRes.data.leads;
      }

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

  const loadKPIData = async () => {
    try {
      // Get leads data
      const leadsRes = await api.get('/leads');
      let leads = [];
      if (Array.isArray(leadsRes.data)) {
        leads = leadsRes.data;
      } else if (leadsRes.data && Array.isArray(leadsRes.data.leads)) {
        leads = leadsRes.data.leads;
      }

      // Calculate KPIs
      const totalLeads = leads.length;
      const qualifiedLeads = leads.filter((l: any) => l.status === 'Qualified').length;
      const qualificationRate = totalLeads > 0 ? Math.round((qualifiedLeads / totalLeads) * 100) : 0;

      // This month's leads
      const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      const monthlyLeads = leads.filter((l: any) => new Date(l.createdAt) >= startOfMonth).length;

      // This week's leads
      const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const leadsThisWeek = leads.filter((l: any) => new Date(l.createdAt) >= oneWeekAgo).length;
      
      // Previous week for growth calculation
      const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
      const leadsPreviousWeek = leads.filter((l: any) => {
        const date = new Date(l.createdAt);
        return date >= twoWeeksAgo && date < oneWeekAgo;
      }).length;
      const weeklyGrowth = leadsPreviousWeek > 0 
        ? Math.round(((leadsThisWeek - leadsPreviousWeek) / leadsPreviousWeek) * 100)
        : leadsThisWeek > 0 ? 100 : 0;

      // Generate chart data for last 7 days
      const last7Days = Array.from({ length: 7 }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - (6 - i));
        return date.toISOString().split('T')[0];
      });

      const chartDataByDay = last7Days.map(date => {
        const dayLeads = leads.filter((lead: any) => lead.createdAt.startsWith(date));
        return {
          date: new Date(date).toLocaleDateString('en-US', { weekday: 'short' }),
          leads: dayLeads.length,
          qualified: dayLeads.filter((lead: any) => lead.status === 'Qualified').length
        };
      });

      setKpiData({
        totalLeads,
        monthlyLeads,
        qualifiedLeads,
        qualificationRate,
        leadsThisWeek,
        weeklyGrowth,
        avgResponseTime: 2.4, // Mock data - you can calculate from actual data
        topAgentName: 'Top Performer',
        topAgentLeads: leads.length > 0 ? 1 : 0
      });

      setChartData(chartDataByDay);
    } catch (error) {
      console.error('Failed to load KPI data:', error);
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
    },
    {
      title: 'Backup & Restore',
      description: 'Manage database backups and restore data',
      link: '/admin/backup-restore',
      icon: 'database',
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
      case 'database':
        return <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-cyan-200 border-t-cyan-600 mx-auto mb-4"></div>
            <p className="text-slate-600 font-medium">Loading dashboard...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="py-8 px-4 sm:px-6 lg:px-8" style={{ backgroundColor: '#f7f6f5' }}>
          
          {/* Admin Name Card - Special Elegant Design */}
          <div className="mb-8">
            <div className="relative bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              {/* Subtle top border accent */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-gray-300 to-transparent"></div>
              
              {/* Main content */}
              <div className="px-12 py-10">
                <div className="max-w-4xl mx-auto text-center">
                  {/* Decorative line above */}
                  <div className="flex items-center justify-center mb-6">
                    <div className="h-px w-16 bg-gray-300"></div>
                    <div className="mx-4">
                      <div className="w-1.5 h-1.5 rounded-full bg-gray-400"></div>
                    </div>
                    <div className="h-px w-16 bg-gray-300"></div>
                  </div>
                  
                  {/* Role label */}
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-[0.2em] mb-4 select-none">
                    Administrator
                  </p>
                  
                  {/* Name - Large and elegant */}
                  <h1 className="text-4xl md:text-5xl font-light text-gray-900 tracking-tight mb-2 select-none" style={{ fontFamily: 'system-ui, -apple-system, sans-serif', letterSpacing: '-0.02em' }}>
                    {user?.fullName || 'Unknown'}
                  </h1>
                  
                  {/* Decorative line below */}
                  <div className="flex items-center justify-center mt-6">
                    <div className="h-px w-16 bg-gray-300"></div>
                    <div className="mx-4">
                      <div className="w-1.5 h-1.5 rounded-full bg-gray-400"></div>
                    </div>
                    <div className="h-px w-16 bg-gray-300"></div>
                  </div>
                </div>
              </div>
              
              {/* Subtle bottom border accent */}
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-gray-300 to-transparent"></div>
            </div>
          </div>

          {/* Stats Grid - Matching Performance Overview Style */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
            {/* Active Users */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-lg transition-shadow duration-300">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold text-slate-600">Active Users</span>
                <div className="p-2 bg-cyan-50 rounded-lg">
                  <svg className="w-4 h-4 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                </div>
              </div>
              <div className="text-3xl font-bold text-slate-900">{stats.activeUsers}</div>
              <div className="text-xs text-slate-500 mt-1">System users</div>
            </div>

            {/* Active Campaigns */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-lg transition-shadow duration-300">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold text-slate-600">Active Campaigns</span>
                <div className="p-2 bg-purple-50 rounded-lg">
                  <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                  </svg>
                </div>
              </div>
              <div className="text-3xl font-bold text-slate-900">{stats.activeCampaigns}</div>
              <div className="text-xs text-slate-500 mt-1">Running campaigns</div>
            </div>

            {/* Teams */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-lg transition-shadow duration-300">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold text-slate-600">Total Teams</span>
                <div className="p-2 bg-orange-50 rounded-lg">
                  <svg className="w-4 h-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
              </div>
              <div className="text-3xl font-bold text-slate-900">{stats.teams}</div>
              <div className="text-xs text-slate-500 mt-1">Organized teams</div>
            </div>

            {/* Pending QC */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-lg transition-shadow duration-300">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold text-slate-600">QC Review Queue</span>
                <div className="p-2 bg-emerald-50 rounded-lg">
                  <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              <div className="text-3xl font-bold text-slate-900">{stats.pendingQC}</div>
              <div className="text-xs text-slate-500 mt-1">Awaiting review</div>
            </div>
          </div>

          {/* Performance KPIs & Charts */}
          <div className="mb-10">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
              {/* Qualification Rate */}
              <div className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-lg transition-shadow duration-300">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-semibold text-slate-600">Qualification Rate</span>
                  <div className="p-2 bg-primary-light rounded-lg">
                    <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
                <div className="flex items-end justify-between">
                  <div>
                    <div className="text-3xl font-bold text-slate-900">{kpiData.qualificationRate}%</div>
                    <div className="text-xs text-slate-500 mt-1">{kpiData.qualifiedLeads} of {kpiData.totalLeads} leads</div>
                  </div>
                  <div className="h-12 w-20">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData}>
                        <Area type="monotone" dataKey="qualified" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.2} strokeWidth={2} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Weekly Growth */}
              <div className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-lg transition-shadow duration-300">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-semibold text-slate-600">Weekly Growth</span>
                  <div className="p-2 bg-emerald-50 rounded-lg">
                    <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                  </div>
                </div>
                <div className="flex items-end justify-between">
                  <div>
                    <div className="flex items-baseline space-x-2">
                      <span className="text-3xl font-bold text-slate-900">{kpiData.leadsThisWeek}</span>
                      <span className={`text-sm font-semibold ${kpiData.weeklyGrowth >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {kpiData.weeklyGrowth >= 0 ? '+' : ''}{kpiData.weeklyGrowth}%
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 mt-1">Leads this week</div>
                  </div>
                  <div className="h-12 w-20">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData}>
                        <Line type="monotone" dataKey="leads" stroke="#10b981" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Total Leads Trend */}
              <div className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-lg transition-shadow duration-300">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-semibold text-slate-600">Total Leads</span>
                  <div className="p-2 bg-purple-50 rounded-lg">
                    <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                    </svg>
                  </div>
                </div>
                <div className="flex items-end justify-between">
                  <div>
                    <div className="text-3xl font-bold text-slate-900">{kpiData.monthlyLeads}</div>
                    <div className="text-xs text-slate-500 mt-1">This month</div>
                  </div>
                  <div className="h-12 w-20">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData}>
                        <Bar dataKey="leads" fill="#a855f7" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Avg Response Time */}
              <div className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-lg transition-shadow duration-300">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-semibold text-slate-600">Avg Response</span>
                  <div className="p-2 bg-orange-50 rounded-lg">
                    <svg className="w-4 h-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
                <div className="flex items-end justify-between">
                  <div>
                    <div className="flex items-baseline space-x-1">
                      <span className="text-3xl font-bold text-slate-900">{kpiData.avgResponseTime}</span>
                      <span className="text-sm text-slate-600">hrs</span>
                    </div>
                    <div className="text-xs text-slate-500 mt-1">QC review time</div>
                  </div>
                  <div className="h-12 w-20">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData.map((_item, i) => ({ value: 3 - (i * 0.1) }))}>
                        <Area type="monotone" dataKey="value" stroke="#f97316" fill="#f97316" fillOpacity={0.2} strokeWidth={2} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>

            {/* Weekly Performance Chart */}
            <div className="bg-white rounded-xl border border-slate-200 p-6 hover:shadow-lg transition-shadow duration-300">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Weekly Performance</h3>
                  <p className="text-sm text-slate-500 mt-1">Lead submissions over the last 7 days</p>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 rounded-full bg-primary-light0"></div>
                    <span className="text-xs text-slate-600">Total Leads</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                    <span className="text-xs text-slate-600">Qualified</span>
                  </div>
                </div>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="colorLeads" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorQualified" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'white', 
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                      }}
                    />
                    <Area type="monotone" dataKey="leads" stroke="#3b82f6" fillOpacity={1} fill="url(#colorLeads)" strokeWidth={2} />
                    <Area type="monotone" dataKey="qualified" stroke="#10b981" fillOpacity={1} fill="url(#colorQualified)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Management Tools - Premium Design */}
          <div className="mb-10">
            <h2 className="text-2xl font-bold text-slate-900 mb-6 tracking-tight">Administration Tools</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {adminCards.map((card, index) => {
                const gradients = [
                  { 
                    bg: 'from-cyan-500/10 via-cyan-500/5 to-transparent',
                    border: 'border-cyan-500/20',
                    iconBg: 'bg-gradient-to-br from-cyan-500 to-cyan-600',
                    shadow: 'hover:shadow-cyan-500/20',
                    glow: 'group-hover:shadow-cyan-500/30'
                  },
                  { 
                    bg: 'from-purple-500/10 via-purple-500/5 to-transparent',
                    border: 'border-purple-500/20',
                    iconBg: 'bg-gradient-to-br from-purple-500 to-purple-600',
                    shadow: 'hover:shadow-purple-500/20',
                    glow: 'group-hover:shadow-purple-500/30'
                  },
                  { 
                    bg: 'from-orange-500/10 via-orange-500/5 to-transparent',
                    border: 'border-orange-500/20',
                    iconBg: 'bg-gradient-to-br from-orange-500 to-orange-600',
                    shadow: 'hover:shadow-orange-500/20',
                    glow: 'group-hover:shadow-orange-500/30'
                  },
                  { 
                    bg: 'from-emerald-500/10 via-emerald-500/5 to-transparent',
                    border: 'border-emerald-500/20',
                    iconBg: 'bg-gradient-to-br from-emerald-500 to-emerald-600',
                    shadow: 'hover:shadow-emerald-500/20',
                    glow: 'group-hover:shadow-emerald-500/30'
                  },
                  { 
                    bg: 'from-blue-500/10 via-blue-500/5 to-transparent',
                    border: 'border-primary500/20',
                    iconBg: 'bg-gradient-to-br from-blue-500 to-blue-600',
                    shadow: 'hover:shadow-blue-500/20',
                    glow: 'group-hover:shadow-blue-500/30'
                  },
                  { 
                    bg: 'from-pink-500/10 via-pink-500/5 to-transparent',
                    border: 'border-pink-500/20',
                    iconBg: 'bg-gradient-to-br from-pink-500 to-pink-600',
                    shadow: 'hover:shadow-pink-500/20',
                    glow: 'group-hover:shadow-pink-500/30'
                  },
                  { 
                    bg: 'from-indigo-500/10 via-indigo-500/5 to-transparent',
                    border: 'border-indigo-500/20',
                    iconBg: 'bg-gradient-to-br from-indigo-500 to-indigo-600',
                    shadow: 'hover:shadow-indigo-500/20',
                    glow: 'group-hover:shadow-indigo-500/30'
                  }
                ];
                const gradient = gradients[index % gradients.length];
                
                return (
                  <Link
                    key={card.title}
                    to={card.available ? card.link : '#'}
                    onClick={!card.available ? (e) => e.preventDefault() : undefined}
                    className={`group relative overflow-hidden bg-white rounded-xl border ${gradient.border} transition-all duration-500 ${
                      card.available 
                        ? `hover:shadow-xl ${gradient.shadow} hover:-translate-y-1 cursor-pointer` 
                        : 'opacity-50 cursor-not-allowed'
                    }`}
                  >
                    {/* Gradient Background */}
                    <div className={`absolute inset-0 bg-gradient-to-br ${gradient.bg} opacity-0 group-hover:opacity-100 transition-opacity duration-500`}></div>
                    
                    {/* Shine Effect */}
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700">
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
                    </div>
                    
                    {/* Content */}
                    <div className="relative p-4">
                      {/* Icon Container */}
                      <div className={`inline-flex items-center justify-center w-10 h-10 rounded-lg ${gradient.iconBg} shadow-md ${gradient.glow} transition-all duration-500 mb-3 group-hover:scale-110 group-hover:rotate-3`}>
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                          {getIcon(card.icon)}
                        </svg>
                      </div>
                      
                      {/* Title */}
                      <h3 className="text-sm font-bold text-slate-900 mb-1 group-hover:text-slate-800 transition-colors">
                        {card.title}
                      </h3>
                      
                      {/* Description */}
                      <p className="text-xs text-slate-600 leading-snug group-hover:text-slate-700 transition-colors">
                        {card.description}
                      </p>
                      
                      {/* Arrow Icon */}
                      <div className="mt-3 flex items-center text-slate-400 group-hover:text-slate-600 transition-all duration-300">
                        <span className="text-xs font-semibold mr-1 opacity-0 group-hover:opacity-100 transition-opacity">Go</span>
                        <svg className="w-3 h-3 transform group-hover:translate-x-1 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* System Status */}
          <div>
            <div className="bg-white p-8 border border-gray-200 border-l-4 border-l-gray-400">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Database */}
                <div className="flex items-center space-x-4">
                  <svg className="w-10 h-10 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                  </svg>
                  <div>
                    <p className="text-sm font-bold text-slate-900">Database</p>
                    <p className="text-xs font-semibold text-green-600">Connected</p>
                  </div>
                </div>

                {/* API Server */}
                <div className="flex items-center space-x-4">
                  <svg className="w-10 h-10 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
                  </svg>
                  <div>
                    <p className="text-sm font-bold text-slate-900">API Server</p>
                    <p className="text-xs font-semibold text-green-600">Running</p>
                  </div>
                </div>

                {/* WebSocket */}
                <div className="flex items-center space-x-4">
                  <svg className="w-10 h-10 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <div>
                    <p className="text-sm font-bold text-slate-900">Real-time</p>
                    <p className="text-xs font-semibold text-green-600">Active</p>
                  </div>
                </div>

                {/* Backup */}
                <div className="flex items-center space-x-4">
                  <svg className="w-10 h-10 text-cyan-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                  </svg>
                  <div>
                    <p className="text-sm font-bold text-slate-900">Last Backup</p>
                    <p className="text-xs font-semibold text-cyan-600">Today 2:00 AM</p>
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





