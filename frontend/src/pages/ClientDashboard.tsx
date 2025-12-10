import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout/Layout';
import api from '../services/api';
import * as XLSX from 'xlsx';
import { Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Line, ComposedChart } from 'recharts';
import { useAuth } from '../contexts/AuthContext';
import { usePageTitle } from '../hooks/usePageTitle';
import { useToast } from '../contexts/ToastContext';

interface Campaign {
  id: string;
  name: string;
  leadsTarget: number;
  achieved: number;
  hot: number;
  warm: number;
  cold: number;
  noAskingPrice: number;
  progress: number;
}

interface ClientNote {
  id: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

interface Lead {
  id: string;
  serialNumber: string;
  homeownerFirst: string;
  homeownerLast: string;
  phone: string;
  email: string;
  addressText: string;
  marketValue: number;
  askingPrice: number | null;
  bedrooms: number;
  bathrooms: number;
  motivationRating: number;
  conditionRating: number;
  temperature: string;
  campaign?: { name: string; formTemplateId?: string };
  campaignName: string;
  createdAt: string;
  callRecordingUrl: string | null;
  starred: boolean;
  clientReviewed: boolean;
  clientNotes: ClientNote[];
  // Additional fields
  negotiable: string | null;
  license: string | null;
  propertyType: string | null;
  sellingReason: string | null;
  ownershipTimelineValue: number | null;
  ownershipTimelineUnit: string | null;
  listingStatus: string;
  occupancy: string;
  mortgageYesNo: boolean;
  mortgageAmount: number | null;
  closingTimeline: string;
  additionalInfo: string | null;
  customFields?: Record<string, any>;
}

const ClientDashboard: React.FC = () => {
  usePageTitle('Client Dashboard');
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showSuccess, showError } = useToast();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [dailyPerformance, setDailyPerformance] = useState<any[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<string>('all');
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [showLeadDetails, setShowLeadDetails] = useState(false);
  const [loading, setLoading] = useState(true);
  const [playingRecording, setPlayingRecording] = useState<string | null>(null);
  const [showStarredOnly, setShowStarredOnly] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteContent, setEditingNoteContent] = useState('');
  const [dateRange, setDateRange] = useState(30); // days

  useEffect(() => {
    loadDashboardData();
  }, [dateRange]);

