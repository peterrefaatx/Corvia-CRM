import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout/Layout';
import { useAuth } from '../contexts/AuthContext';
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
  assignedIT?: {
    id: string;
    fullName: string;
    username: string;
  };
  responses: Array<{
    id: string;
    responseText: string;
    createdAt: string;
    user: {
      id: string;
      fullName: string;
      username: string;
    };
  }>;
}

const MyITTickets: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tickets, setTickets] = useState<ITTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('All');
  const [selectedDate, setSelectedDate] = useState<string>('today');

  useEffect(() => {
    if (!['TeamLeader', 'AccountManager'].includes(user?.role || '')) {
      navigate('/');
      return;
    }
    loadTickets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, navigate, statusFilter, selectedDate]);

  const loadTickets = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter !== 'All') {
        params.append('status', statusFilter);
      }
      
      // Add date filter
      if (selectedDate === 'today') {
        // Use today's date for filtering
        params.append('date', new Date().toISOString().split('T')[0]);
      } else if (selectedDate && selectedDate !== 'all') {
        // Use selected date
        params.append('date', selectedDate);
      }
      // If selectedDate is 'all' or empty, don't add date param (show all tickets)
      
      const response = await api.get(`/it-tickets/my-tickets?${params.toString()}`);
      setTickets(response.data.tickets);
    } catch (error) {
      console.error('Failed to load tickets:', error);
    } finally {
      setLoading(false);
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

  const filteredTickets = tickets;
  const stats = {
    all: tickets.length,
    pending: tickets.filter(t => t.status === 'Pending').length,
    underReview: tickets.filter(t => t.status === 'UnderReview').length,
    solved: tickets.filter(t => t.status === 'Solved').length,
    notSolved: tickets.filter(t => t.status === 'NotSolved').length
  };

  const getDateLabel = () => {
    if (selectedDate === 'today') return 'Today';
    if (!selectedDate || selectedDate === 'all') return 'All Time';
    return new Date(selectedDate).toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  return (
    <Layout>
      <div className="py-8 px-4 sm:px-6 lg:px-8" style={{ backgroundColor: '#f7f6f5' }}>
        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-between items-center">
            {/* Date Filter */}
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium text-gray-700">Select Date:</label>
              <input
                type="date"
                value={selectedDate === 'today' || selectedDate === 'all' ? '' : selectedDate}
                onChange={(e) => setSelectedDate(e.target.value || 'all')}
                className="px-3 py-2 border border-gray-300 shadow-sm focus:border-cyan-500 focus:ring-cyan-500 text-sm"
              />
              {selectedDate !== 'today' && (
                <button
                  onClick={() => setSelectedDate('today')}
                  className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 shadow-sm transition-colors"
                >
                  Reset to Today
                </button>
              )}
            </div>
            
            <button
              onClick={() => navigate('/submit-it-ticket')}
              className="bg-cyan-600 hover:bg-cyan-700 text-white px-6 py-3 text-sm font-medium shadow-sm transition-colors"
            >
              + New Ticket
            </button>
          </div>
        </div>

        {/* Date Label */}
        <div className="mb-4">
          <p className="text-sm text-gray-600">
            Showing tickets for: <span className="font-semibold text-gray-900">{getDateLabel()}</span>
          </p>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-5 gap-4 mb-6">
          <div
            onClick={() => setStatusFilter('All')}
            className={`cursor-pointer glass border border-neutral-200/30 p-4 shadow-sm transition-all ${
              statusFilter === 'All' ? 'ring-2 ring-cyan-500' : ''
            }`}
          >
            <div className="text-gray-600 text-xs font-medium mb-1 uppercase tracking-wider" style={{ letterSpacing: '0.05em' }}>All Tickets</div>
            <div className="text-gray-900 text-2xl font-bold">{stats.all}</div>
          </div>
          <div
            onClick={() => setStatusFilter('Pending')}
            className={`cursor-pointer glass border border-neutral-200/30 p-4 shadow-sm transition-all ${
              statusFilter === 'Pending' ? 'ring-2 ring-cyan-500' : ''
            }`}
          >
            <div className="text-gray-600 text-xs font-medium mb-1 uppercase tracking-wider" style={{ letterSpacing: '0.05em' }}>Pending</div>
            <div className="text-gray-900 text-2xl font-bold">{stats.pending}</div>
          </div>
          <div
            onClick={() => setStatusFilter('UnderReview')}
            className={`cursor-pointer glass border border-neutral-200/30 p-4 shadow-sm transition-all ${
              statusFilter === 'UnderReview' ? 'ring-2 ring-cyan-500' : ''
            }`}
          >
            <div className="text-gray-600 text-xs font-medium mb-1 uppercase tracking-wider" style={{ letterSpacing: '0.05em' }}>Under Review</div>
            <div className="text-gray-900 text-2xl font-bold">{stats.underReview}</div>
          </div>
          <div
            onClick={() => setStatusFilter('Solved')}
            className={`cursor-pointer glass border border-neutral-200/30 p-4 shadow-sm transition-all ${
              statusFilter === 'Solved' ? 'ring-2 ring-cyan-500' : ''
            }`}
          >
            <div className="text-gray-600 text-xs font-medium mb-1 uppercase tracking-wider" style={{ letterSpacing: '0.05em' }}>Solved</div>
            <div className="text-gray-900 text-2xl font-bold">{stats.solved}</div>
          </div>
          <div
            onClick={() => setStatusFilter('NotSolved')}
            className={`cursor-pointer glass border border-neutral-200/30 p-4 shadow-sm transition-all ${
              statusFilter === 'NotSolved' ? 'ring-2 ring-cyan-500' : ''
            }`}
          >
            <div className="text-gray-600 text-xs font-medium mb-1 uppercase tracking-wider" style={{ letterSpacing: '0.05em' }}>Not Solved</div>
            <div className="text-gray-900 text-2xl font-bold">{stats.notSolved}</div>
          </div>
        </div>

        {/* Tickets List */}
        <div className="glass border border-neutral-200/30 shadow-sm">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-600"></div>
            </div>
          ) : filteredTickets.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-gray-700 text-lg font-semibold">No tickets found</p>
              <p className="text-gray-500 mt-2">Submit your first IT support ticket to get started</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {filteredTickets.map((ticket) => (
                <div key={ticket.id} className="p-6 hover:bg-white/50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900">{ticket.agentName}</h3>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(ticket.status)}`}>
                          {getStatusLabel(ticket.status)}
                        </span>
                      </div>
                      
                      <p className="text-sm text-gray-600 mb-2">
                        <span className="font-medium">Telegram:</span> {ticket.telegramUsername}
                      </p>
                      
                      <p className="text-sm text-gray-900 mb-3 line-clamp-2">{ticket.problemDescription}</p>
                      
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span>Created: {new Date(ticket.createdAt).toLocaleString()}</span>
                        {ticket.assignedIT && (
                          <span>Assigned to: {ticket.assignedIT.fullName}</span>
                        )}
                        {ticket.responses.length > 0 && (
                          <span>{ticket.responses.length} response{ticket.responses.length !== 1 ? 's' : ''}</span>
                        )}
                        {ticket.resolvedAt && (
                          <span>Resolved: {new Date(ticket.resolvedAt).toLocaleString()}</span>
                        )}
                      </div>
                    </div>
                    
                    <button
                      onClick={() => navigate(`/it-tickets/${ticket.id}`)}
                      className="ml-4 inline-flex items-center px-3 py-1.5 bg-cyan-600 text-white hover:bg-cyan-700 text-xs font-medium shadow-sm transition-colors"
                    >
                      View Details
                    </button>
                  </div>
                  
                  {/* Latest Response Preview */}
                  {ticket.responses.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <p className="text-xs font-semibold text-gray-700 mb-1">Latest Response:</p>
                      <div className="bg-white/50 p-3">
                        <p className="text-xs text-gray-600 mb-1">
                          {ticket.responses[ticket.responses.length - 1].user.fullName} - {new Date(ticket.responses[ticket.responses.length - 1].createdAt).toLocaleString()}
                        </p>
                        <p className="text-sm text-gray-900 line-clamp-2">
                          {ticket.responses[ticket.responses.length - 1].responseText}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default MyITTickets;
