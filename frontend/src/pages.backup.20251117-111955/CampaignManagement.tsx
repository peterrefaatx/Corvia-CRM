// CampaignManagement.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout/Layout';
import api from '../services/api';
import CampaignFormConfig from '../components/CampaignFormConfig';

interface Team {
  id: string;
  name: string;
}

interface Campaign {
  id: string;
  name: string;
  isActive: boolean;
  leadsTarget?: number;
  createdAt: string;
  manager: {
    fullName: string;
  };
  client?: {
    id: string;
    fullName: string;
  };
  teams?: Array<{
    team: {
      id: string;
      name: string;
    };
  }>;
  qcAgents?: Array<{
    qcAgent: {
      id: string;
      fullName: string;
    };
  }>;
  _count?: {
    leads: number;
  };
}

interface User {
  id: string;
  fullName: string;
}

interface FormConfig {
  listingStatus: {
    enabled: boolean;
    options: string[];
    required: boolean;
  };
  occupancy: {
    enabled: boolean;
    options: string[];
    required: boolean;
  };
  mortgage: {
    enabled: boolean;
    required: boolean;
  };
  propertyType: {
    enabled: boolean;
    options: string[];
    required: boolean;
  };
  license: {
    enabled: boolean;
    options: string[];
    required: boolean;
  };
  closingTimeline: {
    enabled: boolean;
    options: string[];
    required: boolean;
  };
}

interface CreateCampaignForm {
  name: string;
  leadsTarget?: number;
  teamId: string;
  clientId: string;
  qcUserId: string;
  timezone: string;
  formConfig?: FormConfig;
  formTemplateId?: string;
  formConfigType?: 'default' | 'template';
}

