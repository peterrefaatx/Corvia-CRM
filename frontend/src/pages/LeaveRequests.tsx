import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout/Layout';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import { usePageTitle } from '../hooks/usePageTitle';

interface LeaveRequest {
  id: string;
  startDate: string;
  endDate: string;
  type: 'Vacation' | 'Sick' | 'Other';
  reason: string;
  status: 'Pending' | 'Approved' | 'Declined';
  createdAt: string;
  user: {
    id: string;
    fullName: string;
    username: string;
    role: string;
  };
  manager?: {
    id: string;
    fullName: string;
    username: string;
  };
}

interface LeaveForm {
  startDate: string;
  endDate: string;
  type: 'Vacation' | 'Sick' | 'Other' | '';
  reason: string;
}

const LeaveRequests: React.FC = () => {
  usePageTitle('Leave Requests');
  const { user } = useAuth();
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string>('');

  const [createForm, setCreateForm] = useState<LeaveForm>({
    startDate: '',
    endDate: '',
    type: '',
    reason: ''
  });

  useEffect(() => {
    loadLeaveRequests();
  }, []);

  const loadLeaveRequests = async () => {
    try {
      setError('');
      const response = await api.get('/leave-requests');
      setLeaveRequests(response.data);
    } catch (error) {
      console.error('Failed to load leave requests:', error);
      setError('Failed to load leave requests. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!createForm.startDate || !createForm.endDate || !createForm.type || !createForm.reason.trim()) {
      setError('Please fill in all fields');
      return;
    }

    setActionLoading('create');
    setError('');
    try {
      await api.post('/leave-requests', createForm);
      
      await loadLeaveRequests();
      setShowCreateModal(false);
      setCreateForm({ startDate: '', endDate: '', type: '', reason: '' });
      setError('Leave request submitted successfully!');
      setTimeout(() => setError(''), 3000);
    } catch (error: any) {
      console.error('Failed to create leave request:', error);
      const errorMessage = error.response?.data?.error || 'Failed to create leave request';
      setError(errorMessage);
    } finally {
      setActionLoading(null);
    }
  };

  const handleUpdateStatus = async (id: string, status: 'Approved' | 'Declined') => {
    setActionLoading(`status-${id}`);
    setError('');
    try {
      await api.patch(`/leave-requests/${id}/status`, { status });
      
      await loadLeaveRequests();
      setError(`Leave request ${status.toLowerCase()} successfully!`);
      setTimeout(() => setError(''), 3000);
    } catch (error: any) {
      console.error('Failed to update status:', error);
      const errorMessage = error.response?.data?.error || 'Failed to update status';
      setError(errorMessage);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteRequest = async (id: string) => {
    if (!confirm('Are you sure you want to delete this leave request?')) return;

    setActionLoading(`delete-${id}`);
    setError('');
    try {
      await api.delete(`/leave-requests/${id}`);
      
      await loadLeaveRequests();
      setError('Leave request deleted successfully!');
      setTimeout(() => setError(''), 3000);
    } catch (error: any) {
      console.error('Failed to delete leave request:', error);
      const errorMessage = error.response?.data?.error || 'Failed to delete leave request';
      setError(errorMessage);
    } finally {
      setActionLoading(null);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getDaysDifference = (start: string, end: string) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return diffDays;
  };

  if (loading) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#fafafa' }}><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="py-8 px-4 sm:px-6 lg:px-8" style={{ backgroundColor: '#f7f6f5' }}>
        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-end items-center">
            {user?.role !== 'Manager' && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-hover transition-all duration-200 shadow-sm hover:shadow"
              >
                Request Leave
              </button>
            )}
          </div>
        </div>

        {/* Error/Success Message */}
        {error && (
          <div className={`mb-6 p-4 shadow-sm ${
            error.includes('successfully') 
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
              : 'bg-red-50 border border-red-200 text-red-700'
          }`}>
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">{error}</p>
              <button 
                onClick={() => setError('')}
                className="text-lg hover:opacity-70"
              >
                ×
              </button>
            </div>
          </div>
        )}

        {/* Leave Requests Table */}
        <div className="glass border border-neutral-200/30 overflow-hidden shadow-sm">
          <table className="min-w-full">
            <thead className="bg-white/50">
              <tr>
                {user?.role === 'Manager' && (
                  <th className="px-6 py-3 text-xs font-medium text-neutral-600 uppercase tracking-wider" style={{ letterSpacing: '0.05em' }}>
                    <div className="text-center">Employee</div>
                  </th>
                )}
                <th className="px-6 py-3 text-xs font-medium text-neutral-600 uppercase tracking-wider" style={{ letterSpacing: '0.05em' }}>
                  <div className="text-center">Type</div>
                </th>
                <th className="px-6 py-3 text-xs font-medium text-neutral-600 uppercase tracking-wider" style={{ letterSpacing: '0.05em' }}>
                  <div className="text-center">Start Date</div>
                </th>
                <th className="px-6 py-3 text-xs font-medium text-neutral-600 uppercase tracking-wider" style={{ letterSpacing: '0.05em' }}>
                  <div className="text-center">End Date</div>
                </th>
                <th className="px-6 py-3 text-xs font-medium text-neutral-600 uppercase tracking-wider" style={{ letterSpacing: '0.05em' }}>
                  <div className="text-center">Days</div>
                </th>
                <th className="px-6 py-3 text-xs font-medium text-neutral-600 uppercase tracking-wider" style={{ letterSpacing: '0.05em' }}>
                  <div className="text-center">Reason</div>
                </th>
                <th className="px-6 py-3 text-xs font-medium text-neutral-600 uppercase tracking-wider" style={{ letterSpacing: '0.05em' }}>
                  <div className="text-center">Status</div>
                </th>
                {user?.role === 'Manager' && (
                  <th className="px-6 py-3 text-xs font-medium text-neutral-600 uppercase tracking-wider" style={{ letterSpacing: '0.05em' }}>
                    <div className="text-center">Actions</div>
                  </th>
                )}
                {user?.role !== 'Manager' && (
                  <th className="px-6 py-3 text-xs font-medium text-neutral-600 uppercase tracking-wider" style={{ letterSpacing: '0.05em' }}>
                    <div className="text-center">Actions</div>
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white/30">
              {leaveRequests.map((request) => (
                <tr key={request.id}>
                  {user?.role === 'Manager' && (
                    <td className="px-6 py-3 whitespace-nowrap text-center">
                      <div className="text-sm font-medium text-neutral-900">{request.user.fullName}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{request.user.role}</div>
                    </td>
                  )}
                  <td className="px-6 py-3 whitespace-nowrap text-center">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                      request.type === 'Vacation' ? 'bg-cyan-100 text-cyan-800 border-cyan-200' :
                      request.type === 'Sick' ? 'bg-red-100 text-red-800 border-red-200' :
                      'bg-gray-100 text-gray-800 border-gray-200'
                    }`}>
                      {request.type}
                    </span>
                  </td>
                  <td className="px-6 py-3 whitespace-nowrap text-center text-sm text-gray-700">
                    {formatDate(request.startDate)}
                  </td>
                  <td className="px-6 py-3 whitespace-nowrap text-center text-sm text-gray-700">
                    {formatDate(request.endDate)}
                  </td>
                  <td className="px-6 py-3 whitespace-nowrap text-center text-sm font-medium text-gray-900">
                    {getDaysDifference(request.startDate, request.endDate)}
                  </td>
                  <td className="px-6 py-3 text-center text-sm text-gray-600 max-w-xs truncate">
                    {request.reason}
                  </td>
                  <td className="px-6 py-3 whitespace-nowrap text-center">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                      request.status === 'Approved' ? 'bg-green-100 text-green-800 border-green-200' :
                      request.status === 'Declined' ? 'bg-red-100 text-red-800 border-red-200' :
                      'bg-yellow-100 text-yellow-800 border-yellow-200'
                    }`}>
                      {request.status}
                    </span>
                  </td>
                  <td className="px-6 py-3 whitespace-nowrap text-center text-sm font-medium">
                    {user?.role === 'Manager' && request.status === 'Pending' && (
                      <div className="flex justify-center space-x-2">
                        <button
                          onClick={() => handleUpdateStatus(request.id, 'Approved')}
                          disabled={actionLoading === `status-${request.id}`}
                          className="px-3 py-1.5 text-xs font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors disabled:opacity-50"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleUpdateStatus(request.id, 'Declined')}
                          disabled={actionLoading === `status-${request.id}`}
                          className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50"
                        >
                          Decline
                        </button>
                      </div>
                    )}
                    {user?.role !== 'Manager' && request.status === 'Pending' && request.user.id === user?.id && (
                      <button
                        onClick={() => handleDeleteRequest(request.id)}
                        disabled={actionLoading === `delete-${request.id}`}
                        className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50"
                      >
                        Delete
                      </button>
                    )}
                    {request.status !== 'Pending' && request.manager && (
                      <div className="text-xs text-gray-500">
                        By {request.manager.fullName}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {leaveRequests.length === 0 && !loading && (
          <div className="text-center py-16 glass border border-neutral-200/30">
            <p className="text-gray-700 text-lg font-semibold">No leave requests found</p>
            <p className="text-gray-500 mt-2">Create your first leave request to get started</p>
          </div>
        )}

        {/* Create Leave Request Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
            <div className="relative mx-auto w-full max-w-lg bg-white shadow-lg border border-gray-200">
              <div className="p-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-6">Request Leave</h3>
                
                <form onSubmit={handleCreateRequest} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Leave Type *</label>
                    <select
                      value={createForm.type}
                      onChange={(e) => setCreateForm({...createForm, type: e.target.value as any})}
                      className="block w-full px-3 py-2 border border-gray-300 shadow-sm focus:border-primary500 focus:ring-primary500 text-sm"
                      required
                    >
                      <option value="">Select type</option>
                      <option value="Vacation">Vacation</option>
                      <option value="Sick">Sick Leave</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Start Date *</label>
                    <input
                      type="date"
                      value={createForm.startDate}
                      onChange={(e) => setCreateForm({...createForm, startDate: e.target.value})}
                      className="block w-full px-3 py-2 border border-gray-300 shadow-sm focus:border-primary500 focus:ring-primary500 text-sm"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">End Date *</label>
                    <input
                      type="date"
                      value={createForm.endDate}
                      onChange={(e) => setCreateForm({...createForm, endDate: e.target.value})}
                      className="block w-full px-3 py-2 border border-gray-300 shadow-sm focus:border-primary500 focus:ring-primary500 text-sm"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Reason *</label>
                    <textarea
                      value={createForm.reason}
                      onChange={(e) => setCreateForm({...createForm, reason: e.target.value})}
                      rows={3}
                      className="block w-full px-3 py-2 border border-gray-300 shadow-sm focus:border-primary500 focus:ring-primary500 text-sm"
                      placeholder="Please provide a reason for your leave request"
                      required
                    />
                  </div>

                  <div className="flex justify-end space-x-3 pt-4">
                    <button
                      type="button"
                      onClick={() => setShowCreateModal(false)}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 shadow-sm transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={actionLoading === 'create'}
                      className="px-4 py-2 text-sm font-medium text-white bg-primary bg-primary-hover shadow-sm disabled:opacity-50 transition-colors"
                    >
                      {actionLoading === 'create' ? 'Submitting...' : 'Submit Request'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default LeaveRequests;




