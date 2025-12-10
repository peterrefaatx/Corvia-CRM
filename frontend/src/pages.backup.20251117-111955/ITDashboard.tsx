import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Layout from '../components/Layout/Layout';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import api from '../services/api';

interface ITTicket {
  id: string;
  agentName: string;
  telegramUsername: string;
  problemDescription: string;
  status: 'Pending' | 'UnderReview' | 'Solved' | 'NotSolved';
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
  submitter: {
    id: string;
    fullName: string;
    username: string;
    role: string;
  };
  assignedIT?: {
    id: string;
    fullName: string;
    username: string;
  };
  responses?: Array<{
    id: string;
    createdAt: string;
  }>;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const ITDashboard: React.FC = () => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [tickets, setTickets] = useState<ITTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [loginTime, setLoginTime] = useState<string>('');
  const [latenessMinutes, setLatenessMinutes] = useState<number>(0);
  const tabFromUrl = searchParams.get('tab') as 'new' | 'history' | null;
  const [activeTab, setActiveTab] = useState<'new' | 'history'>(tabFromUrl || 'new');
  const [filters, setFilters] = useState({
    status: 'All',
    searchTerm: ''
  });
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0
  });

  // Update active tab when URL changes
  useEffect(() => {
    if (tabFromUrl && (tabFromUrl === 'new' || tabFromUrl === 'history')) {
      setActiveTab(tabFromUrl);
    }
  }, [tabFromUrl]);

  useEffect(() => {
    if (user?.role !== 'IT') {
      navigate('/');
      return;
    }
    loadTickets();
    loadLoginTracking();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, navigate, filters.status, pagination.page, activeTab]);

  const loadLoginTracking = async () => {
    try {
      const response = await api.get('/auth/login-tracking');
      if (response.data.loginTime) {
        setLoginTime(response.data.loginTime);
        setLatenessMinutes(response.data.latenessMinutes || 0);
      }
    } catch (err) {
      console.error('Failed to load login tracking:', err);
    }
  };

  const loadTickets = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString()
      });
      
      // Filter based on active tab
      if (activeTab === 'new') {
        // New Tickets: Pending and Under Review
        if (filters.status === 'All') {
          params.append('status', 'Pending,UnderReview');
        } else {
          params.append('status', filters.status);
        }
      } else {
        // Tickets List: Solved and Not Solved
        if (filters.status === 'All') {
          params.append('status', 'Solved,NotSolved');
        } else {
          params.append('status', filters.status);
        }
      }
      
      if (filters.searchTerm) {
        params.append('search', filters.searchTerm);
      }
      
      const response = await api.get(`/it-tickets?${params.toString()}`);
      setTickets(response.data.tickets);
      setPagination(response.data.pagination);
    } catch (error) {
      console.error('Failed to load tickets:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setPagination(prev => ({ ...prev, page: 1 }));
    loadTickets();
  };

  const handleStatusChange = async (ticketId: string, newStatus: string) => {
    try {
      await api.put(`/it-tickets/${ticketId}/status`, { status: newStatus });
      loadTickets();
    } catch (error: any) {
      showToast(error?.response?.data?.error || 'Failed to update status', 'error');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Pending': return 'bg-yellow-100 text-yellow-800';
      case 'UnderReview': return 'bg-blue-100 text-blue-800';
      case 'Solved': return 'bg-green-100 text-green-800';
      case 'NotSolved': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'UnderReview': return 'Under Review';
      case 'NotSolved': return 'Not Solved';
      default: return status;
    }
  };

  const stats = {
    pending: tickets.filter(t => t.status === 'Pending').length,
    underReview: tickets.filter(t => t.status === 'UnderReview').length,
    solved: tickets.filter(t => t.status === 'Solved').length,
    notSolved: tickets.filter(t => t.status === 'NotSolved').length,
    total: pagination.total
  };

  return (
    <Layout>
      <div className="py-4 px-4 sm:px-6 lg:px-8" style={{ backgroundColor: '#F5F5F5' }}>
        {/* IT User Information and Login Tracking */}
        <div className="mb-6 grid grid-cols-1 lg:grid-cols-6 gap-4 items-stretch">
          {/* Login Tracking Card */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg p-6 h-full flex flex-col justify-center border border-gray-200 border-l-4 border-l-slate-800">
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
            <div className="bg-white rounded-2xl p-8 h-full border border-gray-300/50 border-l-4 border-l-cyan-500 shadow-sm flex items-center justify-center">
              <div className="text-center">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">IT Support Specialist</p>
                <p className="text-2xl font-black tracking-tight" style={{ color: '#2D3748' }}>{user?.fullName || 'Unknown'}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-6">
          <div className="bg-white rounded-lg shadow-sm p-1 inline-flex">
            <button
              onClick={() => {
                navigate('/it-dashboard?tab=new');
                setFilters(prev => ({ ...prev, status: 'All' }));
                setPagination(prev => ({ ...prev, page: 1 }));
              }}
              className={`px-6 py-3 rounded-lg font-semibold transition-all ${
                activeTab === 'new'
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              New Tickets
              <span className={`ml-2 px-2 py-1 rounded-full text-xs font-bold ${
                activeTab === 'new' ? 'bg-white text-cyan-600' : 'bg-gray-200 text-gray-700'
              }`}>
                {stats.pending + stats.underReview}
              </span>
            </button>
            <button
              onClick={() => {
                navigate('/it-dashboard?tab=history');
                setFilters(prev => ({ ...prev, status: 'All' }));
                setPagination(prev => ({ ...prev, page: 1 }));
              }}
              className={`px-6 py-3 rounded-lg font-semibold transition-all ${
                activeTab === 'history'
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Tickets List
              <span className={`ml-2 px-2 py-1 rounded-full text-xs font-bold ${
                activeTab === 'history' ? 'bg-white text-cyan-600' : 'bg-gray-200 text-gray-700'
              }`}>
                {stats.solved + stats.notSolved}
              </span>
            </button>
          </div>
        </div>

        {/* Statistics Cards - Based on Active Tab */}
        {activeTab === 'new' ? (
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-white rounded-lg p-4 shadow-sm border-l-4 border-yellow-500">
              <div className="text-gray-600 text-xs font-medium mb-1">Pending</div>
              <div className="text-gray-900 text-2xl font-bold">{stats.pending}</div>
            </div>
            <div className="bg-white rounded-lg p-4 shadow-sm border-l-4 border-blue-500">
              <div className="text-gray-600 text-xs font-medium mb-1">Under Review</div>
              <div className="text-gray-900 text-2xl font-bold">{stats.underReview}</div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-white rounded-lg p-4 shadow-sm border-l-4 border-green-500">
              <div className="text-gray-600 text-xs font-medium mb-1">Solved</div>
              <div className="text-gray-900 text-2xl font-bold">{stats.solved}</div>
            </div>
            <div className="bg-white rounded-lg p-4 shadow-sm border-l-4 border-red-500">
              <div className="text-gray-600 text-xs font-medium mb-1">Not Solved</div>
              <div className="text-gray-900 text-2xl font-bold">{stats.notSolved}</div>
            </div>
          </div>
        )}

        {/* Search Filter */}
        <div className="bg-white rounded-lg p-4 mb-6 shadow-sm">
          <div className="flex gap-2">
            <input
              type="text"
              value={filters.searchTerm}
              onChange={(e) => setFilters(prev => ({ ...prev, searchTerm: e.target.value }))}
              placeholder="Search by agent name, telegram, or problem..."
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            />
            <button
              onClick={handleSearch}
              className="px-6 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 font-medium"
            >
              Search
            </button>
          </div>
        </div>

        {/* Tickets Table */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-600"></div>
            </div>
          ) : tickets.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 text-lg">No tickets found</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Agent</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Telegram</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Problem</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Submitter</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Created</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {tickets.map((ticket) => (
                      <tr key={ticket.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="text-sm font-medium text-gray-900">{ticket.agentName}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm text-gray-900">{ticket.telegramUsername}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm text-gray-900 max-w-xs truncate">{ticket.problemDescription}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm text-gray-900">{ticket.submitter.fullName}</div>
                          <div className="text-xs text-gray-500">{ticket.submitter.role}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(ticket.status)}`}>
                            {getStatusLabel(ticket.status)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm text-gray-900">{new Date(ticket.createdAt).toLocaleDateString()}</div>
                          <div className="text-xs text-gray-500">{new Date(ticket.createdAt).toLocaleTimeString()}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <button
                              onClick={() => navigate(`/it-tickets/${ticket.id}`)}
                              className="text-cyan-600 hover:text-cyan-800 text-xs font-semibold"
                            >
                              View
                            </button>
                            {ticket.status === 'Pending' && (
                              <button
                                onClick={() => handleStatusChange(ticket.id, 'UnderReview')}
                                className="text-blue-600 hover:text-blue-800 text-xs font-semibold"
                              >
                                Start
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {pagination.totalPages > 1 && (
                <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
                  <div className="text-sm text-gray-700">
                    Showing page {pagination.page} of {pagination.totalPages} ({pagination.total} total tickets)
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                      disabled={pagination.page === 1}
                      className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                      disabled={pagination.page === pagination.totalPages}
                      className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default ITDashboard;