const CampaignManagement: React.FC = () => {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [clients, setClients] = useState<User[]>([]);
  const [qcAgents, setQcAgents] = useState<User[]>([]);
  const [formTemplates, setFormTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string>('');

  const defaultFormConfig: FormConfig = {
    listingStatus: {
      enabled: true,
      options: ['ListedByOwner', 'ListedByRealtor', 'NotListed'],
      required: true
    },
    occupancy: {
      enabled: true,
      options: ['OwnerOccupied', 'RentedMTM', 'RentedAnnually', 'Vacant'],
      required: true
    },
    mortgage: {
      enabled: true,
      required: true
    },
    propertyType: {
      enabled: true,
      options: ['SingleFamily', 'MultiFamily', 'Condo', 'Townhouse', 'VacantLots', 'Apartment', 'MobileHome', 'MobileHomeAndLot'],
      required: true
    },
    license: {
      enabled: true,
      options: ['Residential', 'Commercial', 'Agriculture', 'MixedUse'],
      required: false
    },
    closingTimeline: {
      enabled: true,
      options: ['Asap', 'ThirtyDays', 'SixtyDays', 'NinetyDays', 'SixMonths'],
      required: true
    }
  };

  const navigate = useNavigate();

  const [createForm, setCreateForm] = useState<CreateCampaignForm>({
    name: '',
    leadsTarget: undefined,
    teamId: '',
    clientId: '',
    qcUserId: '',
    timezone: '',
    formConfig: defaultFormConfig,
    formConfigType: 'default'
  });

  const [editForm, setEditForm] = useState<CreateCampaignForm>({
    name: '',
    leadsTarget: undefined,
    teamId: '',
    clientId: '',
    qcUserId: '',
    timezone: '',
    formConfig: defaultFormConfig,
    formConfigType: 'default'
  });

  useEffect(() => {
    loadCampaigns();
    loadFormTemplates();
  }, []);

  const loadFormTemplates = async () => {
    try {
      const response = await api.get('/form-templates');
      setFormTemplates(response.data);
    } catch (error) {
      console.error('Failed to load form templates:', error);
    }
  };

  const loadCampaigns = async () => {
    try {
      setError('');
      const [campaignsResponse, teamsResponse, clientsResponse, qcResponse] = await Promise.all([
        api.get('/campaigns/all'),
        api.get('/teams'),
        api.get('/users', { params: { role: 'Client' } }),
        api.get('/users', { params: { role: 'QualityControl' } })
      ]);
      
      // Parse formConfig from JSON string if it exists
      const campaignsWithConfig = campaignsResponse.data.map((campaign: any) => {
        try {
          return {
            ...campaign,
            formConfig: campaign.formConfig 
              ? (typeof campaign.formConfig === 'string' ? JSON.parse(campaign.formConfig) : campaign.formConfig)
              : null
          };
        } catch (parseError) {
          console.error('Failed to parse formConfig for campaign:', campaign.name, parseError);
          return { ...campaign, formConfig: null };
        }
      });
      
      setCampaigns(campaignsWithConfig);
      setTeams(teamsResponse.data);
      console.log('Clients loaded:', clientsResponse.data);
      setClients(clientsResponse.data);
      setQcAgents(qcResponse.data);
    } catch (error) {
      console.error('Failed to load campaigns:', error);
      setError('Failed to load campaigns. Please try again.');
      // Fallback to basic campaigns if all endpoint fails
      try {
        const response = await api.get('/campaigns');
        setCampaigns(response.data);
        setError('');
      } catch (fallbackError) {
        console.error('Failed to load basic campaigns:', fallbackError);
        setError('Failed to load campaigns. Please check your connection.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!createForm.name.trim()) {
      setError('Please enter a campaign name');
      return;
    }

    setActionLoading('create');
    setError('');
    try {
      const payload: any = { 
        name: createForm.name,
        leadsTarget: createForm.leadsTarget,
        clientId: createForm.clientId || null,
        qcUserIds: createForm.qcUserId ? [createForm.qcUserId] : [],
        teamIds: createForm.teamId ? [createForm.teamId] : [],
        timezone: createForm.timezone || null,
      };

      // Add either formConfig or formTemplateId based on selection
      if (createForm.formConfigType === 'default') {
        payload.formConfig = createForm.formConfig;
      } else if (createForm.formTemplateId) {
        payload.formTemplateId = createForm.formTemplateId;
      }

      await api.post('/campaigns', payload);
      
      await loadCampaigns();
      setShowCreateModal(false);
      setCreateForm({ name: '', leadsTarget: undefined, teamId: '', clientId: '', qcUserId: '', timezone: '', formConfig: defaultFormConfig, formConfigType: 'default' });
      // Show success message
      setError('');
    } catch (error: any) {
      console.error('Failed to create campaign:', error);
      const errorMessage = error.response?.data?.error || 'Failed to create campaign';
      setError(errorMessage);
    } finally {
      setActionLoading(null);
    }
  };

  const handleEditCampaign = (campaign: Campaign) => {
    try {
      setSelectedCampaign(campaign);
      
      // Safely get formConfig, defaulting to defaultFormConfig if null or invalid
      let campaignFormConfig = { ...defaultFormConfig };
      try {
        const rawConfig = (campaign as any).formConfig;
        if (rawConfig) {
          const parsedConfig = typeof rawConfig === 'string' ? JSON.parse(rawConfig) : rawConfig;
          // Merge with default config to ensure all fields exist (for backward compatibility)
          campaignFormConfig = {
            listingStatus: parsedConfig.listingStatus || defaultFormConfig.listingStatus,
            occupancy: parsedConfig.occupancy || defaultFormConfig.occupancy,
            mortgage: parsedConfig.mortgage || defaultFormConfig.mortgage,
            propertyType: parsedConfig.propertyType || defaultFormConfig.propertyType,
            license: parsedConfig.license || defaultFormConfig.license,
            closingTimeline: parsedConfig.closingTimeline || defaultFormConfig.closingTimeline
          };
        }
      } catch (configError) {
        console.error('Failed to parse campaign formConfig, using default:', configError);
      }
      
      setEditForm({
        name: campaign.name,
        leadsTarget: campaign.leadsTarget,
        teamId: campaign.teams?.[0]?.team.id || '',
        clientId: campaign.client?.id || '',
        qcUserId: campaign.qcAgents?.[0]?.qcAgent.id || '',
        timezone: (campaign as any).timezone || '',
        formConfig: campaignFormConfig
      });
      setShowEditModal(true);
    } catch (error) {
      console.error('Failed to open edit modal:', error);
      setError('Failed to load campaign details. Please try again.');
    }
  };

  const handleUpdateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedCampaign) return;

    setActionLoading('edit');
    setError('');
    try {
      await api.put(`/campaigns/${selectedCampaign.id}`, {
        name: editForm.name,
        leadsTarget: editForm.leadsTarget,
        clientId: editForm.clientId || null,
        qcUserIds: editForm.qcUserId ? [editForm.qcUserId] : [],
        teamIds: editForm.teamId ? [editForm.teamId] : [],
        timezone: editForm.timezone || null,
        formConfig: editForm.formConfig
      });
      
      await loadCampaigns();
      setShowEditModal(false);
      setSelectedCampaign(null);
      setEditForm({ name: '', leadsTarget: undefined, teamId: '', clientId: '', qcUserId: '', timezone: '', formConfig: defaultFormConfig });
    } catch (error: any) {
      console.error('Failed to update campaign:', error);
      const errorMessage = error.response?.data?.error || 'Failed to update campaign';
      setError(errorMessage);
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleCampaign = async (campaign: Campaign) => {
    setActionLoading(`toggle-${campaign.id}`);
    setError('');
    try {
      const response = await api.patch(`/campaigns/${campaign.id}/status`, {
        isActive: !campaign.isActive
      });
      
      const updatedCampaigns = campaigns.map(c => 
        c.id === campaign.id ? response.data : c
      );
      setCampaigns(updatedCampaigns);
      setShowEditModal(false);
    } catch (error: any) {
      console.error('Failed to update campaign:', error);
      const errorMessage = error.response?.data?.error || 'Failed to update campaign';
      setError(errorMessage);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteCampaign = async () => {
    if (!selectedCampaign) return;

    setActionLoading('delete');
    setError('');
    try {
      const response = await api.delete(`/campaigns/${selectedCampaign.id}`);
      
      setCampaigns(campaigns.filter(c => c.id !== selectedCampaign.id));
      setShowDeleteModal(false);
      setSelectedCampaign(null);
      
      // Show success message with details
      if (response.data.leadsAffected > 0) {
        setError(`Campaign "${selectedCampaign.name}" deleted successfully! ${response.data.leadsAffected} leads were kept in the database.`);
      } else {
        setError(`Campaign "${selectedCampaign.name}" deleted successfully!`);
      }
      
      // Clear success message after 5 seconds
      setTimeout(() => setError(''), 5000);
    } catch (error: any) {
      console.error('Failed to delete campaign:', error);
      
      // More specific error messages
      let errorMessage = 'Failed to delete campaign. Please try again.';
      if (error.response?.status === 404) {
        errorMessage = 'Campaign not found. It may have been already deleted.';
      } else if (error.response?.status === 403) {
        errorMessage = 'You do not have permission to delete campaigns.';
      } else if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      }
      
      setError(errorMessage);
    } finally {
      setActionLoading(null);
    }
  };



  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-600"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="py-6 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-between items-center">
            <button
              onClick={() => navigate('/admin')}
              className="flex items-center text-neutral-600 hover:text-neutral-900 smooth-transition"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              <span className="text-sm font-medium">Back to Admin Dashboard</span>
            </button>
            <div className="flex gap-3">
              <button
                onClick={() => navigate('/admin/campaigns/form-builder')}
                className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Form Builder
              </button>
              <button
                onClick={() => setShowCreateModal(true)}
                className="bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded-md text-sm font-medium"
              >
                Create Campaign
              </button>
            </div>
          </div>
        </div>

        {/* Error/Success Message */}
        {error && (
          <div className={`mb-6 p-4 rounded-lg ${
            error.includes('successfully') 
              ? 'bg-green-50 border border-green-200 text-green-700'
              : 'bg-red-50 border border-red-200 text-red-700'
          }`}>
            <div className="flex items-center">
              <div className="flex-shrink-0">
                {error.includes('successfully') ? (
                  <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium">{error}</p>
              </div>
              <div className="ml-auto">
                <button 
                  onClick={() => setError('')}
                  className="text-sm bg-transparent hover:bg-white hover:bg-opacity-20 px-2 py-1 rounded"
                >
                  ×
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Campaigns List */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Campaign Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Client Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Team</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">QC Agent</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Timezone</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Target</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {campaigns.map((campaign) => (
                <tr key={campaign.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{campaign.name}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`status-badge inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      campaign.isActive 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {campaign.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {campaign.client?.fullName || <span className="text-gray-400 italic">No client</span>}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {campaign.teams?.[0]?.team.name || <span className="text-gray-400 italic">No team</span>}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {campaign.qcAgents?.[0]?.qcAgent.fullName || <span className="text-gray-400 italic">No QC</span>}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {(campaign as any).timezone || <span className="text-gray-400 italic">-</span>}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {campaign.leadsTarget || 0}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {new Date(campaign.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => handleEditCampaign(campaign)}
                      className="inline-flex items-center px-3 py-1.5 bg-cyan-100 text-cyan-800 hover:bg-cyan-200 rounded text-xs font-medium"
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {campaigns.length === 0 && !loading && (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">No campaigns found</p>
            <p className="text-gray-400 mt-2">Create your first campaign to get started</p>
          </div>
        )}

        {/* Create Campaign Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
            <div className="relative w-full max-w-2xl bg-white shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
              {/* Modal Header */}
              <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-cyan-50 to-blue-50 flex-shrink-0">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900">Create New Campaign</h3>
                    <p className="text-sm text-gray-600 mt-1">Set up a new campaign with targets and assignments</p>
                  </div>
                  <button
                    onClick={() => setShowCreateModal(false)}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Modal Body - Scrollable */}
              <form onSubmit={handleCreateCampaign} className="flex flex-col flex-1 overflow-hidden">
                <div className="p-6 overflow-y-auto flex-1">
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Campaign Name *</label>
                    <input
                      type="text"
                      required
                      value={createForm.name}
                      onChange={(e) => setCreateForm({...createForm, name: e.target.value})}
                      className="block w-full px-3 py-2 border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Leads Target</label>
                    <input
                      type="number"
                      min="0"
                      value={createForm.leadsTarget || ''}
                      onChange={(e) => setCreateForm({...createForm, leadsTarget: e.target.value ? parseInt(e.target.value) : undefined})}
                      className="block w-full px-3 py-2 border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Campaign Owner (Client)</label>
                    <select
                      value={createForm.clientId}
                      onChange={(e) => setCreateForm({...createForm, clientId: e.target.value})}
                      className="block w-full px-3 py-2 border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all"
                    >
                      <option value="">No client assigned</option>
                      {clients.map((client) => (
                        <option key={client.id} value={client.id}>
                          {client.fullName}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">QC Agent</label>
                    <select
                      value={createForm.qcUserId}
                      onChange={(e) => setCreateForm({...createForm, qcUserId: e.target.value})}
                      className="block w-full px-3 py-2 border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all"
                    >
                      <option value="">No QC assigned</option>
                      {qcAgents.map((qc) => (
                        <option key={qc.id} value={qc.id}>
                          {qc.fullName}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Assign Team</label>
                    <select
                      value={createForm.teamId}
                      onChange={(e) => setCreateForm({...createForm, teamId: e.target.value})}
                      className="block w-full px-3 py-2 border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all"
                    >
                      <option value="">No team</option>
                      {teams.map((team) => (
                        <option key={team.id} value={team.id}>
                          {team.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Timezone</label>
                    <select
                      value={createForm.timezone}
                      onChange={(e) => setCreateForm({...createForm, timezone: e.target.value})}
                      className="block w-full px-3 py-2 border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all"
                    >
                      <option value="">Select timezone</option>
                      <option value="EST">Eastern Standard Time</option>
                      <option value="EDT">Eastern Daylight Time</option>
                      <option value="CST">Central Standard Time</option>
                      <option value="CDT">Central Daylight Time</option>
                      <option value="MST">Mountain Standard Time</option>
                      <option value="MDT">Mountain Daylight Time</option>
                      <option value="PST">Pacific Standard Time</option>
                      <option value="PDT">Pacific Daylight Time</option>
                    </select>
                  </div>
                </div>

                  {/* Form Configuration Type Selector */}
                  <div className="mb-6">
                    <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                      Form Configuration <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={createForm.formConfigType === 'template' && createForm.formTemplateId ? createForm.formTemplateId : 'default'}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value === 'default') {
                          setCreateForm({...createForm, formConfigType: 'default', formTemplateId: undefined});
                        } else {
                          setCreateForm({...createForm, formConfigType: 'template', formTemplateId: value});
                        }
                      }}
                      className="block w-full px-3 py-2 border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all"
                    >
                      <option value="default">Default Real Estate</option>
                      {formTemplates.map((template) => (
                        <option key={template.id} value={template.id}>
                          {template.name}
                        </option>
                      ))}
                    </select>
                    {createForm.formConfigType === 'template' && createForm.formTemplateId && (
                      <p className="text-xs text-gray-500 mt-2">
                        Using custom template: {formTemplates.find(t => t.id === createForm.formTemplateId)?.name}
                      </p>
                    )}
                  </div>

                  {/* Show Form Configuration only for Default Real Estate */}
                  {createForm.formConfigType === 'default' && (
                    <CampaignFormConfig
                      formConfig={createForm.formConfig || defaultFormConfig}
                      onChange={(config) => setCreateForm({...createForm, formConfig: config})}
                    />
                  )}

                  {/* Show Template Preview for custom templates */}
                  {createForm.formConfigType === 'template' && createForm.formTemplateId && (
                    <div className="mb-6 p-4 bg-purple-50 border border-purple-200 rounded-lg">
                      <h4 className="text-sm font-semibold text-purple-900 mb-2">Custom Form Template</h4>
                      <p className="text-sm text-purple-700">
                        This campaign will use the "{formTemplates.find(t => t.id === createForm.formTemplateId)?.name}" template with {formTemplates.find(t => t.id === createForm.formTemplateId)?.fields?.length || 0} custom fields.
                      </p>
                      <p className="text-xs text-purple-600 mt-2">
                        You can edit this template in the Form Builder.
                      </p>
                    </div>
                  )}
                </div>

                {/* Action Buttons - Fixed at bottom */}
                <div className="flex justify-end space-x-3 px-6 py-4 border-t border-gray-200 bg-gray-50 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-5 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading === 'create'}
                    className="px-5 py-2 text-sm font-medium text-white bg-cyan-600 hover:bg-cyan-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {actionLoading === 'create' ? 'Creating...' : 'Create Campaign'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Edit Campaign Modal */}
        {showEditModal && selectedCampaign && (
          <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
            <div className="relative w-full max-w-2xl bg-white shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
              {/* Modal Header */}
              <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-cyan-50 to-blue-50 flex-shrink-0">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900">Edit Campaign</h3>
                    <p className="text-sm text-gray-600 mt-1">{selectedCampaign.name}</p>
                  </div>
                  <button
                    onClick={() => setShowEditModal(false)}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Modal Body - Scrollable */}
              <form onSubmit={handleUpdateCampaign} className="flex flex-col flex-1 overflow-hidden">
                <div className="p-6 overflow-y-auto flex-1">
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Campaign Name *</label>
                    <input
                      type="text"
                      required
                      value={editForm.name}
                      onChange={(e) => setEditForm({...editForm, name: e.target.value})}
                      className="block w-full px-3 py-2 border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Leads Target</label>
                    <input
                      type="number"
                      min="0"
                      value={editForm.leadsTarget || ''}
                      onChange={(e) => setEditForm({...editForm, leadsTarget: e.target.value ? parseInt(e.target.value) : undefined})}
                      className="block w-full px-3 py-2 border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all"
                      placeholder="e.g., 100"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Campaign Owner (Client)</label>
                    <select
                      value={editForm.clientId}
                      onChange={(e) => setEditForm({...editForm, clientId: e.target.value})}
                      className="block w-full px-3 py-2 border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all"
                    >
                      <option value="">No client assigned</option>
                      {clients.map((client) => (
                        <option key={client.id} value={client.id}>
                          {client.fullName}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">QC Agent</label>
                    <select
                      value={editForm.qcUserId}
                      onChange={(e) => setEditForm({...editForm, qcUserId: e.target.value})}
                      className="block w-full px-3 py-2 border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all"
                    >
                      <option value="">No QC assigned</option>
                      {qcAgents.map((qc) => (
                        <option key={qc.id} value={qc.id}>
                          {qc.fullName}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Assign Team</label>
                    <select
                      value={editForm.teamId}
                      onChange={(e) => setEditForm({...editForm, teamId: e.target.value})}
                      className="block w-full px-3 py-2 border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all"
                    >
                      <option value="">No team</option>
                      {teams.map((team) => (
                        <option key={team.id} value={team.id}>
                          {team.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Timezone</label>
                    <select
                      value={editForm.timezone}
                      onChange={(e) => setEditForm({...editForm, timezone: e.target.value})}
                      className="block w-full px-3 py-2 border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all"
                    >
                      <option value="">Select timezone</option>
                      <option value="EST">Eastern Standard Time</option>
                      <option value="EDT">Eastern Daylight Time</option>
                      <option value="CST">Central Standard Time</option>
                      <option value="CDT">Central Daylight Time</option>
                      <option value="MST">Mountain Standard Time</option>
                      <option value="MDT">Mountain Daylight Time</option>
                      <option value="PST">Pacific Standard Time</option>
                      <option value="PDT">Pacific Daylight Time</option>
                    </select>
                  </div>
                </div>

                  {/* Form Configuration */}
                  <CampaignFormConfig
                    formConfig={editForm.formConfig || defaultFormConfig}
                    onChange={(config) => setEditForm({...editForm, formConfig: config})}
                  />
                </div>

                {/* Action Buttons - Fixed at bottom */}
                <div className="flex justify-between items-center px-6 py-4 border-t border-gray-200 bg-gray-50 flex-shrink-0">
                  <div className="flex space-x-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowEditModal(false);
                        handleToggleCampaign(selectedCampaign);
                      }}
                      disabled={actionLoading === `toggle-${selectedCampaign.id}`}
                      className={`px-4 py-2 text-sm font-medium border transition-colors ${
                        selectedCampaign.isActive
                          ? 'text-yellow-700 bg-yellow-50 border-yellow-300 hover:bg-yellow-100'
                          : 'text-green-700 bg-green-50 border-green-300 hover:bg-green-100'
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      {actionLoading === `toggle-${selectedCampaign.id}` ? 'Processing...' : selectedCampaign.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowEditModal(false);
                        setShowDeleteModal(true);
                      }}
                      className="px-4 py-2 text-sm font-medium text-red-700 bg-red-50 border border-red-300 hover:bg-red-100 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                  <div className="flex space-x-3">
                    <button
                      type="button"
                      onClick={() => setShowEditModal(false)}
                      className="px-5 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={actionLoading === 'edit'}
                      className="px-5 py-2 text-sm font-medium text-white bg-cyan-600 hover:bg-cyan-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {actionLoading === 'edit' ? 'Updating...' : 'Update Campaign'}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Delete Campaign Modal */}
        {showDeleteModal && selectedCampaign && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-full max-w-md shadow-lg rounded-md bg-white">
              <div className="mt-3 text-center">
                <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
                  <span className="text-red-600 text-xl">⚠️</span>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mt-3">Delete Campaign</h3>
                <div className="mt-2">
                  <p className="text-sm text-gray-500">
                    Are you sure you want to delete <strong>{selectedCampaign.name}</strong>?
                  </p>
                  {selectedCampaign._count && selectedCampaign._count.leads > 0 && (
                    <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-md">
                      <p className="text-sm text-blue-700 font-medium">
                        📊 This campaign has {selectedCampaign._count.leads} leads
                      </p>
                      <p className="text-xs text-blue-600 mt-1">
                        All leads will be kept in the database but will no longer be associated with this campaign.
                      </p>
                    </div>
                  )}
                  <p className="text-sm text-gray-500 mt-2">
                    This action cannot be undone.
                  </p>
                </div>
                <div className="flex justify-center space-x-3 pt-4">
                  <button
                    onClick={() => {
                      setShowDeleteModal(false);
                      setSelectedCampaign(null);
                    }}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDeleteCampaign}
                    disabled={actionLoading === 'delete'}
                    className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50"
                  >
                    {actionLoading === 'delete' ? 'Deleting...' : 'Delete Campaign'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default CampaignManagement;