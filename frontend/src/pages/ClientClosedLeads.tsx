import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout/Layout';
import api from '../services/api';
import { useToast } from '../contexts/ToastContext';

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
  email?: string;
  addressText: string;
  pipelineStage: string;
  lastUpdated: string;
  temperature: string;
  clientNotes?: ClientNote[];
  campaign?: { name: string; formTemplateId?: string };
  // Additional details
  marketValue?: number;
  askingPrice?: number;
  bedrooms?: number;
  bathrooms?: number;
  propertyType?: string;
  listingStatus?: string;
  occupancy?: string;
  mortgageYesNo?: boolean;
  mortgageAmount?: number;
  closingTimeline?: string;
  motivationRating?: number;
  conditionRating?: number;
  callRecordingUrl?: string;
  additionalInfo?: string;
  customFields?: Record<string, any>;
}

const ClientClosedLeads: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [selectedLeadTemplate, setSelectedLeadTemplate] = useState<any>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteContent, setEditingNoteContent] = useState('');
  const [playingRecording, setPlayingRecording] = useState<string | null>(null);
  
  // Date filtering states - default to today
  const [fromDate, setFromDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [toDate, setToDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });

  useEffect(() => {
    loadLeads();
  }, []);

  const loadLeads = async () => {
    try {
      const response = await api.get('/client/leads');
      const closedLeads = response.data
        .filter((lead: any) => {
          if (lead.pipelineStage !== 'Closed') return false;
          
          // Apply date filtering
          const leadDate = new Date(lead.updatedAt || lead.createdAt);
          const from = new Date(fromDate);
          const to = new Date(toDate);
          to.setHours(23, 59, 59, 999); // Include entire end date
          
          return leadDate >= from && leadDate <= to;
        })
        .map((lead: any) => ({
          id: lead.id,
          serialNumber: lead.serialNumber,
          homeownerFirst: lead.homeownerFirst,
          homeownerLast: lead.homeownerLast,
          phone: lead.phone,
          addressText: lead.addressText,
          pipelineStage: lead.pipelineStage,
          lastUpdated: lead.updatedAt || lead.createdAt,
          temperature: lead.temperature || 'Cold',
          clientNotes: lead.clientNotes || []
        }));
      setLeads(closedLeads);
    } catch (error) {
      showToast('Failed to load closed leads', 'error');
    } finally {
      setLoading(false);
    }
  };

  const openDetailsModal = async (leadId: string) => {
    try {
      const response = await api.get(`/client/leads`);
      const fullLead = response.data.find((l: any) => l.id === leadId);
      if (fullLead) {
        setSelectedLead(fullLead);
        
        // Fetch template if lead has custom fields
        if (fullLead.campaign?.formTemplateId) {
          try {
            const templateResponse = await api.get(`/form-templates/${fullLead.campaign.formTemplateId}`);
            setSelectedLeadTemplate(templateResponse.data);
          } catch (error) {
            console.error('Failed to load template:', error);
            setSelectedLeadTemplate(null);
          }
        } else {
          setSelectedLeadTemplate(null);
        }
        
        setShowDetailsModal(true);
      }
    } catch (error) {
      showToast('Failed to load lead details', 'error');
    }
  };

  const closeDetailsModal = () => {
    setShowDetailsModal(false);
    setSelectedLead(null);
    setSelectedLeadTemplate(null);
    setNewNote('');
    setEditingNoteId(null);
    setEditingNoteContent('');
  };

  const addNote = async () => {
    if (!selectedLead || !newNote.trim()) return;
    try {
      const response = await api.post(`/client/leads/${selectedLead.id}/notes`, {
        content: newNote.trim()
      });
      const updatedLead = {
        ...selectedLead,
        clientNotes: [response.data, ...(selectedLead.clientNotes || [])]
      };
      setSelectedLead(updatedLead);
      setLeads(leads.map(lead => lead.id === selectedLead.id ? updatedLead : lead));
      setNewNote('');
      showToast('Note added successfully', 'success');
      loadLeads(); // Reload to get updated data
    } catch (error) {
      showToast('Failed to add note', 'error');
    }
  };

  const updateNote = async (noteId: string) => {
    if (!editingNoteContent.trim() || !selectedLead) return;
    try {
      const response = await api.put(`/client/notes/${noteId}`, {
        content: editingNoteContent.trim()
      });
      const updatedLead = {
        ...selectedLead,
        clientNotes: (selectedLead.clientNotes || []).map(note =>
          note.id === noteId ? response.data : note
        )
      };
      setSelectedLead(updatedLead);
      setLeads(leads.map(lead => lead.id === selectedLead.id ? updatedLead : lead));
      setEditingNoteId(null);
      setEditingNoteContent('');
      showToast('Note updated successfully', 'success');
    } catch (error) {
      showToast('Failed to update note', 'error');
    }
  };

  const deleteNote = async (noteId: string) => {
    if (!confirm('Are you sure you want to delete this note?') || !selectedLead) return;
    try {
      await api.delete(`/client/notes/${noteId}`);
      const updatedLead = {
        ...selectedLead,
        clientNotes: (selectedLead.clientNotes || []).filter(note => note.id !== noteId)
      };
      setSelectedLead(updatedLead);
      setLeads(leads.map(lead => lead.id === selectedLead.id ? updatedLead : lead));
      showToast('Note deleted successfully', 'success');
    } catch (error) {
      showToast('Failed to delete note', 'error');
    }
  };

  const filteredLeads = leads.filter(lead =>
    searchQuery === '' ||
    lead.homeownerFirst.toLowerCase().includes(searchQuery.toLowerCase()) ||
    lead.homeownerLast.toLowerCase().includes(searchQuery.toLowerCase()) ||
    lead.phone.includes(searchQuery) ||
    lead.addressText.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
            {/* Title */}
            <div className="mb-5">
              <h1 className="text-2xl font-semibold text-gray-900">Closed Leads</h1>
            </div>
            
            {/* Filters Row */}
            <div className="flex items-center gap-4 flex-wrap">
              {/* Search */}
              <div className="relative flex-1 min-w-[250px]">
                <input
                  type="text"
                  placeholder="Search leads..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-4 py-2 pl-10 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-colors bg-white"
                />
                <svg className="w-4 h-4 absolute left-3 top-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              
              {/* Date Range */}
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
            </div>
          </div>

          {/* Table Card */}
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-4 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Lead
                  </th>
                  <th className="px-6 py-4 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Address
                  </th>
                  <th className="px-6 py-4 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Phone
                  </th>
                  <th className="px-6 py-4 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Closed Date
                  </th>
                  <th className="px-6 py-4 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {filteredLeads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="text-gray-900 text-sm font-medium">
                        {lead.homeownerFirst} {lead.homeownerLast}
                      </div>
                      <div className="text-xs text-gray-500">{lead.serialNumber}</div>
                    </td>
                    <td className="px-6 py-4 text-center text-sm text-gray-600">
                      {lead.addressText}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-900">
                      {lead.phone}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-500">
                      {new Date(lead.lastUpdated).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <button
                        onClick={() => navigate(`/client/lead/${lead.id}`)}
                        className="inline-flex items-center justify-center w-8 h-8 rounded-full text-gray-400 hover:text-cyan-600 hover:bg-cyan-50 transition-colors"
                        title="View Details"
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {filteredLeads.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                <p className="text-lg font-medium">No closed leads yet</p>
                <p className="text-sm mt-2">Closed deals will appear here</p>
              </div>
            )}
          </div>
        </div>

        {/* Details Modal */}
        {showDetailsModal && selectedLead && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white max-w-4xl w-full overflow-hidden rounded-xl border border-slate-100 shadow-2xl max-h-[90vh] overflow-y-auto">
              <div className="bg-white px-8 py-6 border-b border-slate-100">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-xl text-slate-900" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 600 }}>
                      {selectedLead.homeownerFirst} {selectedLead.homeownerLast}
                    </h3>
                    <p className="text-sm text-slate-500 mt-1" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 400 }}>Serial: {selectedLead.serialNumber}</p>
                  </div>
                  <button
                    onClick={closeDetailsModal}
                    className="text-slate-400 hover:text-slate-600 text-2xl leading-none transition-colors"
                  >
                    ×
                  </button>
                </div>
              </div>

              <div className="p-8" style={{ backgroundColor: '#f7f6f5' }}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  {/* Contact Information */}
                  <div className="bg-white rounded-lg p-6 border border-slate-100">
                    <h4 className="text-xs text-slate-900 uppercase tracking-wider mb-4" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 600 }}>Contact Information</h4>
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs text-slate-500 uppercase tracking-wide" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 500 }}>Phone</label>
                        <p className="text-sm text-slate-900 mt-1" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 500 }}>{selectedLead.phone}</p>
                      </div>
                      {selectedLead.email && (
                        <div>
                          <label className="text-xs text-slate-500 uppercase tracking-wide" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 500 }}>Email</label>
                          <p className="text-sm text-slate-900 mt-1" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 500 }}>{selectedLead.email}</p>
                        </div>
                      )}
                      <div>
                        <label className="text-xs text-slate-500 uppercase tracking-wide" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 500 }}>Address</label>
                        <p className="text-sm text-slate-900 mt-1" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 500 }}>{selectedLead.addressText}</p>
                      </div>
                    </div>
                  </div>

                  {/* Custom Fields - Show if lead has custom fields */}
                  {selectedLead.customFields && Object.keys(selectedLead.customFields).length > 0 && selectedLeadTemplate && (
                    <div className="bg-white rounded-lg p-6 border border-slate-100">
                      <h4 className="text-xs text-slate-900 uppercase tracking-wider mb-4" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 600 }}>Campaign Information</h4>
                      <div className="space-y-3">
                        {Object.entries(selectedLead.customFields).map(([fieldId, value]) => {
                          const fieldDef = selectedLeadTemplate.fields?.find((f: any) => f.id === fieldId);
                          const label = fieldDef?.label || fieldId;
                          
                          if (fieldDef?.fieldType === 'section' || fieldDef?.fieldType === 'separator') {
                            return null;
                          }
                          
                          return (
                            <div key={fieldId}>
                              <label className="text-xs text-slate-500 uppercase tracking-wide" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 500 }}>{label}</label>
                              <p className="text-sm text-slate-900 mt-1" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 500 }}>
                                {Array.isArray(value) ? value.join(', ') : 
                                 typeof value === 'boolean' ? (value ? 'Yes' : 'No') :
                                 value?.toString() || 'N/A'}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Property Details - Only show if NO custom fields */}
                  {(!selectedLead.customFields || Object.keys(selectedLead.customFields).length === 0) && (
                  <div className="bg-white rounded-lg p-6 border border-slate-100">
                    <h4 className="text-xs text-slate-900 uppercase tracking-wider mb-4" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 600 }}>Property Details</h4>
                    <div className="space-y-3">
                      {selectedLead.bedrooms && selectedLead.bathrooms && (
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-xs text-slate-500 uppercase tracking-wide" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 500 }}>Bedrooms</label>
                            <p className="text-sm text-slate-900 mt-1" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 500 }}>{selectedLead.bedrooms}</p>
                          </div>
                          <div>
                            <label className="text-xs text-slate-500 uppercase tracking-wide" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 500 }}>Bathrooms</label>
                            <p className="text-sm text-slate-900 mt-1" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 500 }}>{selectedLead.bathrooms}</p>
                          </div>
                        </div>
                      )}
                      {selectedLead.marketValue && (
                        <div>
                          <label className="text-xs text-slate-500 uppercase tracking-wide" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 500 }}>Market Value</label>
                          <p className="text-sm text-slate-900 mt-1" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 500 }}>${selectedLead.marketValue.toLocaleString()}</p>
                        </div>
                      )}
                      {selectedLead.askingPrice && (
                        <div>
                          <label className="text-xs text-slate-500 uppercase tracking-wide" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 500 }}>Asking Price</label>
                          <p className="text-sm text-slate-900 mt-1" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 500 }}>${selectedLead.askingPrice.toLocaleString()}</p>
                        </div>
                      )}
                      {selectedLead.propertyType && (
                        <div>
                          <label className="text-xs text-slate-500 uppercase tracking-wide" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 500 }}>Property Type</label>
                          <p className="text-sm text-slate-900 mt-1" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 500 }}>{selectedLead.propertyType}</p>
                        </div>
                      )}
                    </div>
                  </div>
                  )}

                  {/* Listing & Occupancy - Only show if NO custom fields */}
                  {(!selectedLead.customFields || Object.keys(selectedLead.customFields).length === 0) && (
                  <div className="bg-white rounded-lg p-6 border border-slate-100">
                    <h4 className="text-xs text-slate-900 uppercase tracking-wider mb-4" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 600 }}>Listing & Occupancy</h4>
                    <div className="space-y-3">
                      {selectedLead.listingStatus && (
                        <div>
                          <label className="text-xs text-slate-500 uppercase tracking-wide" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 500 }}>Listing Status</label>
                          <p className="text-sm text-slate-900 mt-1" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 500 }}>{selectedLead.listingStatus.replace(/([A-Z])/g, ' $1').trim()}</p>
                        </div>
                      )}
                      {selectedLead.occupancy && (
                        <div>
                          <label className="text-xs text-slate-500 uppercase tracking-wide" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 500 }}>Occupancy</label>
                          <p className="text-sm text-slate-900 mt-1" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 500 }}>{selectedLead.occupancy.replace(/([A-Z])/g, ' $1').trim()}</p>
                        </div>
                      )}
                      {selectedLead.closingTimeline && (
                        <div>
                          <label className="text-xs text-slate-500 uppercase tracking-wide" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 500 }}>Closing Timeline</label>
                          <p className="text-sm text-slate-900 mt-1" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 500 }}>{selectedLead.closingTimeline.replace(/([A-Z])/g, ' $1').trim()}</p>
                        </div>
                      )}
                    </div>
                  </div>
                  )}

                  {/* Financial Information - Only show if NO custom fields */}
                  {(!selectedLead.customFields || Object.keys(selectedLead.customFields).length === 0) && (
                  <div className="bg-white rounded-lg p-6 border border-slate-100">
                    <h4 className="text-xs text-slate-900 uppercase tracking-wider mb-4" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 600 }}>Financial Information</h4>
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs text-slate-500 uppercase tracking-wide" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 500 }}>Mortgage</label>
                        <p className="text-sm text-slate-900 mt-1" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 500 }}>{selectedLead.mortgageYesNo ? 'Yes' : 'No'}</p>
                      </div>
                      {selectedLead.mortgageYesNo && selectedLead.mortgageAmount && (
                        <div>
                          <label className="text-xs text-slate-500 uppercase tracking-wide" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 500 }}>Mortgage Amount</label>
                          <p className="text-sm text-slate-900 mt-1" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 500 }}>${selectedLead.mortgageAmount.toLocaleString()}</p>
                        </div>
                      )}
                    </div>
                  </div>
                  )}

                  {/* Ratings - Only show if NO custom fields */}
                  {(!selectedLead.customFields || Object.keys(selectedLead.customFields).length === 0) && (
                  <div className="bg-white rounded-lg p-6 border border-slate-100">
                    <h4 className="text-xs text-slate-900 uppercase tracking-wider mb-4" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 600 }}>Ratings</h4>
                    <div className="space-y-4">
                      {selectedLead.motivationRating && (
                        <div>
                          <label className="text-xs text-slate-500 uppercase tracking-wide" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 500 }}>Motivation Rating</label>
                          <div className="flex items-center mt-2">
                            <div className="flex-1 bg-slate-200 h-2 rounded-full">
                              <div 
                                className="bg-cyan-600 h-2 rounded-full transition-all" 
                                style={{ width: `${selectedLead.motivationRating * 10}%` }}
                              ></div>
                            </div>
                            <span className="ml-3 text-sm text-slate-900" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 600 }}>{selectedLead.motivationRating}/10</span>
                          </div>
                        </div>
                      )}
                      {selectedLead.conditionRating && (
                        <div>
                          <label className="text-xs text-slate-500 uppercase tracking-wide" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 500 }}>Condition Rating</label>
                          <div className="flex items-center mt-2">
                            <div className="flex-1 bg-slate-200 h-2 rounded-full">
                              <div 
                                className="bg-cyan-600 h-2 rounded-full transition-all" 
                                style={{ width: `${selectedLead.conditionRating * 10}%` }}
                              ></div>
                            </div>
                            <span className="ml-3 text-sm text-slate-900" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 600 }}>{selectedLead.conditionRating}/10</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  )}
                </div>

                {/* Additional Info */}
                {selectedLead.additionalInfo && (
                  <div className="mb-4 bg-white rounded-lg p-6 border border-slate-100">
                    <h4 className="text-xs text-slate-900 uppercase tracking-wider mb-4" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 600 }}>Additional Information</h4>
                    <p className="text-sm text-slate-900 whitespace-pre-wrap" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 400 }}>{selectedLead.additionalInfo}</p>
                  </div>
                )}

                {/* Call Recording */}
                {selectedLead.callRecordingUrl && (
                  <div className="mb-4 bg-white rounded-lg p-6 border border-slate-100">
                    <h4 className="text-xs text-slate-900 uppercase tracking-wider mb-4" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 600 }}>Call Recording</h4>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => setPlayingRecording(selectedLead.callRecordingUrl!)}
                        className="flex-1 px-6 py-3 bg-cyan-600 text-white text-sm rounded-lg hover:bg-cyan-700 transition-colors"
                        style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 500 }}
                      >
                        Play Recording
                      </button>
                      <a
                        href={selectedLead.callRecordingUrl}
                        download
                        className="flex-1 px-6 py-3 bg-white text-slate-700 text-sm text-center rounded-lg hover:bg-slate-50 transition-colors border border-slate-200"
                        style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 500 }}
                      >
                        Download
                      </a>
                    </div>
                  </div>
                )}

                {/* Client Notes Section */}
                <div className="bg-white rounded-lg p-6 border border-slate-100">
                <h4 className="text-xs text-slate-900 uppercase tracking-wider mb-4" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 600 }}>My Notes</h4>
                
                <div className="mb-6">
                  <textarea
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    placeholder="Add a note about this lead..."
                    className="w-full px-4 py-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-indigo-500 transition-colors bg-white"
                    style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 400 }}
                    rows={3}
                  />
                  <button
                    onClick={addNote}
                    disabled={!newNote.trim()}
                    className="mt-3 px-6 py-2 bg-cyan-600 text-white text-sm rounded-lg hover:bg-cyan-700 transition-colors disabled:bg-slate-300 disabled:cursor-not-allowed"
                    style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 500 }}
                  >
                    Add Note
                  </button>
                </div>

                <div className="space-y-3">
                  {selectedLead.clientNotes && selectedLead.clientNotes.length > 0 ? (
                    selectedLead.clientNotes.map((note) => (
                      <div key={note.id} className="bg-slate-50 rounded-lg p-4 border border-slate-100">
                        {editingNoteId === note.id ? (
                          <div>
                            <textarea
                              value={editingNoteContent}
                              onChange={(e) => setEditingNoteContent(e.target.value)}
                              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-indigo-500 bg-white"
                              style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 400 }}
                              rows={3}
                            />
                            <div className="mt-2 flex gap-2">
                              <button
                                onClick={() => updateNote(note.id)}
                                className="px-4 py-1.5 bg-cyan-600 text-white text-sm rounded-lg hover:bg-cyan-700 transition-colors"
                                style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 500 }}
                              >
                                Save
                              </button>
                              <button
                                onClick={() => {
                                  setEditingNoteId(null);
                                  setEditingNoteContent('');
                                }}
                                className="px-4 py-1.5 bg-slate-100 text-slate-700 text-sm rounded-lg hover:bg-slate-200 transition-colors"
                                style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 500 }}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div>
                            <p className="text-sm text-slate-900 whitespace-pre-wrap" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 400 }}>{note.content}</p>
                            <div className="mt-3 flex items-center justify-between">
                              <span className="text-xs text-slate-400" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 400 }}>
                                {new Date(note.createdAt).toLocaleString()}
                              </span>
                              <div className="flex gap-3">
                                <button
                                  onClick={() => {
                                    setEditingNoteId(note.id);
                                    setEditingNoteContent(note.content);
                                  }}
                                  className="text-cyan-600 hover:text-cyan-700 text-sm transition-colors"
                                  style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 500 }}
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => deleteNote(note.id)}
                                  className="text-slate-600 hover:text-slate-900 text-sm transition-colors"
                                  style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 500 }}
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
                    <p className="text-sm text-slate-400 text-center py-8" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 400 }}>No notes yet. Add your first note above.</p>
                  )}
                </div>
                </div>
              </div>

              <div className="bg-white px-8 py-4 border-t border-slate-100 flex justify-end">
                <button
                  onClick={closeDetailsModal}
                  className="px-6 py-2 bg-slate-100 text-slate-700 text-sm rounded-lg hover:bg-slate-200 transition-colors"
                  style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 500 }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Audio Player Modal */}
        {playingRecording && (
          <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
            <div className="bg-white max-w-md w-full rounded-xl border border-slate-100 shadow-2xl">
              <div className="bg-white px-6 py-4 border-b border-slate-100">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg text-slate-900" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 600 }}>Call Recording</h3>
                  <button
                    onClick={() => setPlayingRecording(null)}
                    className="text-slate-400 hover:text-slate-600 text-2xl leading-none transition-colors"
                  >
                    ×
                  </button>
                </div>
              </div>

              <div className="p-6" style={{ backgroundColor: '#f7f6f5' }}>
                <audio 
                  controls 
                  autoPlay
                  className="w-full"
                  src={playingRecording}
                >
                  Your browser does not support the audio element.
                </audio>
              </div>

              <div className="bg-white px-6 py-4 border-t border-slate-100 flex justify-end">
                <button
                  onClick={() => setPlayingRecording(null)}
                  className="px-6 py-2 bg-slate-100 text-slate-700 text-sm rounded-lg hover:bg-slate-200 transition-colors"
                  style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 500 }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default ClientClosedLeads;





