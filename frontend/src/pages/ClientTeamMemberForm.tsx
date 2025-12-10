import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Layout from '../components/Layout/Layout';
import { useToast } from '../contexts/ToastContext';
import api from '../services/api';
import { usePageTitle } from '../hooks/usePageTitle';

const ClientTeamMemberForm: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showSuccess, showError } = useToast();
  const isEditMode = !!id;
  
  usePageTitle(isEditMode ? 'Edit Team Member' : 'Create Team Member');

  const [loading, setLoading] = useState(isEditMode);
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [positions, setPositions] = useState<Array<{id: string; title: string}>>([]);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    positionId: '',
    positionTitle: ''
  });

  useEffect(() => {
    loadPositions();
    if (isEditMode) {
      loadTeamMember();
    }
  }, [id]);

  const loadPositions = async () => {
    try {
      const response = await api.get('/client/positions');
      setPositions(response.data);
    } catch (error) {
      console.error('Failed to load positions:', error);
    }
  };

  const loadTeamMember = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/client/team-members/${id}`);
      setFormData({
        name: response.data.name,
        email: response.data.email,
        password: '',
        positionId: response.data.positionId || '',
        positionTitle: response.data.positionTitle
      });
    } catch (error: any) {
      console.error('Failed to load team member:', error);
      showError(error.response?.data?.error || 'Failed to load team member');
      navigate('/client/team-members');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.email || !formData.positionTitle) {
      showError('Please fill in all required fields');
      return;
    }

    if (!isEditMode && !formData.password) {
      showError('Password is required for new team members');
      return;
    }

    try {
      setSaving(true);
      if (isEditMode) {
        const updateData: any = {
          name: formData.name,
          email: formData.email,
          positionId: formData.positionId,
          positionTitle: formData.positionTitle
        };
        
        // Only include password if it's provided
        if (formData.password) {
          updateData.password = formData.password;
        }
        
        await api.put(`/client/team-members/${id}`, updateData);
        showSuccess('Team member updated successfully');
      } else {
        await api.post('/client/team-members', formData);
        showSuccess('Team member created successfully');
      }
      navigate('/client/team-members');
    } catch (error: any) {
      console.error('Failed to save team member:', error);
      showError(error.response?.data?.error || 'Failed to save team member');
    } finally {
      setSaving(false);
    }
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
      <div className="min-h-screen" style={{ backgroundColor: '#fafafa' }}>
        <div className="w-full px-4 sm:px-6 lg:px-8 py-8">
          {/* Header Card */}
          <div className="bg-white rounded-2xl p-6 border border-gray-100 mb-6">
            <button
              onClick={() => navigate('/client/team-members')}
              className="text-sm text-gray-600 hover:text-gray-900 mb-4 flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Team Members
            </button>
            <h1 className="text-2xl font-semibold text-gray-900">
              {isEditMode ? 'Edit Team Member' : 'Create Team Member'}
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              {isEditMode ? 'Update team member information' : 'Add a new team member to your account'}
            </p>
          </div>

          <form onSubmit={handleSubmit}>
            {/* Basic Information */}
            <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-5">Basic Information</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="block w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  className="block w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Position <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.positionId}
                  onChange={(e) => {
                    const selectedPosition = positions.find(p => p.id === e.target.value);
                    setFormData({
                      ...formData, 
                      positionId: e.target.value,
                      positionTitle: selectedPosition?.title || ''
                    });
                  }}
                  className="block w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  required
                >
                  <option value="">Select a position...</option>
                  {positions.map((position) => (
                    <option key={position.id} value={position.id} data-title={position.title}>
                      {position.title}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Used for automation rules to assign tasks. Manage positions from the Team Members page.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Password {!isEditMode && <span className="text-red-500">*</span>}
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={formData.password}
                    onChange={(e) => setFormData({...formData, password: e.target.value})}
                    className="block w-full px-4 py-2.5 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    required={!isEditMode}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {isEditMode ? "Enter new password to change (minimum 6 characters)" : "Minimum 6 characters"}
                </p>
              </div>
            </div>
          </div>

            {/* Permissions Note */}
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-primary200 rounded-xl p-5 mb-6">
              <div className="flex items-start">
                <svg className="w-5 h-5 text-primary mt-0.5 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                <div>
                  <h3 className="text-sm font-semibold text-primary mb-1">Permissions are managed by position</h3>
                  <p className="text-sm text-primary">
                    This team member will inherit permissions from their selected position. To change permissions, go to Team Members → Manage Positions.
                  </p>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => navigate('/client/team-members')}
                className="px-5 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2.5 text-sm font-medium text-white bg-primary hover:bg-primary-hover rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving...' : (isEditMode ? 'Update Team Member' : 'Create Team Member')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Layout>
  );
};

export default ClientTeamMemberForm;




