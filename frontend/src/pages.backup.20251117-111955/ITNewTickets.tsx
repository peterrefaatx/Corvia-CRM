import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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

const ITNewTickets: React.FC = () => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [tickets, setTickets] = useState<ITTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [hasNewTickets, setHasNewTickets] = useState(false);
  const [lastTicketCount, setLastTicketCount] = useState(0);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0
  });

  useEffect(() => {
    if (user?.role !== 'IT') {
      navigate('/');
      return;
    }
    loadTickets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, navigate, pagination.page]);

  // Auto-refresh polling every 15 seconds
  useEffect(() => {
    if (user?.role !== 'IT') return;

    const interval = setInterval(() => {
      checkForNewTickets();
    }, 15000); // 15 seconds

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, lastTicketCount, searchTerm, pagination.page]);

  const loadTickets = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        status: 'Pending,UnderReview'
      });
      
      if (searchTerm) {
        params.append('search', searchTerm);
      }
      
      const response = await api.get(`/it-tickets?${params.toString()}`);
      setTickets(response.data.tickets);
      setPagination(response.data.pagination);
      setLastTicketCount(response.data.pagination.total);
      setHasNewTickets(false);
    } catch (error) {
      console.error('Failed to load tickets:', error);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const playNotificationSound = () => {
    try {
      // Create audio context
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // First tone (higher pitch)
      const oscillator1 = audioContext.createOscillator();
      const gainNode1 = audioContext.createGain();
      
      oscillator1.connect(gainNode1);
      gainNode1.connect(audioContext.destination);
      
      oscillator1.frequency.value = 1000; // Hz
      oscillator1.type = 'sine';
      
      gainNode1.gain.setValueAtTime(0, audioContext.currentTime);
      gainNode1.gain.linearRampToValueAtTime(0.4, audioContext.currentTime + 0.05);
      gainNode1.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.2);
      
      oscillator1.start(audioContext.currentTime);
      oscillator1.stop(audioContext.currentTime + 0.2);
      
      // Second tone (lower pitch) - plays after first
      const oscillator2 = audioContext.createOscillator();
      const gainNode2 = audioContext.createGain();
      
      oscillator2.connect(gainNode2);
      gainNode2.connect(audioContext.destination);
      
      oscillator2.frequency.value = 800; // Hz
      oscillator2.type = 'sine';
      
      gainNode2.gain.setValueAtTime(0, audioContext.currentTime + 0.15);
      gainNode2.gain.linearRampToValueAtTime(0.4, audioContext.currentTime + 0.2);
      gainNode2.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.4);
      
      oscillator2.start(audioContext.currentTime + 0.15);
      oscillator2.stop(audioContext.currentTime + 0.4);
    } catch (error) {
      console.error('Failed to play notification sound:', error);
    }
  };

  const checkForNewTickets = async () => {
    try {
      const params = new URLSearchParams({
        page: '1',
        limit: '1',
        status: 'Pending,UnderReview'
      });
      
      if (searchTerm) {
        params.append('search', searchTerm);
      }
      
      const response = await api.get(`/it-tickets?${params.toString()}`);
      const currentTotal = response.data.pagination.total;
      
      // Show notification if ticket count increased (including from 0 to 1+)
      if (currentTotal > lastTicketCount) {
        setHasNewTickets(true);
        playNotificationSound();
      }
    } catch (error) {
      console.error('Failed to check for new tickets:', error);
    }
  };

  const handleRefresh = () => {
    loadTickets();
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
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: string) => {
    return status === 'UnderReview' ? 'Under Review' : status;
  };

  const stats = {
    pending: tickets.filter(t => t.status === 'Pending').length,
    underReview: tickets.filter(t => t.status === 'UnderReview').length
  };

  return (
    <Layout>
      <div className="py-8 px-4 sm:px-6 lg:px-8" style={{ backgroundColor: '#f7f6f5' }}>
        {/* New Tickets Notification Banner */}
        {hasNewTickets && (
          <div className="mb-6 bg-emerald-50 border-l-4 border-emerald-500 p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <svg className="h-6 w-6 text-emerald-600 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                <div>
                  <p className="text-emerald-800 font-bold">New Tickets Available!</p>
                  <p className="text-emerald-600 text-sm">Click refresh to see the latest tickets</p>
                </div>
              </div>
              <button
                onClick={handleRefresh}
                className="bg-emerald-600 text-white px-4 py-2 text-sm font-medium hover:bg-emerald-700 transition-colors shadow-sm"
              >
                Refresh Now
              </button>
            </div>
          </div>
        )}

        {/* Tickets Table */}
        <div className="glass border border-neutral-200/30 overflow-hidden shadow-sm">
          {/* Table Header */}
          <div className="px-6 py-4 bg-white/50 border-b border-neutral-200/50 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-neutral-900" style={{ letterSpacing: '-0.01em' }}>
              Tickets
            </h2>
            <button
              onClick={handleRefresh}
              className="p-2 rounded-full text-gray-600 hover:bg-gray-100 transition-colors"
              title="Refresh tickets"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-600"></div>
            </div>
          ) : tickets.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-gray-500 text-lg font-semibold">No new tickets found</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead className="bg-white/50">
                    <tr>
                      <th className="px-6 py-3 text-xs font-medium text-neutral-600 uppercase tracking-wider" style={{ letterSpacing: '0.05em' }}>
                        <div className="text-center">Agent</div>
                      </th>
                      <th className="px-6 py-3 text-xs font-medium text-neutral-600 uppercase tracking-wider" style={{ letterSpacing: '0.05em' }}>
                        <div className="text-center">Telegram</div>
                      </th>
                      <th className="px-6 py-3 text-xs font-medium text-neutral-600 uppercase tracking-wider" style={{ letterSpacing: '0.05em' }}>
                        <div className="text-center">Problem</div>
                      </th>
                      <th className="px-6 py-3 text-xs font-medium text-neutral-600 uppercase tracking-wider" style={{ letterSpacing: '0.05em' }}>
                        <div className="text-center">Submitter</div>
                      </th>
                      <th className="px-6 py-3 text-xs font-medium text-neutral-600 uppercase tracking-wider" style={{ letterSpacing: '0.05em' }}>
                        <div className="text-center">Status</div>
                      </th>
                      <th className="px-6 py-3 text-xs font-medium text-neutral-600 uppercase tracking-wider" style={{ letterSpacing: '0.05em' }}>
                        <div className="text-center">Created</div>
                      </th>
                      <th className="px-6 py-3 text-xs font-medium text-neutral-600 uppercase tracking-wider" style={{ letterSpacing: '0.05em' }}>
                        <div className="text-center">Actions</div>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white/30">
                    {tickets.map((ticket) => (
                      <tr key={ticket.id}>
                        <td className="px-6 py-3 whitespace-nowrap text-center">
                          <div className="text-sm font-medium text-neutral-900">{ticket.agentName}</div>
                        </td>
                        <td className="px-6 py-3 whitespace-nowrap text-center">
                          <div className="text-sm text-neutral-900">{ticket.telegramUsername}</div>
                        </td>
                        <td className="px-6 py-3 text-center">
                          <div className="text-sm text-gray-700 max-w-xs truncate">{ticket.problemDescription}</div>
                        </td>
                        <td className="px-6 py-3 whitespace-nowrap text-center">
                          <div className="text-sm font-medium text-neutral-900">{ticket.submitter.fullName}</div>
                          <div className="text-xs text-gray-500">{ticket.submitter.role}</div>
                        </td>
                        <td className="px-6 py-3 whitespace-nowrap text-center">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(ticket.status)}`}>
                            {getStatusLabel(ticket.status)}
                          </span>
                        </td>
                        <td className="px-6 py-3 whitespace-nowrap text-center">
                          <div className="text-sm text-gray-700">{new Date(ticket.createdAt).toLocaleDateString()}</div>
                          <div className="text-xs text-gray-500">{new Date(ticket.createdAt).toLocaleTimeString()}</div>
                        </td>
                        <td className="px-6 py-3 whitespace-nowrap">
                          <div className="flex gap-2 justify-center items-center">
                            <button
                              onClick={() => navigate(`/it-tickets/${ticket.id}`)}
                              className="text-cyan-600 hover:text-cyan-800 text-xs font-medium"
                            >
                              View
                            </button>
                            {ticket.status === 'Pending' && (
                              <button
                                onClick={() => handleStatusChange(ticket.id, 'UnderReview')}
                                className="text-blue-600 hover:text-blue-800 text-xs font-medium"
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
                <div className="px-6 py-4 bg-white/50 flex items-center justify-between">
                  <div className="text-sm text-gray-600">
                    Page {pagination.page} of {pagination.totalPages} • {pagination.total} total tickets
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                      disabled={pagination.page === 1}
                      className="px-4 py-2 border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                      disabled={pagination.page === pagination.totalPages}
                      className="px-4 py-2 border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
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

export default ITNewTickets;
