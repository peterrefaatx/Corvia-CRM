import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
  statusHistory: Array<{
    id: string;
    fromStatus?: string;
    toStatus: string;
    createdAt: string;
    user: {
      id: string;
      fullName: string;
      username: string;
    };
  }>;
}

const ITTicketDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [ticket, setTicket] = useState<ITTicket | null>(null);
  const [loading, setLoading] = useState(true);
  const [responseText, setResponseText] = useState('');
  const [submittingResponse, setSubmittingResponse] = useState(false);

  useEffect(() => {
    loadTicket();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const loadTicket = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/it-tickets/${id}`);
      setTicket(response.data.ticket);
    } catch (error: any) {
      console.error('Failed to load ticket:', error);
      if (error?.response?.status === 403 || error?.response?.status === 404) {
        showToast('Ticket not found or you do not have permission to view it', 'error');
        navigate('/');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!ticket) return;
    
    try {
      await api.put(`/it-tickets/${ticket.id}/status`, { status: newStatus });
      loadTicket();
    } catch (error: any) {
      showToast(error?.response?.data?.error || error?.response?.data?.message || 'Failed to update status', 'error');
    }
  };

  const handleAddResponse = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!ticket || !responseText.trim() || responseText.trim().length < 5) {
      showToast('Response must be at least 5 characters', 'error');
      return;
    }
    
    try {
      setSubmittingResponse(true);
      await api.post(`/it-tickets/${ticket.id}/responses`, {
        responseText: responseText.trim()
      });
      setResponseText('');
      loadTicket();
    } catch (error: any) {
      showToast(error?.response?.data?.error || 'Failed to add response', 'error');
    } finally {
      setSubmittingResponse(false);
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

  const isIT = user?.role === 'IT';
  const canUpdateStatus = isIT && ticket && !['Solved', 'NotSolved'].includes(ticket.status);

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-600"></div>
        </div>
      </Layout>
    );
  }

  if (!ticket) {
    return (
      <Layout>
        <div className="py-6 px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <p className="text-gray-500">Ticket not found</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="py-8 px-4 sm:px-6 lg:px-8" style={{ backgroundColor: '#f7f6f5' }}>
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="mb-8 flex items-center justify-between">
            <div>
              <button
                onClick={() => navigate(-1)}
                className="text-cyan-600 hover:text-cyan-800 text-sm font-medium mb-3 flex items-center gap-1"
              >
                ← Back
              </button>
              <h1 className="text-2xl font-bold text-slate-800 tracking-tight">IT Ticket Details</h1>
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(ticket.status)}`}>
              {getStatusLabel(ticket.status)}
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-6">
              {/* Ticket Information */}
              <div className="bg-white shadow-sm border border-gray-100 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Ticket Information</h2>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Agent Name</label>
                    <p className="text-gray-900">{ticket.agentName}</p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Telegram Username</label>
                    <p className="text-gray-900">{ticket.telegramUsername}</p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Problem Description</label>
                    <p className="text-gray-900 whitespace-pre-wrap">{ticket.problemDescription}</p>
                  </div>
                </div>
              </div>

              {/* Status Update (IT only) */}
              {canUpdateStatus && (
                <div className="bg-white shadow-sm border border-gray-100 p-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Update Status</h2>
                  <div className="flex gap-3">
                    {ticket.status === 'Pending' && (
                      <button
                        onClick={() => handleStatusChange('UnderReview')}
                        className="px-6 py-2 bg-blue-600 text-white hover:bg-blue-700 font-medium shadow-sm"
                      >
                        Mark as Under Review
                      </button>
                    )}
                    {ticket.status === 'UnderReview' && (
                      <>
                        <button
                          onClick={() => handleStatusChange('Solved')}
                          className="px-6 py-2 bg-green-600 text-white hover:bg-green-700 font-medium shadow-sm"
                        >
                          Mark as Solved
                        </button>
                        <button
                          onClick={() => handleStatusChange('NotSolved')}
                          className="px-6 py-2 bg-red-600 text-white hover:bg-red-700 font-medium shadow-sm"
                        >
                          Mark as Not Solved
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Responses */}
              <div className="bg-white shadow-sm border border-gray-100 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Responses ({ticket.responses.length})</h2>
                
                {ticket.responses.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No responses yet</p>
                ) : (
                  <div className="space-y-4">
                    {ticket.responses.map((response) => (
                      <div key={response.id} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <p className="font-semibold text-gray-900">{response.user.fullName}</p>
                            <p className="text-xs text-gray-500">@{response.user.username}</p>
                          </div>
                          <p className="text-xs text-gray-500">
                            {new Date(response.createdAt).toLocaleString()}
                          </p>
                        </div>
                        <p className="text-gray-900 whitespace-pre-wrap">{response.responseText}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Add Response Form (IT only) */}
              {isIT && (
                <div className="bg-white shadow-sm border border-gray-100 p-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Add Response</h2>
                  <form onSubmit={handleAddResponse}>
                    <textarea
                      value={responseText}
                      onChange={(e) => setResponseText(e.target.value)}
                      placeholder="Type your response here..."
                      rows={4}
                      className="w-full px-4 py-3 border border-gray-300 focus:border-cyan-500 focus:ring-cyan-500 mb-3"
                    />
                    <p className="text-xs text-gray-500 mb-3">Minimum 5 characters</p>
                    <button
                      type="submit"
                      disabled={submittingResponse || responseText.trim().length < 5}
                      className="px-6 py-2 bg-cyan-600 text-white hover:bg-cyan-700 font-medium shadow-sm disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                      {submittingResponse ? 'Adding...' : 'Add Response'}
                    </button>
                  </form>
                </div>
              )}
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Ticket Meta */}
              <div className="bg-white shadow-sm border border-gray-100 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Ticket Details</h3>
                
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Ticket ID</label>
                    <p className="text-sm text-gray-900 font-mono">{ticket.id.slice(0, 8)}...</p>
                  </div>
                  
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Submitted By</label>
                    <p className="text-sm text-gray-900">{ticket.submitter.fullName}</p>
                    <p className="text-xs text-gray-500">{ticket.submitter.role}</p>
                  </div>
                  
                  {ticket.assignedIT && (
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1">Assigned To</label>
                      <p className="text-sm text-gray-900">{ticket.assignedIT.fullName}</p>
                    </div>
                  )}
                  
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Created</label>
                    <p className="text-sm text-gray-900">{new Date(ticket.createdAt).toLocaleString()}</p>
                  </div>
                  
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Last Updated</label>
                    <p className="text-sm text-gray-900">{new Date(ticket.updatedAt).toLocaleString()}</p>
                  </div>
                  
                  {ticket.resolvedAt && (
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1">Resolved</label>
                      <p className="text-sm text-gray-900">{new Date(ticket.resolvedAt).toLocaleString()}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Status Timeline */}
              <div className="bg-white shadow-sm border border-gray-100 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Status History</h3>
                
                <div className="space-y-3">
                  {ticket.statusHistory.map((history, index) => (
                    <div key={history.id} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className={`w-3 h-3 rounded-full ${index === 0 ? 'bg-cyan-600' : 'bg-gray-300'}`}></div>
                        {index < ticket.statusHistory.length - 1 && (
                          <div className="w-0.5 h-full bg-gray-300 my-1"></div>
                        )}
                      </div>
                      <div className="flex-1 pb-4">
                        <p className="text-sm font-semibold text-gray-900">
                          {getStatusLabel(history.toStatus)}
                        </p>
                        <p className="text-xs text-gray-500">{history.user.fullName}</p>
                        <p className="text-xs text-gray-500">{new Date(history.createdAt).toLocaleString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default ITTicketDetails;
