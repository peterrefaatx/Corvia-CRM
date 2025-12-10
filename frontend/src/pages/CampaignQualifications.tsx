import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import Layout from '../components/Layout/Layout';
import api from '../services/api';
import { usePageTitle } from '../hooks/usePageTitle';
import { FileText, AlertCircle } from 'lucide-react';

interface Campaign {
  id: string;
  name: string;
  isActive: boolean;
  leadsTarget: number | null;
  qualifications: string | null;
  timezone: string | null;
  createdAt: string;
  _count?: {
    leads: number;
  };
  client?: {
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
}

const CampaignQualifications: React.FC = () => {
  usePageTitle('Campaign Qualifications');
  const { user } = useAuth();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadCampaigns();
  }, []);

  const loadCampaigns = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await api.get('/campaigns/all');
      
      // Filter campaigns based on user role
      let filteredCampaigns: Campaign[] = [];
      
      if (user?.role === 'QualityControl') {
        // QC agents see campaigns they're assigned to
        filteredCampaigns = response.data.filter((campaign: Campaign) => 
          campaign.qcAgents?.some((qc) => qc.qcAgent.id === user.id)
        );
      } else if (user?.role === 'TeamLeader') {
        // Team leaders see campaigns their team is assigned to
        const userTeamId = user?.team?.id;
        filteredCampaigns = response.data.filter((campaign: Campaign) => 
          campaign.teams?.some((team) => team.team.id === userTeamId)
        );
      }
      
      setCampaigns(filteredCampaigns);
    } catch (error: any) {
      console.error('Failed to load campaigns:', error);
      setError(error.response?.data?.message || 'Failed to load campaigns');
    } finally {
      setLoading(false);
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
      <div className="py-6 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Campaign Qualifications</h1>
          <p className="mt-2 text-sm text-gray-600">
            Review qualification criteria for your assigned campaigns
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center">
              <AlertCircle className="h-5 w-5 text-red-600 mr-2" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          </div>
        )}

        {/* Campaigns List */}
        {campaigns.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg shadow">
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-gray-100 mb-4">
              <FileText className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Campaigns Assigned</h3>
            <p className="text-gray-500">
              {user?.role === 'QualityControl' 
                ? 'You are not assigned to any campaigns yet.'
                : 'Your team is not assigned to any campaigns yet.'}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {campaigns.map((campaign) => (
              <div 
                key={campaign.id} 
                className="bg-white rounded-lg shadow overflow-hidden hover:shadow-md transition-shadow"
              >
                {/* Campaign Header */}
                <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="text-xl font-semibold text-gray-900">{campaign.name}</h3>
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                          campaign.isActive 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {campaign.isActive ? '● Active' : '○ Inactive'}
                        </span>
                      </div>
                      
                      {/* Campaign Metadata */}
                      {campaign.leadsTarget && (
                        <div className="text-sm text-gray-600">
                          <span className="font-medium mr-1">Target:</span>
                          {campaign.leadsTarget} leads
                        </div>
                      )}

                      {/* Team/QC Info */}
                      <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 mt-2">
                        {campaign.teams && campaign.teams.length > 0 && (
                          <div className="flex items-center">
                            <span className="font-medium mr-1">Team:</span>
                            {campaign.teams.map(t => t.team.name).join(', ')}
                          </div>
                        )}
                        {campaign.qcAgents && campaign.qcAgents.length > 0 && (
                          <div className="flex items-center">
                            <span className="font-medium mr-1">QC:</span>
                            {campaign.qcAgents.map(qc => qc.qcAgent.fullName).join(', ')}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Qualifications Content */}
                <div className="px-6 py-5">
                  <div className="flex items-center space-x-2 mb-4">
                    <FileText className="h-5 w-5 text-primary" />
                    <h4 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
                      Qualification Criteria
                    </h4>
                  </div>
                  
                  {campaign.qualifications ? (
                    <div className="bg-primary-light border border-blue-200 rounded-lg p-5">
                      <pre className="text-sm text-gray-800 whitespace-pre-wrap font-sans leading-relaxed">
                        {campaign.qualifications}
                      </pre>
                    </div>
                  ) : (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-5">
                      <div className="flex items-start">
                        <AlertCircle className="h-5 w-5 text-yellow-600 mr-3 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-sm font-medium text-yellow-900 mb-1">
                            No Qualification Criteria Set
                          </p>
                          <p className="text-sm text-yellow-800">
                            This campaign does not have specific qualification criteria defined. 
                            Please contact your manager or account manager for guidance on lead qualification standards.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Info Footer */}
        {campaigns.length > 0 && (
          <div className="bg-primary-light border border-primary200 rounded-lg p-4">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-primary" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-primary">
                  <strong>Tip:</strong> Use these qualification criteria when reviewing leads to ensure consistency 
                  and quality across your team. If you have questions about specific criteria, reach out to your manager.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default CampaignQualifications;





