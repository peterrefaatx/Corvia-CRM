import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout/Layout';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import api from '../services/api';
import { usePageTitle } from '../hooks/usePageTitle';

const SubmitITTicket: React.FC = () => {
  usePageTitle('Submit IT Ticket');
  const { user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    agentName: '',
    telegramUsername: '@',
    problemDescription: ''
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  // Check authorization
  if (!['TeamLeader', 'AccountManager'].includes(user?.role || '')) {
    navigate('/');
    return null;
  }

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.agentName.trim()) {
      newErrors.agentName = 'Agent name is required';
    } else if (formData.agentName.trim().length < 2) {
      newErrors.agentName = 'Agent name must be at least 2 characters';
    }

    if (!formData.telegramUsername.trim() || formData.telegramUsername === '@') {
      newErrors.telegramUsername = 'Telegram username is required';
    } else if (!formData.telegramUsername.startsWith('@')) {
      newErrors.telegramUsername = 'Telegram username must start with @';
    }

    if (!formData.problemDescription.trim()) {
      newErrors.problemDescription = 'Problem description is required';
    } else if (formData.problemDescription.trim().length < 10) {
      newErrors.problemDescription = 'Problem description must be at least 10 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      setSubmitting(true);
      await api.post('/it-tickets', {
        agentName: formData.agentName.trim(),
        telegramUsername: formData.telegramUsername.trim(),
        problemDescription: formData.problemDescription.trim()
      });

      showToast('IT ticket submitted successfully!', 'success');
      
      // Reset form
      setFormData({
        agentName: '',
        telegramUsername: '@',
        problemDescription: ''
      });
      setErrors({});
      
      // Navigate to my tickets
      navigate('/my-it-tickets');
    } catch (error: any) {
      console.error('Failed to submit ticket:', error);
      showToast(error?.response?.data?.error || 'Failed to submit IT ticket', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error for this field
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  return (
    <Layout>
      <div className="py-8 px-4 sm:px-6 lg:px-8" style={{ backgroundColor: '#f7f6f5' }}>
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <div className="flex justify-between items-center">
              <button
                onClick={() => navigate('/my-it-tickets')}
                className="text-gray-600 hover:text-gray-900 text-sm font-medium transition-colors"
              >
                ← Back to My Tickets
              </button>
            </div>
          </div>

          {/* Form */}
          <div className="glass border border-neutral-200/30 shadow-sm">
            <div className="p-6">
              <h1 className="text-xl font-semibold text-gray-900 mb-6">Submit IT Support Ticket</h1>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Agent Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Agent Name *
                  </label>
                  <input
                    type="text"
                    value={formData.agentName}
                    onChange={(e) => handleChange('agentName', e.target.value)}
                    placeholder="Enter agent's full name"
                    className={`block w-full px-3 py-2 border shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm ${
                      errors.agentName ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                  {errors.agentName && (
                    <p className="mt-1 text-sm text-red-600">{errors.agentName}</p>
                  )}
                </div>

                {/* Telegram Username */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Telegram Username *
                  </label>
                  <input
                    type="text"
                    value={formData.telegramUsername}
                    onChange={(e) => {
                      let value = e.target.value;
                      if (!value.startsWith('@')) {
                        value = '@' + value.replace('@', '');
                      }
                      handleChange('telegramUsername', value);
                    }}
                    placeholder="@username"
                    className={`block w-full px-3 py-2 border shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm ${
                      errors.telegramUsername ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                  {errors.telegramUsername && (
                    <p className="mt-1 text-sm text-red-600">{errors.telegramUsername}</p>
                  )}
                  <p className="mt-1 text-xs text-gray-500">Must start with @</p>
                </div>

                {/* Problem Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Problem Description *
                  </label>
                  <textarea
                    value={formData.problemDescription}
                    onChange={(e) => handleChange('problemDescription', e.target.value)}
                    placeholder="Describe the technical issue in detail..."
                    rows={6}
                    className={`block w-full px-3 py-2 border shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm ${
                      errors.problemDescription ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                  {errors.problemDescription && (
                    <p className="mt-1 text-sm text-red-600">{errors.problemDescription}</p>
                  )}
                  <p className="mt-1 text-xs text-gray-500">
                    Minimum 10 characters. Be as detailed as possible.
                  </p>
                </div>

                {/* Buttons */}
                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => navigate('/my-it-tickets')}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 shadow-sm transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 text-sm font-medium text-white bg-primary bg-primary-hover shadow-sm disabled:opacity-50 transition-colors"
                  >
                    {submitting ? 'Submitting...' : 'Submit Ticket'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default SubmitITTicket;





