import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import { useToast } from '../contexts/ToastContext';
import Layout from '../components/Layout/Layout';
import api from '../services/api';
import { usePageTitle } from '../hooks/usePageTitle';

interface Lead {
  id: string;
  serialNumber: string;
  homeownerFirst: string;
  homeownerLast: string;
  phone: string;
  email?: string;
  addressText: string;
  status: string;
  createdAt: string;
  updatedAt?: string;
  campaign?: { name: string; formTemplateId?: string } | null;
  agent?: { fullName: string; id: string } | null;
  team?: { name: string } | null;
  qcAgent?: { id: string; fullName: string };
  bedrooms: number;
  bathrooms: number;
  marketValue: number;
  askingPrice?: number;
  listingStatus: string;
  occupancy: string;
  mortgageYesNo: boolean;
  mortgageAmount?: number;
  closingTimeline: string;
  motivationRating: number;
  conditionRating: number;
  additionalInfo?: string;
  customFields?: Record<string, any>;
  qcComment?: string;
  negotiable?: string;
  license?: string;
  propertyType?: string;
  sellingReason?: string;
  ownershipTimelineValue?: number;
  ownershipTimelineUnit?: string;
}

const QCDashboard: React.FC = () => {
  usePageTitle('QC Dashboard');
  const navigate = useNavigate();
  const { showError } = useToast();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [duplicatePhones, setDuplicatePhones] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadPendingLeads();
  }, []);



  const loadPendingLeads = async () => {
    try {
      setLoading(true);
      console.log('Loading leads for QC...');
      
      // Load pending leads only
      const response = await api.get('/leads?status=Pending');
      console.log('Pending leads loaded:', response.data);
      const loadedLeads = response.data.leads || response.data || [];
      setLeads(loadedLeads);
      checkDuplicatePhonesInList(loadedLeads);
    } catch (error: any) {
      console.error('Failed to load leads:', error);
      console.error('Error response:', error.response?.data);
      console.error('Error status:', error.response?.status);
      showError(`Failed to load leads: ${error.response?.data?.error || error.message}`);
      setLeads([]);
      setDuplicatePhones(new Set());
    } finally {
      setLoading(false);
    }
  };

  const checkDuplicatePhonesInList = async (leadsList: Lead[]) => {
    console.log('QC: Checking duplicates for', leadsList.length, 'leads');
    
    const duplicates = new Set<string>();

    // Check each lead against the database
    for (const lead of leadsList) {
      try {
        const params = new URLSearchParams();
        if (lead.phone) params.append('phone', lead.phone);
        
        const response = await api.get(`/leads/check-duplicate?${params.toString()}`);
        
        if (response.data.isDuplicate) {
          // Filter out the current lead from matches
          const matches = response.data.matches.filter((m: any) => m.id !== lead.id);
          if (matches.length > 0) {
            duplicates.add(lead.phone);
          }
        }
      } catch (error) {
        console.error('Error checking duplicate for lead:', lead.id, error);
      }
    }

    console.log('QC: Found duplicates:', Array.from(duplicates));
    setDuplicatePhones(duplicates);
  };

  const viewLeadDetails = (lead: Lead) => {
    // Navigate to the unified LeadDetail page with QC mode parameter
    navigate(`/leads/${lead.id}?qc=true`);
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
        {/* QC Dashboard */}
        <div className="bg-white rounded-xl border border-gray-100" style={{ overflow: 'visible' }}>
          <div className="px-6 py-4 border-b border-neutral-200/50 bg-white/50 relative rounded-t-2xl" style={{ overflow: 'visible' }}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium text-neutral-900" style={{ letterSpacing: '-0.01em' }}>
                QC Dashboard - Pending Leads
              </h2>
              <div className="flex items-center space-x-3">
                <span className="text-sm text-neutral-600">
                  {leads.length} lead{leads.length !== 1 ? 's' : ''}
                </span>
                
                {/* Refresh Button */}
                <button
                  onClick={loadPendingLeads}
                  disabled={loading}
                  className="p-2 text-green-600 hover:text-green-700 hover:scale-110 rounded-full transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Refresh leads"
                >
                  <svg 
                    className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth={2} 
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" 
                    />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {leads.length === 0 ? (
            <div className="p-12 text-center">
              <div className="mx-auto h-12 w-12 text-neutral-400 mb-4">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <p className="text-neutral-600 text-lg font-medium">
                No pending leads to review
              </p>
              <p className="text-neutral-500 mt-2 text-sm">
                All leads have been processed
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-neutral-200/50">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-600 uppercase tracking-wide">Code</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-600 uppercase tracking-wide">Campaign</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-600 uppercase tracking-wide">Owner Details</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-600 uppercase tracking-wide">Agent</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-600 uppercase tracking-wide">Entry Time</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-neutral-600 uppercase tracking-wide">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map((lead, index) => (
                    <tr 
                      key={lead.id}
                      className={`border-b border-neutral-100/50 smooth-transition ${
                        index % 2 === 0 
                          ? 'bg-neutral-100/70 hover:bg-neutral-150' 
                          : 'hover:bg-neutral-50/50'
                      }`}
                    >
                      {/* Code */}
                      <td className="px-4 py-4 whitespace-nowrap align-middle">
                        <p className="text-sm font-semibold text-neutral-900" style={{ letterSpacing: '-0.01em' }}>
                          {lead.serialNumber}
                        </p>
                      </td>

                      {/* Campaign */}
                      <td className="px-4 py-4 whitespace-nowrap align-middle">
                        <p className="text-sm font-medium text-neutral-700">
                          {lead.campaign?.name || 'No Campaign'}
                        </p>
                      </td>

                      {/* Owner Details */}
                      <td className="px-4 py-4 align-middle">
                        <p className="text-sm font-medium text-neutral-900">
                          {lead.homeownerFirst} {lead.homeownerLast}
                        </p>
                        <p className="text-xs text-neutral-600">{lead.email || 'No email'}</p>
                        <p className="text-xs text-neutral-600">
                          {duplicatePhones.has(lead.phone) && (
                            <span className="text-red-600 font-bold mr-1" title="Duplicate phone number">⚠️</span>
                          )}
                          {lead.phone}
                        </p>
                      </td>

                      {/* Agent Name */}
                      <td className="px-4 py-4 whitespace-nowrap align-middle">
                        <p className="text-sm font-medium text-neutral-700">
                          {lead.agent?.fullName || 'N/A'}
                        </p>
                        <p className="text-xs text-neutral-600">{lead.team?.name || 'No Team'}</p>
                      </td>

                      {/* Entry Time */}
                      <td className="px-4 py-4 whitespace-nowrap align-middle">
                        <p className="text-sm text-neutral-700">
                          {new Date(lead.createdAt).toLocaleTimeString('en-US', { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                        </p>
                        <p className="text-xs text-neutral-600">
                          {new Date(lead.createdAt).toLocaleDateString('en-US', { 
                            month: 'short', 
                            day: 'numeric' 
                          })}
                        </p>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-4 whitespace-nowrap text-center align-middle">
                        <button 
                          onClick={() => viewLeadDetails(lead)}
                          className="p-2 text-gray-600 hover:text-cyan-600 hover:scale-110 rounded-full transition-all duration-200"
                          title="View Details"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default QCDashboard;




