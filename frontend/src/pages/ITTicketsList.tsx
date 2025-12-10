import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout/Layout';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import { usePageTitle } from '../hooks/usePageTitle';

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
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const ITTicketsList: React.FC = () => {
  usePageTitle('Tickets List');
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tickets, setTickets] = useState<ITTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string>(''); // Keep blank for calendar
  const [activeDate, setActiveDate] = useState<string>(''); // Actual date used for filtering
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0
  });

  // Get today's date in YYYY-MM-DD format (considering 4 AM cutoff)
  const getTodayDate = () => {
    const now = new Date();
    const hour = now.getHours();
    
    // If before 4 AM, use previous day
    if (hour < 4) {
      now.setDate(now.getDate() - 1);
    }
    
    return now.toISOString().split('T')[0];
  };

  useEffect(() => {
    if (user?.role !== 'IT') {
      navigate('/');
      return;
    }
    // Set today as active date (but keep calendar blank)
    setActiveDate(getTodayDate());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, navigate]);

  useEffect(() => {
    if (activeDate) {
      loadTickets();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDate, pagination.page]);

  const loadTickets = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        status: 'Solved,NotSolved',
        date: activeDate
      });
      
      const response = await api.get(`/it-tickets?${params.toString()}`);
      setTickets(response.data.tickets);
      setPagination(response.data.pagination);
    } catch (error) {
      console.error('Failed to load tickets:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Solved': return 'bg-green-100 text-green-800 border border-green-200';
      case 'NotSolved': return 'bg-red-100 text-red-800 border border-red-200';
      default: return 'bg-gray-100 text-gray-800 border border-gray-200';
    }
  };

  const getStatusLabel = (status: string) => {
    return status === 'NotSolved' ? 'Not Solved' : status;
  };

  const stats = {
    solved: tickets.filter(t => t.status === 'Solved').length,
    notSolved: tickets.filter(t => t.status === 'NotSolved').length
  };

  return (
    <Layout>
      <div className="py-4 px-4 sm:px-6 lg:px-8" style={{ backgroundColor: '#F5F5F5' }}>
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Tickets List</h1>
        </div>

        {/* Statistics Cards */}
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

        {/* Tickets Table */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          {/* Table Header with Date Filter */}
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-700">Resolved Tickets</h3>
            <div className="flex items-center gap-3">
              <label className="text-xs font-medium text-gray-600">
                {selectedDate ? 'Selected:' : 'Today'}
              </label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => {
                  setSelectedDate(e.target.value);
                  setActiveDate(e.target.value);
                  setPagination(prev => ({ ...prev, page: 1 }));
                }}
                max={getTodayDate()}
                placeholder="Select date..."
                className="px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-cyan-500"
              />
              {selectedDate && (
                <button
                  onClick={() => {
                    setSelectedDate('');
                    setActiveDate(getTodayDate());
                    setPagination(prev => ({ ...prev, page: 1 }));
                  }}
                  className="px-3 py-1 bg-gray-600 text-white rounded hover:bg-gray-700 font-medium text-xs"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
          {loading ? (
            <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#fafafa' }}><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>
          ) : tickets.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 text-lg">No resolved tickets found for this date</p>
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
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Resolved</th>
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
                          {ticket.resolvedAt ? (
                            <>
                              <div className="text-sm text-gray-900">{new Date(ticket.resolvedAt).toLocaleDateString()}</div>
                              <div className="text-xs text-gray-500">{new Date(ticket.resolvedAt).toLocaleTimeString()}</div>
                            </>
                          ) : (
                            <div className="text-sm text-gray-500">-</div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => navigate(`/it-tickets/${ticket.id}`)}
                            className="text-cyan-600 hover:text-cyan-800 text-xs font-semibold"
                          >
                            View
                          </button>
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

export default ITTicketsList;




