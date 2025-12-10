import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import Layout from '../components/Layout/Layout';
import api from '../services/api';

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
  campaign: { name: string; formTemplateId?: string };
  agent: { fullName: string; id: string };
  team: { name: string };
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
  const { user } = useAuth();
  const { showSuccess, showError, showWarning } = useToast();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [allLeads, setAllLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [selectedLeadTemplate, setSelectedLeadTemplate] = useState<any>(null);
  const [showLeadDetails, setShowLeadDetails] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [duplicateInfo, setDuplicateInfo] = useState<any>(null);
  const [checkingDuplicate, setCheckingDuplicate] = useState(false);
  const [qcComment, setQcComment] = useState('');
  const [showCommentBox, setShowCommentBox] = useState(false);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [duplicatePhones, setDuplicatePhones] = useState<Set<string>>(new Set());
  const [recordingFile, setRecordingFile] = useState<File | null>(null);
  const [uploadingRecording, setUploadingRecording] = useState(false);

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
      const loadedLeads = response.data.leads || [];
      setAllLeads(loadedLeads);
      setLeads(loadedLeads);
      checkDuplicatePhonesInList(loadedLeads);
    } catch (error) {
      console.error('Failed to load leads:', error);
      setAllLeads([]);
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

  const handleStatusAction = (status: string) => {
    if (!selectedLead) return;
    
    if (status === 'Disqualified' || status === 'Callback' || status === 'OverrideQualified') {
      // For disqualification, callback, and override, show comment box
      setPendingAction(status);
      setShowCommentBox(true);
      setQcComment(''); // Reset comment
    } else {
      // For qualified and duplicate, proceed without comment
      updateLeadStatus(selectedLead.id, status, '');
    }
  };

  const updateLeadStatus = async (leadId: string, status: string, comment: string) => {
    try {
      setActionLoading(leadId);
      setSuccessMessage('');
      
      console.log(`Updating lead ${leadId} to status: ${status}`);
      
      // Upload recording if provided and status is Qualified or OverrideQualified
      if (recordingFile && (status === 'Qualified' || status === 'OverrideQualified')) {
        try {
          setUploadingRecording(true);
          const formData = new FormData();
          formData.append('recording', recordingFile);
          
          await api.post(`/qc/leads/${leadId}/recording`, formData, {
            headers: {
              'Content-Type': 'multipart/form-data'
            }
          });
          console.log('Recording uploaded successfully');
        } catch (uploadError) {
          console.error('Failed to upload recording:', uploadError);
          showWarning('Failed to upload recording, but lead will still be qualified.');
        } finally {
          setUploadingRecording(false);
        }
      }
      
      // Handle override case
      if (status === 'OverrideQualified') {
        await api.patch(`/leads/${leadId}/status`, { 
          status: 'Disqualified',
          comment: comment || 'Override: Disqualified for agent but qualified for client',
          overrideQualified: true,
          overrideReason: comment
        });
      } else {
        await api.patch(`/leads/${leadId}/status`, { 
          status, 
          comment: comment || `Marked as ${status} by QC` 
        });
      }
      
      // Reload leads after status change
      await loadPendingLeads();
      
      // Show success message
      const successMsg = status === 'OverrideQualified' 
        ? 'Lead override qualified successfully! (Disqualified for agent, Qualified for client)'
        : `Lead ${status.toLowerCase()} successfully!`;
      setSuccessMessage(successMsg);
      
      // Reset states
      setQcComment('');
      setPendingAction(null);
      setShowCommentBox(false);
      setShowLeadDetails(false);
      setRecordingFile(null);
      
      console.log(`Lead ${leadId} ${status} successfully`);
      
    } catch (error: any) {
      console.error('Failed to update lead:', error);
      const errorDetails = error.response?.data;
      console.error('Error details:', errorDetails);
      
      let errorMessage = 'Failed to update lead status';
      if (errorDetails?.error) {
        errorMessage = errorDetails.error;
      }
      
      showError(errorMessage);
    } finally {
      setActionLoading(null);
    }
  };

  const confirmStatusUpdate = () => {
    if (!pendingAction || !selectedLead) return;
    
    if (!qcComment.trim()) {
      showWarning('Please provide a reason for disqualification or callback.');
      return;
    }
    
    updateLeadStatus(selectedLead.id, pendingAction, qcComment);
  };

  const viewLeadDetails = async (lead: Lead) => {
    setSelectedLead(lead);
    setShowLeadDetails(true);
    
    // Fetch template if lead's campaign uses one
    if (lead.campaign.formTemplateId) {
      try {
        const response = await api.get(`/form-templates/${lead.campaign.formTemplateId}`);
        setSelectedLeadTemplate(response.data);
      } catch (error) {
        console.error('Failed to load form template:', error);
        setSelectedLeadTemplate(null);
      }
    } else {
      setSelectedLeadTemplate(null);
    }
    
    // Check for duplicates
    await checkForDuplicates(lead);
  };

  const checkForDuplicates = async (lead: Lead) => {
    setCheckingDuplicate(true);
    setDuplicateInfo(null); // Reset first
    
    try {
      const params = new URLSearchParams();
      if (lead.phone) params.append('phone', lead.phone);
      if (lead.addressText) params.append('address', lead.addressText);

      console.log('Checking duplicates for:', lead.phone, lead.addressText);
      const response = await api.get(`/leads/check-duplicate?${params.toString()}`);
      console.log('Duplicate check response:', response.data);
      
      if (response.data.isDuplicate) {
        // Filter out the current lead from matches
        const matches = response.data.matches.filter((m: any) => m.id !== lead.id);
        console.log('Filtered matches:', matches);
        
        if (matches.length > 0) {
          setDuplicateInfo({
            isDuplicate: true,
            matches: matches
          });
        } else {
          setDuplicateInfo(null);
        }
      } else {
        setDuplicateInfo(null);
      }
    } catch (error) {
      console.error('Duplicate check error:', error);
      setDuplicateInfo(null);
    } finally {
      setCheckingDuplicate(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatListingStatus = (status: string) => {
    const statusMap: { [key: string]: string } = {
      'ListedByOwner': 'Listed by Owner',
      'ListedByRealtor': 'Listed by Realtor',
      'NotListed': 'Not Listed'
    };
    return statusMap[status] || status;
  };

  const formatOccupancy = (occupancy: string) => {
    const occupancyMap: { [key: string]: string } = {
      'OwnerOccupied': 'Owner Occupied',
      'RentedMTM': 'Rented Month-to-Month',
      'RentedAnnually': 'Rented Annually',
      'Vacant': 'Vacant'
    };
    return occupancyMap[occupancy] || occupancy;
  };

  const formatTimeline = (timeline: string) => {
    const timelineMap: { [key: string]: string } = {
      'Asap': 'ASAP',
      'Anytime': 'Anytime',
      'ThirtyDays': '30 Days',
      'SixtyDays': '60 Days',
      'NinetyDays': '90 Days',
      'SixMonths': '6 Months'
    };
    return timelineMap[timeline] || timeline;
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
      <div className="py-8 px-4 sm:px-6 lg:px-8" style={{ backgroundColor: '#f7f6f5' }}>




        {/* Success Message */}
        {successMessage && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-green-800">
                  {successMessage}
                </p>
              </div>
            </div>
          </div>
        )}

        {leads.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-8 border border-gray-100 text-center">
            <div className="mx-auto h-12 w-12 text-neutral-400 mb-4">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="text-neutral-600 text-lg font-medium">
              No pending leads to review
            </p>
            <p className="text-neutral-500 mt-2">
              All leads have been processed
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Contact</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Campaign</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Agent / Team</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Submitted</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {leads.map((lead) => (
                    <tr key={lead.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-neutral-900">
                          {lead.homeownerFirst} {lead.homeownerLast}
                        </div>
                        <div className="text-sm text-neutral-600">
                          {lead.phone}
                          {duplicatePhones.has(lead.phone) && (
                            <span className="text-red-600 ml-1" title="Duplicate phone number">⚠️</span>
                          )}
                        </div>
                        {lead.email && <div className="text-xs text-neutral-500">{lead.email}</div>}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-neutral-900">{lead.campaign.name}</div>
                        <div className="text-xs text-neutral-500">{lead.serialNumber}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-neutral-900">{lead.agent.fullName}</div>
                        <div className="text-xs text-neutral-600">{lead.team.name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-600">
                        {new Date(lead.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => viewLeadDetails(lead)}
                          className="text-mint-600 hover:text-mint-700 smooth-transition"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}



        {/* Lead Details Modal */}
        {showLeadDetails && selectedLead && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm overflow-y-auto h-full w-full z-50 flex items-start justify-center pt-8 pb-8">
            <div className="relative mx-auto w-full max-w-5xl bg-white shadow-2xl max-h-[90vh] overflow-y-auto">
              {/* Header */}
              <div className="sticky top-0 bg-white border-b border-gray-200 px-8 py-6 flex justify-between items-center z-10">
                <div>
                  <h3 className="text-xl font-semibold text-gray-900">
                    {selectedLead.homeownerFirst} {selectedLead.homeownerLast}
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">Serial: {selectedLead.serialNumber}</p>
                </div>
                <div className="flex items-center space-x-4">
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                    selectedLead.status === 'Qualified' ? 'bg-green-100 text-green-800' :
                    selectedLead.status === 'Disqualified' ? 'bg-red-100 text-red-800' :
                    selectedLead.status === 'Duplicate' ? 'bg-cyan-100 text-cyan-800' :
                    selectedLead.status === 'Callback' ? 'bg-black text-white' :
                    'bg-yellow-100 text-yellow-800'
                  }`}>
                    {selectedLead.status}
                  </span>
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

              {/* Duplicate Warning */}
              {duplicateInfo && duplicateInfo.isDuplicate && (
                <div className="px-8 py-4 bg-red-50 border-b border-red-200">
                  <div className="flex items-start">
                    <span className="text-red-600 text-2xl mr-3">⚠️</span>
                    <div className="flex-1">
                      <h4 className="text-sm font-semibold text-red-900 mb-2">Duplicate Detected</h4>
                      <p className="text-sm text-red-800 mb-3">
                        This lead matches {duplicateInfo.matches.length} existing lead{duplicateInfo.matches.length > 1 ? 's' : ''}:
                      </p>
                      <div className="space-y-2">
                        {duplicateInfo.matches.map((match: any) => (
                          <div key={match.id} className="bg-white p-3 rounded border border-red-200">
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="text-sm font-medium text-gray-900">
                                  Lead #{match.serialNumber} - {match.homeownerName}
                                </p>
                                <p className="text-xs text-gray-600 mt-1">
                                  Match: {match.matchType === 'phone' ? 'Phone Number' : 'Address'}
                                </p>
                                <p className="text-xs text-gray-500">
                                  Submitted: {new Date(match.createdAt).toLocaleDateString()}
                                </p>
                              </div>
                              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold ${
                                match.status === 'Qualified' ? 'bg-green-100 text-green-800' :
                                match.status === 'Disqualified' ? 'bg-red-100 text-red-800' :
                                match.status === 'Duplicate' ? 'bg-cyan-100 text-cyan-800' :
                                match.status === 'Callback' ? 'bg-black text-white' :
                                'bg-yellow-100 text-yellow-800'
                              }`}>
                                {match.status}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {checkingDuplicate && (
                <div className="px-8 py-4 bg-gray-50 border-b border-gray-200">
                  <p className="text-sm text-gray-600">Checking for duplicates...</p>
                </div>
              )}

              {/* Content */}
              <div className="px-8 py-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Left Column */}
                  <div className="space-y-6">
                    {/* Contact Information */}
                    <div className="bg-gray-50 p-5 border-l-4 border-blue-500">
                      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Contact Information</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Phone</span>
                          <span className="text-sm font-medium text-gray-900">{selectedLead.phone}</span>
                        </div>
                        {selectedLead.email && (
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">Email</span>
                            <span className="text-sm font-medium text-gray-900">{selectedLead.email}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Custom Fields - Show if lead has custom fields */}
                    {selectedLead.customFields && Object.keys(selectedLead.customFields).length > 0 && selectedLeadTemplate && (
                      <div className="bg-gray-50 p-5 border-l-4 border-purple-500">
                        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Campaign Information</h4>
                        <div className="space-y-2">
                          {Object.entries(selectedLead.customFields).map(([fieldId, value]) => {
                            // Find the field definition from template to get the label
                            const fieldDef = selectedLeadTemplate.fields?.find((f: any) => f.id === fieldId);
                            const label = fieldDef?.label || fieldId;
                            
                            // Skip section headers and separators
                            if (fieldDef?.fieldType === 'section' || fieldDef?.fieldType === 'separator') {
                              return null;
                            }
                            
                            return (
                              <div key={fieldId} className="flex justify-between">
                                <span className="text-sm text-gray-600">{label}</span>
                                <span className="text-sm font-medium text-gray-900">
                                  {Array.isArray(value) ? value.join(', ') : 
                                   typeof value === 'boolean' ? (value ? 'Yes' : 'No') :
                                   value?.toString() || 'N/A'}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Property Details - Only show if NO custom fields */}
                    {(!selectedLead.customFields || Object.keys(selectedLead.customFields).length === 0) && (
                    <div className="bg-gray-50 p-5 border-l-4 border-green-500">
                      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Property Details</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Address</span>
                          <span className="text-sm font-medium text-gray-900 text-right">{selectedLead.addressText}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Bedrooms</span>
                          <span className="text-sm font-medium text-gray-900">{selectedLead.bedrooms}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Bathrooms</span>
                          <span className="text-sm font-medium text-gray-900">{selectedLead.bathrooms}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Market Value</span>
                          <span className="text-sm font-semibold text-gray-900">{formatCurrency(selectedLead.marketValue)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Asking Price</span>
                          <span className="text-sm font-semibold text-gray-900">
                            {selectedLead.askingPrice && selectedLead.askingPrice > 0 ? formatCurrency(selectedLead.askingPrice) : 'No asking price'}
                          </span>
                        </div>
                        {selectedLead.negotiable && (
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">Negotiable</span>
                            <span className={`text-sm font-semibold ${selectedLead.negotiable === 'Yes' ? 'text-green-600' : 'text-red-600'}`}>
                              {selectedLead.negotiable}
                            </span>
                          </div>
                        )}
                        {selectedLead.sellingReason && (
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">Selling Reason</span>
                            <span className="text-sm font-medium text-gray-900">{selectedLead.sellingReason}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    )}

                    {/* Property Status - Only show if NO custom fields */}
                    {(!selectedLead.customFields || Object.keys(selectedLead.customFields).length === 0) && (
                    <div className="bg-gray-50 p-5 border-l-4 border-purple-500">
                      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Property Status</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Listing Status</span>
                          <span className="text-sm font-medium text-gray-900">{formatListingStatus(selectedLead.listingStatus)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Occupancy</span>
                          <span className="text-sm font-medium text-gray-900">{formatOccupancy(selectedLead.occupancy)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Mortgage</span>
                          <span className="text-sm font-medium text-gray-900">{selectedLead.mortgageYesNo ? 'Yes' : 'No'}</span>
                        </div>
                        {selectedLead.mortgageYesNo && selectedLead.mortgageAmount && (
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">Mortgage Amount</span>
                            <span className="text-sm font-semibold text-gray-900">{formatCurrency(selectedLead.mortgageAmount)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    )}
                  </div>

                  {/* Right Column */}
                  <div className="space-y-6">
                    {/* Property Information - Only show if NO custom fields */}
                    {(!selectedLead.customFields || Object.keys(selectedLead.customFields).length === 0) && (
                    <div className="bg-gray-50 p-5 border-l-4 border-orange-500">
                      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Property Information</h4>
                      <div className="space-y-2">
                        {selectedLead.license && (
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">License</span>
                            <span className="text-sm font-medium text-gray-900">{selectedLead.license}</span>
                          </div>
                        )}
                        {selectedLead.propertyType && (
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">Property Type</span>
                            <span className="text-sm font-medium text-gray-900">{selectedLead.propertyType}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    )}

                    {/* Timeline & Ratings - Only show if NO custom fields */}
                    {(!selectedLead.customFields || Object.keys(selectedLead.customFields).length === 0) && (
                    <div className="bg-gray-50 p-5 border-l-4 border-indigo-500">
                      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Timeline & Ratings</h4>
                      <div className="space-y-2">
                        {selectedLead.ownershipTimelineValue && selectedLead.ownershipTimelineUnit && (
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">Ownership Timeline</span>
                            <span className="text-sm font-medium text-gray-900">{selectedLead.ownershipTimelineValue} {selectedLead.ownershipTimelineUnit}</span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Closing Timeline</span>
                          <span className="text-sm font-medium text-gray-900">{formatTimeline(selectedLead.closingTimeline)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Motivation</span>
                          <span className="text-sm font-semibold text-gray-900">{selectedLead.motivationRating}/10</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Condition</span>
                          <span className="text-sm font-semibold text-gray-900">{selectedLead.conditionRating}/10</span>
                        </div>
                      </div>
                    </div>
                    )}

                    {/* Campaign & Assignment */}
                    <div className="bg-gray-50 p-5 border-l-4 border-cyan-500">
                      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Campaign & Assignment</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Campaign</span>
                          <span className="text-sm font-medium text-gray-900">{selectedLead.campaign.name}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Agent</span>
                          <span className="text-sm font-medium text-gray-900">{selectedLead.agent.fullName}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Team</span>
                          <span className="text-sm font-medium text-gray-900">{selectedLead.team.name}</span>
                        </div>
                      </div>
                    </div>

                    {/* Lead Information */}
                    <div className="bg-gray-50 p-5 border-l-4 border-gray-500">
                      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Lead Information</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Submitted</span>
                          <span className="text-sm font-medium text-gray-900">{new Date(selectedLead.createdAt).toLocaleString()}</span>
                        </div>
                        {selectedLead.updatedAt && (
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">Last Updated</span>
                            <span className="text-sm font-medium text-gray-900">{new Date(selectedLead.updatedAt).toLocaleString()}</span>
                          </div>
                        )}
                        {selectedLead.qcAgent && (
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">QC Agent</span>
                            <span className="text-sm font-medium text-gray-900">{selectedLead.qcAgent.fullName}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* QC Comment */}
                    {selectedLead.qcComment && (
                      <div className="bg-yellow-50 p-5 border-l-4 border-yellow-500">
                        <h4 className="text-xs font-semibold text-yellow-800 uppercase tracking-wider mb-2">QC Comment</h4>
                        <p className="text-sm text-yellow-900">{selectedLead.qcComment}</p>
                      </div>
                    )}

                    {/* Additional Information */}
                    {selectedLead.additionalInfo && (
                      <div className="bg-blue-50 p-5 border-l-4 border-blue-500">
                        <h4 className="text-xs font-semibold text-blue-800 uppercase tracking-wider mb-2">Additional Information</h4>
                        <p className="text-sm text-blue-900">{selectedLead.additionalInfo}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Comment Box for Disqualified/Callback */}
                {showCommentBox && pendingAction && (
                  <div className="mt-6 p-4 bg-white border border-gray-300">
                    <div className="mb-4">
                      <h4 className="text-sm font-semibold text-gray-900 mb-1">
                        Comment Required
                      </h4>
                      <p className="text-sm text-gray-600 mb-3">
                        Please provide a reason for {pendingAction.toLowerCase()}
                      </p>
                      <textarea
                        value={qcComment}
                        onChange={(e) => setQcComment(e.target.value)}
                        rows={4}
                        required
                        autoFocus
                        className="w-full border-gray-300 shadow-sm focus:border-cyan-500 focus:ring-cyan-500"
                        placeholder={
                          pendingAction === 'Disqualified' 
                            ? 'Explain why this lead is being disqualified...' 
                            : 'Explain why this lead needs a callback and any specific instructions...'
                        }
                      />
                    </div>
                    <div className="flex justify-end space-x-3">
                      <button
                        onClick={() => {
                          setShowCommentBox(false);
                          setPendingAction(null);
                          setQcComment('');
                        }}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={confirmStatusUpdate}
                        disabled={!qcComment.trim() || actionLoading === selectedLead.id}
                        className="px-5 py-2 text-sm font-medium text-white bg-cyan-600 hover:bg-cyan-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {actionLoading === selectedLead.id ? 'Processing...' : `Confirm ${pendingAction}`}
                      </button>
                    </div>
                  </div>
                )}

                {/* Recording Upload Section */}
                {!showCommentBox && (
                  <div className="mt-6 pt-6 border-t border-neutral-200/50">
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Call Recording (Optional - for Qualified leads)
                      </label>
                      <div className="flex items-center gap-3">
                        <input
                          type="file"
                          accept="audio/*"
                          onChange={(e) => setRecordingFile(e.target.files?.[0] || null)}
                          className="block w-full text-sm text-gray-500
                            file:mr-4 file:py-2 file:px-4
                            file:border-0
                            file:text-sm file:font-semibold
                            file:bg-cyan-50 file:text-cyan-700
                            hover:file:bg-cyan-100
                            cursor-pointer"
                        />
                        {recordingFile && (
                          <button
                            onClick={() => setRecordingFile(null)}
                            className="text-red-600 hover:text-red-700 text-sm font-medium"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                      {recordingFile && (
                        <p className="mt-2 text-sm text-green-600">
                          ✓ {recordingFile.name} ({(recordingFile.size / 1024 / 1024).toFixed(2)} MB)
                        </p>
                      )}
                      {uploadingRecording && (
                        <p className="mt-2 text-sm text-cyan-600">
                          Uploading recording...
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                {!showCommentBox && (
                  <div className="mt-4">
                    <div className="flex flex-wrap gap-3 justify-end">
                      <button
                        onClick={() => handleStatusAction('Qualified')}
                        disabled={actionLoading === selectedLead.id}
                        className="px-5 py-2.5 text-sm font-medium text-white rounded-xl shadow-gentle hover:shadow-hover smooth-transition hover-lift bg-gradient-to-br from-green-400 to-green-500 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:transform-none"
                      >
                        {actionLoading === selectedLead.id ? 'Processing...' : 'Qualify'}
                      </button>
                      <button
                        onClick={() => handleStatusAction('OverrideQualified')}
                        disabled={actionLoading === selectedLead.id}
                        className="px-5 py-2.5 text-sm font-medium text-white rounded-xl shadow-gentle hover:shadow-hover smooth-transition hover-lift bg-gradient-to-br from-orange-400 to-orange-500 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:transform-none"
                        title="Disqualify for agent but send to client as qualified"
                      >
                        {actionLoading === selectedLead.id ? 'Processing...' : 'Override Qualify'}
                      </button>
                      <button
                        onClick={() => handleStatusAction('Disqualified')}
                        disabled={actionLoading === selectedLead.id}
                        className="px-5 py-2.5 text-sm font-medium text-white rounded-xl shadow-gentle hover:shadow-hover smooth-transition hover-lift bg-gradient-to-br from-red-400 to-red-500 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:transform-none"
                      >
                        {actionLoading === selectedLead.id ? 'Processing...' : 'Disqualify'}
                      </button>
                      <button
                        onClick={() => handleStatusAction('Duplicate')}
                        disabled={actionLoading === selectedLead.id}
                        className="px-5 py-2.5 text-sm font-medium text-white rounded-xl shadow-gentle hover:shadow-hover smooth-transition hover-lift bg-gradient-to-br from-cyan-400 to-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:transform-none"
                      >
                        {actionLoading === selectedLead.id ? 'Processing...' : 'Duplicate'}
                      </button>
                      <button
                        onClick={() => handleStatusAction('Callback')}
                        disabled={actionLoading === selectedLead.id}
                        className="px-5 py-2.5 text-sm font-medium text-white rounded-xl shadow-gentle hover:shadow-hover smooth-transition hover-lift bg-gradient-to-br from-gray-600 to-gray-700 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:transform-none"
                      >
                        {actionLoading === selectedLead.id ? 'Processing...' : 'Callback'}
                      </button>
                      <button
                        onClick={() => setShowLeadDetails(false)}
                        className="px-5 py-2.5 text-sm font-medium text-neutral-700 glass rounded-xl shadow-subtle hover:shadow-gentle smooth-transition"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default QCDashboard;