  const loadDashboardData = async () => {
    try {
      const endDate = new Date();
      const startDate = new Date(Date.now() - dateRange * 24 * 60 * 60 * 1000);
      
      const [campaignsRes, leadsRes, performanceRes] = await Promise.all([
        api.get('/client/campaigns'),
        api.get('/client/leads'),
        api.get('/client/daily-performance', {
          params: {
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString()
          }
        })
      ]);
      setCampaigns(campaignsRes.data);
      setLeads(leadsRes.data);
      setDailyPerformance(performanceRes.data);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleStar = async (leadId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    try {
      const response = await api.patch(`/client/leads/${leadId}/star`);
      setLeads(leads.map(lead => 
        lead.id === leadId ? { ...lead, starred: response.data.starred } : lead
      ));
      if (selectedLead?.id === leadId) {
        setSelectedLead({ ...selectedLead, starred: response.data.starred });
      }
    } catch (error) {
      console.error('Failed to toggle star:', error);
    }
  };

  const addNote = async () => {
    if (!selectedLead || !newNote.trim()) return;
    try {
      const response = await api.post(`/client/leads/${selectedLead.id}/notes`, {
        content: newNote.trim()
      });
      const updatedLead = {
        ...selectedLead,
        clientNotes: [response.data, ...selectedLead.clientNotes]
      };
      setSelectedLead(updatedLead);
      setLeads(leads.map(lead => lead.id === selectedLead.id ? updatedLead : lead));
      setNewNote('');
    } catch (error) {
      console.error('Failed to add note:', error);
    }
  };

  const updateNote = async (noteId: string) => {
    if (!editingNoteContent.trim()) return;
    try {
      const response = await api.put(`/client/notes/${noteId}`, {
        content: editingNoteContent.trim()
      });
      if (selectedLead) {
        const updatedLead = {
          ...selectedLead,
          clientNotes: selectedLead.clientNotes.map(note =>
            note.id === noteId ? response.data : note
          )
        };
        setSelectedLead(updatedLead);
        setLeads(leads.map(lead => lead.id === selectedLead.id ? updatedLead : lead));
      }
      setEditingNoteId(null);
      setEditingNoteContent('');
    } catch (error) {
      console.error('Failed to update note:', error);
    }
  };

  const deleteNote = async (noteId: string) => {
    if (!window.confirm('Are you sure you want to delete this note?')) return;
    try {
      await api.delete(`/client/notes/${noteId}`);
      if (selectedLead) {
        const updatedLead = {
          ...selectedLead,
          clientNotes: selectedLead.clientNotes.filter(note => note.id !== noteId)
        };
        setSelectedLead(updatedLead);
        setLeads(leads.map(lead => lead.id === selectedLead.id ? updatedLead : lead));
      }
      showSuccess('Note deleted successfully');
    } catch (error) {
      console.error('Failed to delete note:', error);
      showError('Failed to delete note');
    }
  };

  // Filter out reviewed leads (they're in the pipeline now)
  let filteredLeads = leads.filter(lead => !lead.clientReviewed);
  
  // Apply campaign filter
  if (selectedCampaign !== 'all') {
    filteredLeads = filteredLeads.filter(lead => lead.campaignName === selectedCampaign);
  }
  
  // Apply starred filter
  if (showStarredOnly) {
    filteredLeads = filteredLeads.filter(lead => lead.starred);
  }

  const playRecording = (recordingUrl: string) => {
    setPlayingRecording(recordingUrl);
  };

  const markAsReviewed = async (leadId: string) => {
    try {
      await api.patch(`/client/leads/${leadId}/review`);
      await loadDashboardData();
      showSuccess('Lead marked as reviewed successfully');
    } catch (error: any) {
      console.error('Failed to mark lead as reviewed:', error);
      showError(error.response?.data?.error || 'Failed to mark lead as reviewed');
    }
  };

  const exportToExcel = () => {
    const exportData = filteredLeads.map(lead => ({
      'Serial Number': lead.serialNumber,
      'First Name': lead.homeownerFirst,
      'Last Name': lead.homeownerLast,
      'Phone': lead.phone,
      'Email': lead.email || '',
      'Address': lead.addressText,
      'Market Value': lead.marketValue,
      'Asking Price': lead.askingPrice || 'N/A',
      'Bedrooms': lead.bedrooms,
      'Bathrooms': lead.bathrooms,
      'Property Type': lead.propertyType || '',
      'Listing Status': lead.listingStatus,
      'Occupancy': lead.occupancy,
      'Mortgage': lead.mortgageYesNo ? 'Yes' : 'No',
      'Mortgage Amount': lead.mortgageAmount || '',
      'Motivation Rating': lead.motivationRating,
      'Condition Rating': lead.conditionRating,
      'Negotiable': lead.negotiable || '',
      'Closing Timeline': lead.closingTimeline,
      'Campaign': lead.campaignName,
      'Qualified Date': new Date(lead.createdAt).toLocaleDateString(),
      'Starred': lead.starred ? 'Yes' : 'No'
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Qualified Leads');
    
    const fileName = `qualified_leads_${selectedCampaign}_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(workbook, fileName);
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
        {/* Client Name Card */}
        <div className="mb-8">
          <div className="bg-white rounded-2xl py-16 px-8 border border-gray-100">
            <div className="text-center">
              <p className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-4">
                Client
              </p>
              <p className="text-4xl font-semibold text-gray-900">
                {user?.fullName || 'Unknown'}
              </p>
            </div>
          </div>
        </div>

        {/* Campaign Stats - Today's Leads */}
        <div className="mb-8 w-1/2">
          <div className="bg-white rounded-2xl border border-gray-100 p-6">
            {(() => {
              // Calculate leads for each campaign
              const campaignData = campaigns.map((campaign) => {
                const todayLeads = leads.filter(lead => {
                  const leadDate = new Date(lead.createdAt);
                  const today = new Date();
                  return lead.campaignName === campaign.name &&
                         leadDate.toDateString() === today.toDateString();
                });
                return {
                  ...campaign,
                  todayCount: todayLeads.length
                };
              });

              // Find the maximum count for progress bar calculation
              const maxCount = Math.max(...campaignData.map(c => c.todayCount), 1);
              const totalLeads = campaignData.reduce((sum, c) => sum + c.todayCount, 0);

              return (
                <div className="space-y-4">
                  {/* Summary header */}
                  <div className="flex items-center justify-between pb-4 border-b border-gray-100">
                    <div className="flex items-center gap-2">
                      <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                      <span className="text-sm font-medium text-gray-600">Total Today:</span>
                      <span className="text-lg font-bold text-primary">{totalLeads}</span>
                    </div>
                    <div className="text-xs text-gray-500">
                      {campaigns.length} active campaigns
                    </div>
                  </div>

                  {/* Campaign list with progress bars */}
                  <div className="space-y-3">
                    {campaignData
                      .sort((a, b) => b.todayCount - a.todayCount) // Sort by lead count descending
                      .map((campaign) => {
                        const percentage = maxCount > 0 ? (campaign.todayCount / maxCount) * 100 : 0;
                        const sharePercentage = totalLeads > 0 ? (campaign.todayCount / totalLeads) * 100 : 0;
                        
                        return (
                          <div key={campaign.id} className="flex items-center gap-4 p-3 rounded-lg hover:bg-gray-50 transition-colors">
                            {/* Campaign name */}
                            <div className="w-48 flex-shrink-0">
                              <h3 className="text-sm font-medium text-gray-900 truncate" title={campaign.name}>
                                {campaign.name}
                              </h3>
                              <p className="text-xs text-gray-500">
                                {sharePercentage.toFixed(1)}% of total
                              </p>
                            </div>
                            
                            {/* Progress bar */}
                            <div className="flex-1 flex items-center gap-3">
                              <div className="flex-1 bg-gray-200 rounded-full h-3 relative overflow-hidden">
                                <div 
                                  className="bg-primary h-full rounded-full transition-all duration-500 ease-out"
                                  style={{ width: `${percentage}%` }}
                                ></div>
                              </div>
                              
                              {/* Count display */}
                              <div className="flex items-center gap-2 min-w-[60px]">
                                <span className="text-lg font-bold text-gray-900">
                                  {campaign.todayCount}
                                </span>
                                <span className="text-xs text-gray-500">
                                  leads
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>


                </div>
              );
            })()}
          </div>
        </div>



        {/* OLD Leads List - HIDDEN */}
        <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden" style={{ display: 'none' }}>
          <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center">
            <div className="flex items-center space-x-4">
              <h2 className="text-lg font-medium text-gray-900">Qualified Leads</h2>
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
            </div>
            <div className="flex items-center space-x-3">
              <select
                value={selectedCampaign}
                onChange={(e) => setSelectedCampaign(e.target.value)}
                className="px-4 py-2 border border-gray-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-gray-900 focus:border-transparent bg-white transition-all"
              >
                <option value="all">All Campaigns</option>
                {campaigns.map((campaign) => (
                  <option key={campaign.id} value={campaign.name}>{campaign.name}</option>
                ))}
              </select>
              <button 
                onClick={exportToExcel}
                className="px-5 py-2 bg-emerald-600 text-white text-sm font-medium rounded-xl hover:bg-emerald-700 transition-colors shadow-sm"
              >
                Export to Excel
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Serial</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Homeowner / Phone</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Address</th>
                  <th className="px-6 py-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Market Value</th>
                  <th className="px-6 py-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Asking Price</th>
                  <th className="px-6 py-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Campaign</th>
                  <th className="px-6 py-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Recording</th>
                  <th className="px-6 py-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  <th className="px-6 py-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Pipeline</th>
                  <th className="px-6 py-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">⭐</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredLeads.map((lead) => {
                  return (
                    <tr key={lead.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-left text-gray-900 font-medium">{lead.serialNumber}</td>
                      <td className="px-6 py-4 text-sm">
                        <div className="text-gray-900 font-medium">
                          {lead.homeownerFirst} {lead.homeownerLast}
                        </div>
                        <div className="text-gray-500 text-xs mt-0.5" >{lead.phone}</div>
                      </td>
                      <td className="px-6 py-4 text-sm text-left text-gray-600" >{lead.addressText}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-900 font-medium">
                        ${lead.marketValue.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-900 font-medium">
                        {lead.askingPrice ? `$${lead.askingPrice.toLocaleString()}` : 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-600" >{lead.campaignName}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        {lead.callRecordingUrl ? (
                          <button 
                            onClick={() => playRecording(lead.callRecordingUrl!)}
                            className="text-red-600 hover:text-red-700 transition-colors"
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
                          className="text-primary text-primary-hover text-sm font-medium transition-colors"
                        >
                          View
                        </button>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        {!lead.clientReviewed && (
                          <button
                            onClick={() => markAsReviewed(lead.id)}
                            className="inline-flex items-center justify-center rounded-full border-2 border-slate-400 text-gray-400 hover:border-emerald-600 hover:text-emerald-600 transition-colors"
                            title="Add to Pipeline"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                            </svg>
                          </button>
                        )}
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
                  );
                })}
              </tbody>
            </table>
          </div>

          {filteredLeads.length === 0 && (
            <div className="text-center py-12 text-gray-500 bg-gray-50">
              <p className="text-lg font-medium">No qualified leads yet</p>
              <p className="text-sm mt-2" >Leads will appear here once they are qualified by QC</p>
            </div>
          )}
        </div>

        {/* Daily Performance Chart */}
        <div className="bg-white border border-slate-100 shadow-sm mt-8 rounded-xl">
          <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center">
            <div>
              <h2 className="text-lg text-gray-900" >Daily Performance</h2>
              <p className="text-sm text-gray-500 mt-1" >Combined daily target across all campaigns</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setDateRange(7)}
                className={`px-4 py-2 text-sm rounded-lg transition-colors ${
                  dateRange === 7 ? 'bg-primary text-white' : 'bg-gray-50 text-slate-700 hover:bg-slate-100'
                }`}
                
              >
                7 Days
              </button>
              <button
                onClick={() => setDateRange(30)}
                className={`px-4 py-2 text-sm rounded-lg transition-colors ${
                  dateRange === 30 ? 'bg-primary text-white' : 'bg-gray-50 text-slate-700 hover:bg-slate-100'
                }`}
                
              >
                30 Days
              </button>
              <button
                onClick={() => setDateRange(90)}
                className={`px-4 py-2 text-sm rounded-lg transition-colors ${
                  dateRange === 90 ? 'bg-primary text-white' : 'bg-gray-50 text-slate-700 hover:bg-slate-100'
                }`}
                
              >
                90 Days
              </button>
            </div>
          </div>
          <div className="p-6">
            <ResponsiveContainer width="100%" height={400}>
              <ComposedChart data={dailyPerformance}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis 
                  dataKey="date" 
                  tick={{ fill: '#6b7280', fontSize: 11, fontFamily: 'Manrope, sans-serif' }}
                  tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                />
                <YAxis tick={{ fill: '#6b7280', fontSize: 12, fontFamily: 'Manrope, sans-serif' }} label={{ value: 'Leads', angle: -90, position: 'insideLeft' }} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#fff', 
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    fontFamily: 'Manrope, sans-serif'
                  }}
                  labelFormatter={(value) => new Date(value).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                />
                <Legend 
                  wrapperStyle={{ paddingTop: '20px', fontFamily: 'Manrope, sans-serif' }}
                  iconType="square"
                />
                <Bar 
                  dataKey="achieved" 
                  fill="#0891b2" 
                  name="Achieved Leads"
                  radius={[4, 4, 0, 0]}
                />
                <Line 
                  type="monotone" 
                  dataKey="target" 
                  stroke="#ef4444" 
                  strokeWidth={3}
                  name="Daily Target"
                  dot={false}
                  strokeDasharray="5 5"
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Lead Details Modal */}
        {showLeadDetails && selectedLead && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm overflow-y-auto h-full w-full z-50 flex items-start justify-center pt-8 pb-8">
            <div className="relative mx-auto w-full max-w-4xl bg-white shadow-2xl rounded-lg max-h-[90vh] overflow-y-auto">
              {/* Header */}
              <div className="sticky top-0 bg-white border-b border-gray-200 px-8 py-6 flex justify-between items-center z-10 rounded-t-lg">
                <div>
                  <h3 className="text-xl font-semibold text-gray-900">
                    {selectedLead.homeownerFirst} {selectedLead.homeownerLast}
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">Serial: {selectedLead.serialNumber}</p>
                </div>
                <div className="flex items-center space-x-4">
                  <button
                    onClick={() => setShowLeadDetails(false)}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Body */}
              <div className="p-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Contact Information */}
                  <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
                    <h4 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-4">Contact Information</h4>
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs text-gray-500 uppercase">Phone</label>
                        <p className="text-sm font-medium text-gray-900">{selectedLead.phone}</p>
                      </div>
                      {selectedLead.email && (
                        <div>
                          <label className="text-xs text-gray-500 uppercase">Email</label>
                          <p className="text-sm font-medium text-gray-900">{selectedLead.email}</p>
                        </div>
                      )}
                      <div>
                        <label className="text-xs text-gray-500 uppercase">Address</label>
                        <p className="text-sm font-medium text-gray-900">{selectedLead.addressText}</p>
                      </div>
                    </div>
                  </div>

                  {/* Property Details */}
                  {(
                  <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
                    <h4 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-4">Property Details</h4>
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs text-gray-500 uppercase">Bedrooms</label>
                          <p className="text-sm font-medium text-gray-900">{selectedLead.bedrooms}</p>
                        </div>
                        <div>
                          <label className="text-xs text-gray-500 uppercase">Bathrooms</label>
                          <p className="text-sm font-medium text-gray-900">{selectedLead.bathrooms}</p>
                        </div>
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 uppercase">Market Value</label>
                        <p className="text-sm font-medium text-gray-900">${selectedLead.marketValue.toLocaleString()}</p>
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 uppercase">Asking Price</label>
                        <p className="text-sm font-medium text-gray-900">
                          {selectedLead.askingPrice ? `$${selectedLead.askingPrice.toLocaleString()}` : 'Not specified'}
                        </p>
                      </div>
                      {selectedLead.negotiable && (
                        <div>
                          <label className="text-xs text-gray-500 uppercase">Negotiable</label>
                          <p className="text-sm font-medium text-gray-900">{selectedLead.negotiable}</p>
                        </div>
                      )}
                      {selectedLead.propertyType && (
                        <div>
                          <label className="text-xs text-gray-500 uppercase">Property Type</label>
                          <p className="text-sm font-medium text-gray-900">{selectedLead.propertyType}</p>
                        </div>
                      )}
                    </div>
                  </div>
                  )}

                  {/* Listing & Occupancy - Only show if NO custom fields */}
                  {(!selectedLead.customFields || Object.keys(selectedLead.customFields).length === 0) && (
                  <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
                    <h4 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-4">Listing & Occupancy</h4>
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs text-gray-500 uppercase">Listing Status</label>
                        <p className="text-sm font-medium text-gray-900">{selectedLead.listingStatus.replace(/([A-Z])/g, ' $1').trim()}</p>
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 uppercase">Occupancy</label>
                        <p className="text-sm font-medium text-gray-900">{selectedLead.occupancy.replace(/([A-Z])/g, ' $1').trim()}</p>
                      </div>
                      {selectedLead.ownershipTimelineValue && selectedLead.ownershipTimelineUnit && (
                        <div>
                          <label className="text-xs text-gray-500 uppercase">Ownership Timeline</label>
                          <p className="text-sm font-medium text-gray-900">
                            {selectedLead.ownershipTimelineValue} {selectedLead.ownershipTimelineUnit}
                          </p>
                        </div>
                      )}
                      <div>
                        <label className="text-xs text-gray-500 uppercase">Closing Timeline</label>
                        <p className="text-sm font-medium text-gray-900">{selectedLead.closingTimeline.replace(/([A-Z])/g, ' $1').trim()}</p>
                      </div>
                      {selectedLead.license && (
                        <div>
                          <label className="text-xs text-gray-500 uppercase">License</label>
                          <p className="text-sm font-medium text-gray-900">{selectedLead.license}</p>
                        </div>
                      )}
                    </div>
                  </div>
                  )}

                  {/* Financial Information - Only show if NO custom fields */}
                  {(!selectedLead.customFields || Object.keys(selectedLead.customFields).length === 0) && (
                  <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
                    <h4 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-4">Financial Information</h4>
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs text-gray-500 uppercase">Mortgage</label>
                        <p className="text-sm font-medium text-gray-900">{selectedLead.mortgageYesNo ? 'Yes' : 'No'}</p>
                      </div>
                      {selectedLead.mortgageYesNo && selectedLead.mortgageAmount && (
                        <div>
                          <label className="text-xs text-gray-500 uppercase">Mortgage Amount</label>
                          <p className="text-sm font-medium text-gray-900">${selectedLead.mortgageAmount.toLocaleString()}</p>
                        </div>
                      )}
                      {selectedLead.sellingReason && (
                        <div>
                          <label className="text-xs text-gray-500 uppercase">Selling Reason</label>
                          <p className="text-sm font-medium text-gray-900">{selectedLead.sellingReason}</p>
                        </div>
                      )}
                    </div>
                  </div>
                  )}

                  {/* Ratings - Only show if NO custom fields */}
                  {(!selectedLead.customFields || Object.keys(selectedLead.customFields).length === 0) && (
                  <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
                    <h4 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-4">Ratings</h4>
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs text-gray-500 uppercase">Motivation Rating</label>
                        <div className="flex items-center mt-1">
                          <div className="flex-1 bg-gray-200 h-2">
                            <div 
                              className="bg-green-600 h-2" 
                              style={{ width: `${selectedLead.motivationRating * 10}%` }}
                            ></div>
                          </div>
                          <span className="ml-3 text-sm font-semibold text-gray-900">{selectedLead.motivationRating}/10</span>
                        </div>
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 uppercase">Condition Rating</label>
                        <div className="flex items-center mt-1">
                          <div className="flex-1 bg-gray-200 h-2">
                            <div 
                              className="bg-primary h-2" 
                              style={{ width: `${selectedLead.conditionRating * 10}%` }}
                            ></div>
                          </div>
                          <span className="ml-3 text-sm font-semibold text-gray-900">{selectedLead.conditionRating}/10</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  )}
                </div>

                {/* Additional Information */}
                {selectedLead.additionalInfo && (
                  <div className="mt-6 bg-gray-50 p-6 rounded-lg border border-gray-200">
                    <h4 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-4">Additional Information</h4>
                    <p className="text-sm text-gray-900 whitespace-pre-wrap">{selectedLead.additionalInfo}</p>
                  </div>
                )}

                {/* Campaign Info */}
                <div className="mt-6 bg-gray-50 p-6 rounded-lg border border-gray-200">
                  <h4 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-4">Campaign Information</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-gray-500 uppercase">Campaign</label>
                      <p className="text-sm font-medium text-gray-900">{selectedLead.campaignName}</p>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 uppercase">Qualified Date</label>
                      <p className="text-sm font-medium text-gray-900">
                        {new Date(selectedLead.createdAt).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Call Recording */}
                {selectedLead.callRecordingUrl && (
                  <div className="mt-6 bg-gray-50 p-6 rounded-lg border border-gray-200">
                    <h4 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-4">Call Recording</h4>
                    <div className="flex gap-3">
                      <button 
                        onClick={() => playRecording(selectedLead.callRecordingUrl!)}
                        className="flex-1 px-6 py-3 bg-primary text-white text-sm font-medium rounded-lg transition-colors duration-200 shadow-sm"
                      >
                        Play Recording
                      </button>
                      <a
                        href={selectedLead.callRecordingUrl}
                        download
                        className="flex-1 px-6 py-3 bg-slate-100 text-slate-700 text-sm font-medium text-center rounded-lg transition-colors duration-200 border border-slate-200"
                      >
                        Download
                      </a>
                    </div>
                  </div>
                )}

                {/* Client Notes */}
                <div className="mt-6 bg-gray-50 p-6 rounded-lg border border-gray-200">
                  <h4 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-4">My Notes</h4>
                  
                  {/* Add New Note */}
                  <div className="mb-4">
                    <textarea
                      value={newNote}
                      onChange={(e) => setNewNote(e.target.value)}
                      placeholder="Add a private note about this lead..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary500 focus:border-primary500 text-sm"
                      rows={3}
                    />
                    <button
                      onClick={addNote}
                      disabled={!newNote.trim()}
                      className="mt-2 px-4 py-2 bg-primary text-white text-sm font-medium rounded bg-primary-hover disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                    >
                      Add Note
                    </button>
                  </div>

                  {/* Notes List */}
                  <div className="space-y-3">
                    {selectedLead.clientNotes && selectedLead.clientNotes.length > 0 ? (
                      selectedLead.clientNotes.map((note) => (
                        <div key={note.id} className="bg-white p-4 rounded-lg border border-gray-200">
                          {editingNoteId === note.id ? (
                            <div>
                              <textarea
                                value={editingNoteContent}
                                onChange={(e) => setEditingNoteContent(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary500 text-sm"
                                rows={3}
                              />
                              <div className="mt-2 flex gap-2">
                                <button
                                  onClick={() => updateNote(note.id)}
                                  className="px-3 py-1 bg-primary text-white text-sm rounded bg-primary-hover"
                                >
                                  Save
                                </button>
                                <button
                                  onClick={() => {
                                    setEditingNoteId(null);
                                    setEditingNoteContent('');
                                  }}
                                  className="px-3 py-1 bg-gray-200 text-gray-700 text-sm rounded hover:bg-gray-300"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div>
                              <p className="text-sm text-gray-900 whitespace-pre-wrap">{note.content}</p>
                              <div className="mt-2 flex items-center justify-between">
                                <span className="text-xs text-gray-500">
                                  {new Date(note.createdAt).toLocaleString()}
                                </span>
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => {
                                      setEditingNoteId(note.id);
                                      setEditingNoteContent(note.content);
                                    }}
                                    className="text-primary hover:text-cyan-800 text-sm font-medium"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    onClick={() => deleteNote(note.id)}
                                    className="text-red-600 hover:text-red-800 text-sm font-medium"
                                  >
                                    Delete
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-gray-500 text-center py-4">No notes yet. Add your first note above.</p>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="mt-6 flex justify-end">
                  <button
                    onClick={() => setShowLeadDetails(false)}
                    className="px-6 py-2 bg-slate-600 text-white text-sm font-medium rounded hover:bg-slate-700 transition-colors shadow-sm"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Audio Player Modal */}
        {playingRecording && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden border border-gray-100">
              {/* Header */}
              <div className="bg-gradient-to-r from-slate-50 to-gray-50 px-8 py-6 border-b border-gray-200">
                <div className="flex justify-between items-center">
                  <h3 className="text-xl font-semibold text-gray-900">Call Recording</h3>
                  <button
                    onClick={() => setPlayingRecording(null)}
                    className="text-gray-400 text-2xl leading-none transition-colors duration-200"
                  >
                    ×
                  </button>
                </div>
              </div>
              
              {/* Body */}
              <div className="p-8 space-y-6">
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <audio 
                    controls 
                    autoPlay
                    className="w-full"
                    src={playingRecording}
                  >
                    Your browser does not support the audio element.
                  </audio>
                </div>
                
                {/* Actions */}
                <div className="flex gap-3">
                  <a
                    href={playingRecording}
                    download
                    className="flex-1 px-6 py-3 bg-primary text-white text-sm font-medium text-center rounded-lg transition-colors duration-200 shadow-sm"
                  >
                    Download
                  </a>
                  <button
                    onClick={() => setPlayingRecording(null)}
                    className="flex-1 px-6 py-3 bg-slate-100 text-slate-700 text-sm font-medium rounded-lg transition-colors duration-200 border border-slate-200"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        </div>
      </div>
    </Layout>
  );
};

export default ClientDashboard;






