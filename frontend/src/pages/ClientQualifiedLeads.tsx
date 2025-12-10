import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout/Layout';
import api from '../services/api';
import { useToast } from '../contexts/ToastContext';
import { usePageTitle } from '../hooks/usePageTitle';
import { useAuth } from '../contexts/AuthContext';
import * as XLSX from 'xlsx';

interface Lead {
  id: string;
  serialNumber: string;
  homeownerFirst: string;
  homeownerLast: string;
  phone: string;
  email?: string;
  addressText: string;
  marketValue: number;
  askingPrice: number | null;
  bedrooms?: number;
  bathrooms?: number;
  propertyType?: string;
  listingStatus?: string;
  occupancy?: string;
  mortgageYesNo?: boolean;
  mortgageAmount?: number | null;
  closingTimeline?: string;
  motivationRating?: number;
  conditionRating?: number;
  temperature: string;
  campaignName: string;
  callRecordingUrl: string | null;
  starred: boolean;
  clientReviewed: boolean;
  pipelineStage: string;
  createdAt: string;
  updatedAt?: string;
  additionalInfo?: string;
  customFields?: Record<string, any>;
  campaign?: { name: string };
}

const ClientQualifiedLeads: React.FC = () => {
  usePageTitle('Qualified Leads');
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { user } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showStarredOnly, setShowStarredOnly] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<string>('all');
  const [campaigns, setCampaigns] = useState<string[]>([]);
  
  // Date filtering states - default to today
  const [fromDate, setFromDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [toDate, setToDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [showAllLeads, setShowAllLeads] = useState(false);

  useEffect(() => {
    loadLeads();
  }, [fromDate, toDate, showAllLeads]);

  const loadLeads = async () => {
    try {
      setLoading(true);
      const [leadsRes, campaignsRes] = await Promise.all([
        api.get('/client/leads'),
        api.get('/client/campaigns')
      ]);
      
      // Filter to only show leads that are NOT reviewed and NOT closed/dead
      let qualifiedLeads = leadsRes.data.filter((lead: any) => 
        !lead.clientReviewed && 
        lead.pipelineStage !== 'Closed' && 
        lead.pipelineStage !== 'Dead'
      );
      
      // Apply date filtering if not showing all leads
      // Use updatedAt so re-qualified leads show with their latest qualification date
      if (!showAllLeads) {
        qualifiedLeads = qualifiedLeads.filter((lead: any) => {
          const leadDate = new Date(lead.updatedAt || lead.createdAt);
          const from = new Date(fromDate);
          const to = new Date(toDate);
          to.setHours(23, 59, 59, 999); // Include entire end date
          
          return leadDate >= from && leadDate <= to;
        });
      }
      
      setLeads(qualifiedLeads);
      const campaignNames = campaignsRes.data.map((c: any) => c.name);
      setCampaigns(campaignNames);
    } catch (error) {
      showToast('Failed to load qualified leads', 'error');
    } finally {
      setLoading(false);
    }
  };
  
  const toggleShowAll = () => {
    setShowAllLeads(!showAllLeads);
  };

  const toggleStar = async (leadId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const lead = leads.find(l => l.id === leadId);
      await api.patch(`/client/leads/${leadId}/star`, { starred: !lead?.starred });
      setLeads(leads.map(l => l.id === leadId ? { ...l, starred: !l.starred } : l));
      showToast(lead?.starred ? 'Removed from favorites' : 'Added to favorites', 'success');
    } catch (error) {
      showToast('Failed to update favorite status', 'error');
    }
  };

  const markAsReviewed = async (leadId: string) => {
    try {
      await api.patch(`/client/leads/${leadId}/review`);
      showToast('Lead added to pipeline', 'success');
      loadLeads();
    } catch (error) {
      showToast('Failed to add lead to pipeline', 'error');
    }
  };

  const playRecording = (url: string) => {
    window.open(url, '_blank');
  };

  const exportToExcel = () => {
    // Export filtered leads with ALL data fields
    const exportData = filteredLeads.map(lead => {
      const baseData: any = {
        'Serial': lead.serialNumber,
        'First Name': lead.homeownerFirst,
        'Last Name': lead.homeownerLast,
        'Phone': lead.phone,
        'Email': lead.email || '',
        'Address': lead.addressText,
        'Campaign': lead.campaignName,
        'Qualified Date': new Date(lead.updatedAt || lead.createdAt).toLocaleDateString(),
        'Created Date': new Date(lead.createdAt).toLocaleDateString(),
        'Market Value': lead.marketValue || 'N/A',
        'Asking Price': lead.askingPrice || 'N/A',
        'Bedrooms': lead.bedrooms || 'N/A',
        'Bathrooms': lead.bathrooms || 'N/A',
        'Property Type': lead.propertyType || 'N/A',
        'Listing Status': lead.listingStatus || 'N/A',
        'Occupancy': lead.occupancy || 'N/A',
        'Has Mortgage': lead.mortgageYesNo ? 'Yes' : 'No',
        'Mortgage Amount': lead.mortgageAmount || 'N/A',
        'Closing Timeline': lead.closingTimeline || 'N/A',
        'Motivation Rating': lead.motivationRating || 'N/A',
        'Condition Rating': lead.conditionRating || 'N/A',
        'Negotiable': (lead as any).negotiable || 'N/A',
        'License': (lead as any).license || 'N/A',
        'Selling Reason': (lead as any).sellingReason || 'N/A',
        'Ownership Timeline': (lead as any).ownershipTimelineValue && (lead as any).ownershipTimelineUnit 
          ? `${(lead as any).ownershipTimelineValue} ${(lead as any).ownershipTimelineUnit}` 
          : 'N/A',
        'Additional Info': lead.additionalInfo || '',
        'Has Recording': lead.callRecordingUrl ? 'Yes' : 'No',
        'Recording URL': lead.callRecordingUrl || ''
      };

      // Add custom fields if they exist
      if (lead.customFields && typeof lead.customFields === 'object') {
        Object.entries(lead.customFields).forEach(([key, value]) => {
          baseData[`Custom: ${key}`] = Array.isArray(value) ? value.join(', ') : 
                                        typeof value === 'boolean' ? (value ? 'Yes' : 'No') :
                                        value?.toString() || 'N/A';
        });
      }

      return baseData;
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Qualified Leads');
    
    const fileName = `qualified_leads_${selectedCampaign !== 'all' ? selectedCampaign : 'all'}_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };

  const filteredLeads = leads.filter(lead => {
    const matchesSearch = searchQuery === '' ||
      lead.homeownerFirst.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.homeownerLast.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.phone.includes(searchQuery) ||
      lead.addressText.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCampaign = selectedCampaign === 'all' || lead.campaignName === selectedCampaign;
    const matchesStarred = !showStarredOnly || lead.starred;
    
    return matchesSearch && matchesCampaign && matchesStarred;
  });

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
            {/* Title and Stats Row */}
            <div className="flex items-center justify-between mb-5">
              <div>
                <h1 className="text-2xl font-semibold text-gray-900">Qualified Leads</h1>
                <p className="text-sm text-gray-500 mt-1">
                  {showAllLeads ? 'All qualified leads' : `Qualified on ${fromDate === toDate ? new Date(fromDate).toLocaleDateString() : `${new Date(fromDate).toLocaleDateString()} - ${new Date(toDate).toLocaleDateString()}`}`}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-3xl font-bold text-primary">{filteredLeads.length}</p>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Total Leads</p>
                </div>
              </div>
            </div>
            
            {/* Filters Row */}
            <div className="flex items-center gap-3 flex-wrap">
              {/* Search */}
              <div className="relative flex-1 min-w-[250px]">
                <input
                  type="text"
                  placeholder="Search leads..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-4 py-2 pl-10 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary500 focus:border-transparent transition-colors bg-white"
                />
                <svg className="w-4 h-4 absolute left-3 top-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              
              {/* Date Range - Only show if not showing all */}
              {!showAllLeads && (
                <div className="flex items-center gap-2 bg-gray-50 px-4 py-2 rounded-lg border border-gray-200">
                  <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <input
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    className="bg-transparent border-none text-sm focus:outline-none focus:ring-0 p-0 w-[130px]"
                  />
                  <span className="text-gray-400">—</span>
                  <input
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    className="bg-transparent border-none text-sm focus:outline-none focus:ring-0 p-0 w-[130px]"
                  />
                  <button
                    onClick={loadLeads}
                    className="ml-1 p-1.5 text-green-600 hover:text-green-700 hover:bg-green-50 rounded transition-colors"
                    title="Apply date filter"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </button>
                </div>
              )}
              
              {/* Show All Toggle */}
              <button
                onClick={toggleShowAll}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                  showAllLeads 
                    ? 'bg-primary text-white bg-primary-hover' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
                title={showAllLeads ? 'Show today\'s leads' : 'Show all leads'}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
                {showAllLeads ? 'Today' : 'All'}
              </button>
              
              {/* Campaign Filter */}
              <select
                value={selectedCampaign}
                onChange={(e) => setSelectedCampaign(e.target.value)}
                className="px-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary500 focus:border-transparent bg-white"
              >
                <option value="all">All Campaigns</option>
                {campaigns.map((campaign) => (
                  <option key={campaign} value={campaign}>{campaign}</option>
                ))}
              </select>

              {/* Starred Filter */}
              <button
                onClick={() => setShowStarredOnly(!showStarredOnly)}
                title={showStarredOnly ? 'Show all leads' : 'Show starred leads only'}
                className="p-2 transition-all duration-200"
              >
                <span className={`text-2xl ${
                  showStarredOnly
                    ? 'text-transparent bg-gradient-to-br from-amber-400 to-yellow-500 bg-clip-text drop-shadow-[0_1px_2px_rgba(251,191,36,0.5)]'
                    : 'text-slate-300'
                }`}>
                  {showStarredOnly ? '★' : '☆'}
                </span>
              </button>

              {/* Export Button */}
              <button 
                onClick={exportToExcel}
                className="px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Export
              </button>
            </div>
          </div>

          {/* Table Card */}
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-4 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Serial
                  </th>
                  <th className="px-6 py-4 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Homeowner / Phone
                  </th>
                  <th className="px-6 py-4 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Address
                  </th>
                  <th className="px-6 py-4 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Market Value
                  </th>
                  <th className="px-6 py-4 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Asking Price
                  </th>
                  <th className="px-6 py-4 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Campaign
                  </th>
                  <th className="px-6 py-4 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Qualified Date
                  </th>
                  <th className="px-6 py-4 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Recording
                  </th>
                  <th className="px-6 py-4 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Actions
                  </th>
                  <th className="px-6 py-4 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Pipeline
                  </th>
                  <th className="px-6 py-4 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    ⭐
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {filteredLeads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-900 font-medium">
                      {lead.serialNumber}
                    </td>
                    <td className="px-6 py-4 text-center text-sm">
                      <div className="text-gray-900 font-medium">
                        {lead.homeownerFirst} {lead.homeownerLast}
                      </div>
                      <div className="text-gray-500 text-xs mt-0.5">{lead.phone}</div>
                    </td>
                    <td className="px-6 py-4 text-center text-sm text-gray-600">
                      {lead.addressText}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-900 font-medium">
                      ${lead.marketValue.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-900 font-medium">
                      {lead.askingPrice ? `$${lead.askingPrice.toLocaleString()}` : 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-600">
                      {lead.campaignName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-500">
                      {new Date(lead.updatedAt || lead.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      {lead.callRecordingUrl ? (
                        <button 
                          onClick={() => playRecording(lead.callRecordingUrl!)}
                          className="inline-flex items-center justify-center w-8 h-8 rounded-full text-red-600 hover:text-red-700 hover:bg-red-50 transition-colors"
                          title="Play recording"
                        >
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" />
                          </svg>
                        </button>
                      ) : (
                        <span className="text-gray-400 text-sm">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <button
                        onClick={() => navigate(`/client/lead/${lead.id}`)}
                        className="inline-flex items-center justify-center w-8 h-8 rounded-full text-gray-400 hover:text-primary bg-primary-light-hover transition-colors"
                        title="View Details"
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <button
                        onClick={() => markAsReviewed(lead.id)}
                        className="inline-flex items-center justify-center w-8 h-8 rounded-full border-2 border-gray-400 text-gray-400 hover:border-emerald-600 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                        title="Add to Pipeline"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                        </svg>
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <button
                        onClick={(e) => toggleStar(lead.id, e)}
                        className="inline-flex items-center justify-center transition-all duration-200"
                        title={lead.starred ? 'Remove from favorites' : 'Add to favorites'}
                      >
                        <span className={`text-2xl ${
                          lead.starred 
                            ? 'text-transparent bg-gradient-to-br from-amber-400 to-yellow-500 bg-clip-text drop-shadow-[0_1px_2px_rgba(251,191,36,0.5)]' 
                            : 'text-slate-300'
                        }`}>
                          {lead.starred ? '★' : '☆'}
                        </span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {filteredLeads.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                <p className="text-lg font-medium">No qualified leads yet</p>
                <p className="text-sm mt-2">Leads will appear here once they are qualified by QC</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default ClientQualifiedLeads;




