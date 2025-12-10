import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import Layout from '../components/Layout/Layout';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
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
  pipelineStage: string;
  clientReviewed: boolean;
  status?: string;
  createdAt: string;
  marketValue?: number;
  askingPrice?: number;
  bedrooms?: number;
  bathrooms?: number;
  negotiable?: string;
  license?: string;
  propertyType?: string;
  sellingReason?: string;
  ownershipTimelineValue?: number;
  ownershipTimelineUnit?: string;
  listingStatus?: string;
  occupancy?: string;
  mortgageYesNo?: boolean;
  mortgageAmount?: number;
  closingTimeline?: string;
  motivationRating?: number;
  conditionRating?: number;
  additionalInfo?: string;
  customFields?: Record<string, any>;
  campaign?: {
    name: string;
    formTemplate?: {
      fields: Array<{ id: string; label: string; fieldType: string }>;
    };
  };
  agent?: { fullName: string };
  qcAgent?: { fullName: string };
  qcComment?: string;
  recordingUrl?: string;
}

interface Note {
  id: string;
  content: string;
  recordingUrl?: string;
  authorName?: string;
  authorType?: string;
  createdAt: string;
}

interface Schedule {
  id: string;
  scheduledDate: string;
  type: 'CALL' | 'APPOINTMENT';
  status: string;
  notes?: string;
}

interface Task {
  id: string;
  title: string;
  description: string;
  dueDate: string;
  status: string;
  completionNote?: string;
  assignedUser: {
    name: string;
    positionTitle: string;
  };
}

interface StageCompletionStatus {
  isComplete: boolean;
  pendingCount: number;
  completedCount: number;
  totalCount: number;
}

const LeadDetail: React.FC = () => {
  const { id, leadId } = useParams<{ id?: string; leadId?: string }>();
  const actualLeadId = id || leadId;
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isQCMode = searchParams.get('qc') === 'true';
  const { showError, showSuccess, showWarning } = useToast();
  const { user } = useAuth();
  const [lead, setLead] = useState<Lead | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [stageCompletion, setStageCompletion] = useState<StageCompletionStatus | null>(null);
  const [pipelineStages, setPipelineStages] = useState<any[]>([]);
  
  // Note form state
  const [showNoteForm, setShowNoteForm] = useState(false);
  const [newNote, setNewNote] = useState('');
  
  // Schedule form state
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [scheduleType, setScheduleType] = useState<'CALL' | 'APPOINTMENT'>('CALL');
  const [scheduleNotes, setScheduleNotes] = useState('');



  // Reassignment states
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [reassignStage, setReassignStage] = useState('');
  const [reassignMethod, setReassignMethod] = useState<'auto' | 'manual'>('auto');
  const [reassignMemberId, setReassignMemberId] = useState('');
  const [availableMembers, setAvailableMembers] = useState<any[]>([]);
  const [reassigning, setReassigning] = useState(false);
  
  // Actions dropdown state
  const [showActionsDropdown, setShowActionsDropdown] = useState(false);
  
  // QC Action states
  const [showQCCommentModal, setShowQCCommentModal] = useState(false);
  const [qcAction, setQCAction] = useState<'Disqualified' | 'Callback' | 'Override' | null>(null);
  const [qcCommentText, setQCCommentText] = useState('');
  const [qcProcessing, setQCProcessing] = useState(false);
  const [recordingFile, setRecordingFile] = useState<File | null>(null);
  const [uploadingRecording, setUploadingRecording] = useState(false);
  const [duplicateInfo, setDuplicateInfo] = useState<any>(null);
  const [checkingDuplicate, setCheckingDuplicate] = useState(false);
  
  // Confirmation modal states
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'qualify' | 'duplicate' | null>(null);
  
  // Archive confirmation modal
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [archiveStage, setArchiveStage] = useState<'Closed' | 'Dead' | null>(null);

  usePageTitle(lead ? `${lead.homeownerFirst} ${lead.homeownerLast}` : 'Lead Details');

  // Determine API prefix and navigation based on user role
  const getApiPrefix = () => {
    if (user?.role === 'TeamMember') return '/team-member';
    if (user?.role === 'Client') return '/client';
    return ''; // Agent, QC, Manager, etc. use base API routes
  };
  
  const apiPrefix = getApiPrefix();
  const showTasks = user?.role === 'Client'; // Only clients see tasks
  // Show actions to clients and team members with full pipeline access
  const showActions = user?.role === 'Client' || (user?.role === 'TeamMember' && user?.permissions?.pipeline?.full_access === true);

  useEffect(() => {
    loadLeadData();
  }, [actualLeadId]);

  useEffect(() => {
    // Check for duplicates when lead loads (only for QC role in QC mode)
    if (lead && user?.role === 'QualityControl' && isQCMode) {
      checkForDuplicates();
    }
  }, [lead?.id, user?.role, isQCMode]);

  const loadLeadData = async () => {
    try {
      setLoading(true);
      
      // For roles without apiPrefix (Agent, QC, Manager, etc.), only load basic lead data
      if (!apiPrefix) {
        const response = await api.get(`/leads/${actualLeadId}`);
        const leadData = response.data;
        
        // If lead has a campaign with formTemplateId, load the form template
        if (leadData.campaign?.formTemplateId) {
          try {
            const templateResponse = await api.get(`/form-templates/${leadData.campaign.formTemplateId}`);
            leadData.campaign.formTemplate = templateResponse.data;
          } catch (error) {
            console.error('Failed to load form template:', error);
          }
        }
        
        setLead(leadData);
        setNotes([]);
        setSchedules([]);
        setActivities([]);
        setTasks([]);
        setLoading(false);
        return;
      }
      
      // For Client and TeamMember, load full data
      const requests = [
        api.get(`${apiPrefix}/leads/${actualLeadId}`),
        api.get(`${apiPrefix}/leads/${actualLeadId}/notes`),
        api.get(`${apiPrefix}/leads/${actualLeadId}/schedules`),
        api.get(`${apiPrefix}/leads/${actualLeadId}/activity`) // Load activity history
      ];

      // Only load tasks and stage info for clients
      if (showTasks) {
        requests.push(api.get(`/tasks`, { params: { leadId: actualLeadId } }));
        requests.push(api.get('/client/pipeline-stages'));
      }

      const responses = await Promise.all(requests);
      
      const leadData = responses[0].data;
      
      // If lead has a campaign with formTemplateId, load the form template
      if (leadData.campaign?.formTemplateId) {
        try {
          const templateResponse = await api.get(`/form-templates/${leadData.campaign.formTemplateId}`);
          leadData.campaign.formTemplate = templateResponse.data;
        } catch (error) {
          console.error('Failed to load form template:', error);
        }
      }
      
      setLead(leadData);
      setNotes(responses[1].data || []);
      setSchedules(responses[2].data || []);
      setActivities(responses[3].data || []);
      if (showTasks && responses[4]) {
        setTasks(responses[4].data || []);
      }
      if (showTasks && responses[5]) {
        setPipelineStages(responses[5].data || []);
      }

      // Load stage completion status for clients
      if (showTasks) {
        try {
          const statusRes = await api.get(`/tasks/lead/${actualLeadId}/stage-status`);
          setStageCompletion(statusRes.data);
        } catch (error) {
          console.error('Failed to load stage completion status:', error);
        }
      }
    } catch (error: any) {
      console.error('Failed to load lead data:', error);
      showError('Failed to load lead details');
    } finally {
      setLoading(false);
    }
  };

  const handleAddNote = async () => {
    if (!newNote.trim()) {
      showError('Please enter a note');
      return;
    }

    try {
      await api.post(`${apiPrefix}/leads/${actualLeadId}/notes`, { content: newNote });
      showSuccess('Note added successfully');
      setNewNote('');
      setShowNoteForm(false);
      loadLeadData();
    } catch (error) {
      showError('Failed to add note');
    }
  };

  const handleAddSchedule = async () => {
    if (!scheduleDate || !scheduleTime) {
      showError('Please select date and time');
      return;
    }

    try {
      const scheduledDate = new Date(`${scheduleDate}T${scheduleTime}`).toISOString();
      
      // Get current user name from auth context
      const userName = user?.name || user?.fullName || user?.username || 'User';
      const now = new Date();
      
      const createdNote = `Created by: ${userName}\nDate: ${now.toLocaleDateString()}\nTime: ${now.toLocaleTimeString()}`;
      const fullNotes = scheduleNotes ? `${scheduleNotes}\n\n${createdNote}` : createdNote;
      
      await api.post(`${apiPrefix}/leads/${actualLeadId}/schedules`, {
        scheduledDate,
        type: scheduleType,
        notes: fullNotes
      });
      showSuccess('Schedule added successfully');
      setScheduleDate('');
      setScheduleTime('');
      setScheduleNotes('');
      setShowScheduleForm(false);
      loadLeadData();
    } catch (error) {
      showError('Failed to add schedule');
    }
  };

  const handleMoveToNextStage = async () => {
    if (!lead || !stageCompletion?.isComplete) return;

    // Find current stage index
    const currentIndex = pipelineStages.findIndex(s => s.name === lead.pipelineStage);
    if (currentIndex === -1 || currentIndex >= pipelineStages.length - 1) {
      showError('Cannot move to next stage');
      return;
    }

    const nextStage = pipelineStages[currentIndex + 1];
    
    try {
      await api.patch(`${apiPrefix}/leads/${actualLeadId}/pipeline-stage`, {
        stage: nextStage.name
      });
      showSuccess(`Lead moved to ${nextStage.displayName}`);
      loadLeadData(); // Reload to get new stage status
    } catch (error: any) {
      console.error('Failed to move lead:', error);
      showError('Failed to move lead to next stage');
    }
  };

  const handleOpenReassignModal = async () => {
    setShowReassignModal(true);
    // Load available stages (exclude Closed, Dead, and inactive stages)
    try {
      const response = await api.get('/pipeline-stages');
      const availableStages = response.data.filter((s: any) => 
        !['Closed', 'Dead'].includes(s.name) && s.isActive !== false
      );
      setPipelineStages(availableStages);
    } catch (error) {
      console.error('Failed to load stages:', error);
    }
  };

  const loadTeamMembersForStage = async (stageName: string) => {
    try {
      // Find the selected stage to get its position
      const selectedStage = pipelineStages.find(s => s.name === stageName);
      
      if (!selectedStage) {
        setAvailableMembers([]);
        return;
      }
      
      // Load all team members
      const response = await api.get('/client/team-members');
      
      // Filter team members by position for this stage (only active members)
      let filteredMembers = response.data.filter((member: any) => member.status === 'active');
      
      // If stage has a position assigned, filter by that position
      if (selectedStage.positionId) {
        filteredMembers = filteredMembers.filter((member: any) => 
          member.positionId === selectedStage.positionId
        );
      }
      
      setAvailableMembers(filteredMembers);
    } catch (error) {
      console.error('Failed to load team members:', error);
      setAvailableMembers([]);
    }
  };

  const handleReassignStageChange = async (stageName: string) => {
    setReassignStage(stageName);
    setReassignMemberId('');
    
    // Load team members for manual assignment
    if (reassignMethod === 'manual' && stageName) {
      await loadTeamMembersForStage(stageName);
    }
  };

  const handleReassignMethodChange = async (method: 'auto' | 'manual') => {
    setReassignMethod(method);
    setReassignMemberId('');
    
    // Load team members if switching to manual and a stage is already selected
    if (method === 'manual' && reassignStage) {
      await loadTeamMembersForStage(reassignStage);
    }
  };

  const handleReassignLead = async () => {
    if (!reassignStage) {
      showError('Please select a stage');
      return;
    }

    if (reassignMethod === 'manual' && !reassignMemberId) {
      showError('Please select a team member');
      return;
    }

    setReassigning(true);
    try {
      await api.post(`/client/leads/${actualLeadId}/reassign-stage`, {
        stage: reassignStage,
        assignToMemberId: reassignMethod === 'manual' ? reassignMemberId : undefined
      });
      
      showSuccess(`Lead reassigned to ${reassignStage} successfully`);
      setShowReassignModal(false);
      setReassignStage('');
      setReassignMethod('auto');
      setReassignMemberId('');
      loadLeadData();
    } catch (error: any) {
      console.error('Failed to reassign lead:', error);
      showError(error.response?.data?.error || 'Failed to reassign lead');
    } finally {
      setReassigning(false);
    }
  };

  // QC Action Handlers
  const handleQCQualify = () => {
    setConfirmAction('qualify');
    setShowConfirmModal(true);
  };
  
  const confirmQualify = async () => {
    setShowConfirmModal(false);
    try {
      // Upload recording if provided
      if (recordingFile) {
        try {
          setUploadingRecording(true);
          const formData = new FormData();
          formData.append('recording', recordingFile);
          
          await api.post(`/qc/leads/${actualLeadId}/recording`, formData, {
            headers: {
              'Content-Type': 'multipart/form-data',
            },
          });
          setRecordingFile(null);
        } catch (error) {
          console.error('Failed to upload recording:', error);
          showWarning('Failed to upload recording, but lead will still be qualified');
        } finally {
          setUploadingRecording(false);
        }
      }
      
      await api.patch(`/leads/${actualLeadId}/status`, {
        status: 'Qualified',
        comment: 'Marked as Qualified by QC'
      });
      showSuccess('Lead marked as Qualified');
      
      // Redirect back to QC Dashboard
      setTimeout(() => {
        navigate('/qc-dashboard');
      }, 1000);
    } catch (error: any) {
      showError(error.response?.data?.error || 'Failed to qualify lead');
    }
  };

  const handleQCDisqualify = () => {
    setQCAction('Disqualified');
    setQCCommentText('');
    setShowQCCommentModal(true);
  };

  const handleQCCallback = () => {
    setQCAction('Callback');
    setQCCommentText('');
    setShowQCCommentModal(true);
  };

  const handleQCDuplicate = () => {
    setConfirmAction('duplicate');
    setShowConfirmModal(true);
  };
  
  const confirmDuplicate = async () => {
    setShowConfirmModal(false);
    try {
      await api.patch(`/leads/${actualLeadId}/status`, {
        status: 'Duplicate',
        comment: 'Marked as Duplicate by QC'
      });
      showSuccess('Lead marked as Duplicate');
      
      // Redirect back to QC Dashboard
      setTimeout(() => {
        navigate('/qc-dashboard');
      }, 1000);
    } catch (error: any) {
      showError(error.response?.data?.error || 'Failed to mark as duplicate');
    }
  };
  
  const handleConfirmAction = () => {
    if (confirmAction === 'qualify') {
      confirmQualify();
    } else if (confirmAction === 'duplicate') {
      confirmDuplicate();
    }
  };

  const handleQCOverride = () => {
    setQCAction('Override');
    setQCCommentText('');
    setShowQCCommentModal(true);
  };

  const checkForDuplicates = async () => {
    if (!lead) return;
    
    setCheckingDuplicate(true);
    setDuplicateInfo(null);
    
    try {
      const params = new URLSearchParams();
      if (lead.phone) params.append('phone', lead.phone);
      if (lead.addressText) params.append('address', lead.addressText);
      
      const response = await api.get(`/leads/check-duplicate?${params.toString()}`);
      
      if (response.data.isDuplicate) {
        // Filter out the current lead from matches
        const matches = response.data.matches.filter((m: any) => m.id !== lead.id);
        
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

  const handleQCSubmitComment = async () => {
    if (!qcCommentText.trim()) {
      showError('Please enter a comment');
      return;
    }

    setQCProcessing(true);
    try {
      if (qcAction === 'Disqualified') {
        await api.patch(`/leads/${actualLeadId}/status`, {
          status: 'Disqualified',
          comment: qcCommentText
        });
        showSuccess('Lead marked as Disqualified');
      } else if (qcAction === 'Callback') {
        await api.patch(`/leads/${actualLeadId}/status`, {
          status: 'Callback',
          comment: qcCommentText
        });
        showSuccess('Lead marked as Callback');
      }
      
      setShowQCCommentModal(false);
      setQCCommentText('');
      setQCAction(null);
      
      // Redirect back to QC Dashboard
      setTimeout(() => {
        navigate('/qc-dashboard');
      }, 1000);
    } catch (error: any) {
      showError(error.response?.data?.error || 'Failed to update lead status');
    } finally {
      setQCProcessing(false);
    }
  };

  const handleQCOverrideSubmit = async () => {
    if (!qcCommentText.trim()) {
      showError('Please enter a comment');
      return;
    }

    setQCProcessing(true);
    try {
      // Upload recording if provided
      if (recordingFile) {
        try {
          setUploadingRecording(true);
          const formData = new FormData();
          formData.append('recording', recordingFile);
          
          await api.post(`/qc/leads/${actualLeadId}/recording`, formData, {
            headers: {
              'Content-Type': 'multipart/form-data',
            },
          });
          setRecordingFile(null);
        } catch (error) {
          console.error('Failed to upload recording:', error);
          showWarning('Failed to upload recording, but lead will still be override qualified');
        } finally {
          setUploadingRecording(false);
        }
      }
      
      await api.patch(`/leads/${actualLeadId}/status`, {
        status: 'Disqualified',
        comment: qcCommentText || 'Override: Disqualified for agent but qualified for client',
        overrideQualified: true,
        overrideReason: qcCommentText
      });
      showSuccess('Lead override qualified successfully! (Disqualified for agent, Qualified for client)');
      
      setShowQCCommentModal(false);
      setQCCommentText('');
      setQCAction(null);
      
      // Redirect back to QC Dashboard
      setTimeout(() => {
        navigate('/qc-dashboard');
      }, 1000);
    } catch (error: any) {
      showError(error.response?.data?.error || 'Failed to override qualify lead');
    } finally {
      setQCProcessing(false);
    }
  };

  const handleArchiveLead = (stage: 'Closed' | 'Dead') => {
    setArchiveStage(stage);
    setShowArchiveModal(true);
  };

  const confirmArchiveLead = async () => {
    if (!archiveStage) return;

    try {
      await api.patch(`${apiPrefix}/leads/${actualLeadId}/archive`, {
        pipelineStage: archiveStage
      });
      showSuccess(`Lead marked as ${archiveStage}`);
      setShowArchiveModal(false);
      
      // Navigate back to appropriate page
      if (user?.role === 'TeamMember') {
        navigate('/team-member/dashboard');
      } else {
        navigate(archiveStage === 'Closed' ? '/client/closed-leads' : '/client/dead-leads');
      }
    } catch (error: any) {
      console.error('Failed to archive lead:', error);
      showError(error.response?.data?.error || `Failed to mark lead as ${archiveStage}`);
      setShowArchiveModal(false);
    }
  };



  if (loading) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#fafafa' }}><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>
      </Layout>
    );
  }

  if (!lead) {
    return (
      <Layout>
        <div className="text-center py-12">
          <p className="text-gray-500">Lead not found</p>
          <button
            onClick={() => navigate(-1)}
            className="mt-4 text-primary text-primary-hover"
          >
            Go Back
          </button>
        </div>
      </Layout>
    );
  }

  const pendingTasks = tasks.filter(t => t.status === 'pending');
  const completedTasks = tasks.filter(t => t.status === 'completed');

  return (
    <Layout>
      <div className="min-h-screen" style={{ backgroundColor: '#fafafa' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="mb-8">
            <button
              onClick={() => navigate(-1)}
              className="text-primary text-primary-hover mb-4 flex items-center text-sm font-medium"
            >
              ← Back
            </button>
            <div className="bg-white rounded-2xl p-6 border border-gray-100">
              <div className="flex items-start justify-between">
                <div>
                  <h1 className="text-2xl font-semibold text-gray-900">
                    {lead.homeownerFirst} {lead.homeownerLast}
                  </h1>
                  <p className="text-gray-500 mt-1 text-sm">Serial: {lead.serialNumber}</p>
                </div>
                
                {/* Actions Dropdown */}
                {showActions && (
                  <div className="relative">
                    <button
                      onClick={() => setShowActionsDropdown(!showActionsDropdown)}
                      className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors"
                    >
                      Actions
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    
                    {showActionsDropdown && (
                      <>
                        {/* Backdrop */}
                        <div 
                          className="fixed inset-0 z-10" 
                          onClick={() => setShowActionsDropdown(false)}
                        />
                        
                        {/* Dropdown Menu */}
                        <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
                          {/* Re-assign to Stage */}
                          <button
                            onClick={() => {
                              setShowActionsDropdown(false);
                              handleOpenReassignModal();
                            }}
                            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            Re-assign to Stage
                          </button>
                          
                          {/* Divider */}
                          {lead.pipelineStage !== 'Closed' && lead.pipelineStage !== 'Dead' && (
                            <div className="border-t border-gray-100 my-1" />
                          )}
                          
                          {/* Mark as Closed */}
                          {lead.pipelineStage !== 'Closed' && lead.pipelineStage !== 'Dead' && (
                            <button
                              onClick={() => {
                                setShowActionsDropdown(false);
                                handleArchiveLead('Closed');
                              }}
                              className="w-full text-left px-4 py-2 text-sm text-primary bg-primary-light-hover flex items-center gap-2"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              Mark as Closed
                            </button>
                          )}
                          
                          {/* Mark as Dead */}
                          {lead.pipelineStage !== 'Closed' && lead.pipelineStage !== 'Dead' && (
                            <button
                              onClick={() => {
                                setShowActionsDropdown(false);
                                handleArchiveLead('Dead');
                              }}
                              className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                              Mark as Dead
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Call Recording - Show only for Client role */}
          {user?.role === 'Client' && lead.recordingUrl && (
            <div className="bg-white rounded-2xl p-6 border border-gray-100 mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Call Recording</h3>
              <audio controls className="w-full">
                <source src={lead.recordingUrl} type="audio/mpeg" />
                Your browser does not support the audio element.
              </audio>
            </div>
          )}

          {/* Main Content - Two Column Layout */}
          <div className={`grid grid-cols-1 gap-6 ${(user?.role === 'Client' || user?.role === 'TeamMember') ? 'lg:grid-cols-3' : ''}`}>
            {/* Left Column - Lead Information */}
            <div className={`space-y-6 ${(user?.role === 'Client' || user?.role === 'TeamMember') ? 'lg:col-span-2' : ''}`}>
              {/* Contact & Status Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Contact Information */}
                <div className="bg-white rounded-2xl p-6 border border-gray-100">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Contact Information</h3>
                  <dl className="space-y-3">
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Phone</dt>
                      <dd className="text-sm text-gray-900 mt-1">{lead.phone}</dd>
                    </div>
                    {lead.email && (
                      <div>
                        <dt className="text-sm font-medium text-gray-500">Email</dt>
                        <dd className="text-sm text-gray-900 mt-1">{lead.email}</dd>
                      </div>
                    )}
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Address</dt>
                      <dd className="text-sm text-gray-900 mt-1">{lead.addressText}</dd>
                    </div>
                  </dl>
                </div>

                {/* Lead Status */}
                <div className="bg-white rounded-2xl p-6 border border-gray-100">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Lead Status</h3>
                  <dl className="space-y-3">
                    {/* For Client and TeamMember: Show Pipeline Stage */}
                    {(user?.role === 'Client' || user?.role === 'TeamMember') && (
                      <div>
                        <dt className="text-sm font-medium text-gray-500">Pipeline Stage</dt>
                        <dd className="text-sm text-gray-900 mt-1 flex items-center gap-2">
                          {lead.clientReviewed ? lead.pipelineStage : 'Under Review'}
                          {stageCompletion?.isComplete && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700" title="All tasks complete">
                              <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              Complete
                            </span>
                          )}
                        </dd>
                      </div>
                    )}
                    
                    {/* For other roles: Show Lead Status (Pending, Qualified, etc.) */}
                    {user?.role !== 'Client' && user?.role !== 'TeamMember' && (
                      <div>
                        <dt className="text-sm font-medium text-gray-500">Status</dt>
                        <dd className="text-sm mt-1">
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${
                            lead.status === 'Qualified' ? 'bg-green-100 text-green-800 border-green-200' :
                            lead.status === 'Disqualified' ? 'bg-red-100 text-red-800 border-red-200' :
                            lead.status === 'Duplicate' ? 'bg-cyan-100 text-cyan-800 border-cyan-200' :
                            lead.status === 'Callback' ? 'bg-gray-900 text-white border-gray-700' :
                            'bg-yellow-100 text-yellow-800 border-yellow-200'
                          }`}>
                            {lead.status || 'Pending'}
                          </span>
                        </dd>
                      </div>
                    )}
                    
                    {lead.campaign && (
                      <div>
                        <dt className="text-sm font-medium text-gray-500">Campaign</dt>
                        <dd className="text-sm text-gray-900 mt-1">{lead.campaign.name}</dd>
                      </div>
                    )}
                    
                    {/* Show Submission Date/Time for non-Client/TeamMember roles */}
                    {user?.role !== 'Client' && user?.role !== 'TeamMember' && (
                      <div>
                        <dt className="text-sm font-medium text-gray-500">Submitted</dt>
                        <dd className="text-sm text-gray-900 mt-1">
                          {new Date(lead.createdAt).toLocaleString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </dd>
                      </div>
                    )}
                    
                    {/* Show Agent Name for non-Client/TeamMember roles */}
                    {user?.role !== 'Client' && user?.role !== 'TeamMember' && lead.agent && (
                      <div>
                        <dt className="text-sm font-medium text-gray-500">Agent</dt>
                        <dd className="text-sm text-gray-900 mt-1">{lead.agent.fullName}</dd>
                      </div>
                    )}
                    
                    {/* Show QC Agent for non-Client/TeamMember roles */}
                    {user?.role !== 'Client' && user?.role !== 'TeamMember' && lead.qcAgent && (
                      <div>
                        <dt className="text-sm font-medium text-gray-500">QC Agent</dt>
                        <dd className="text-sm text-gray-900 mt-1">{lead.qcAgent.fullName}</dd>
                      </div>
                    )}
                    
                    {/* QC Comment - Show for non-Client/TeamMember roles if exists */}
                    {user?.role !== 'Client' && user?.role !== 'TeamMember' && lead.qcComment && (
                      <div className="pt-3 border-t border-gray-200">
                        <dt className="text-sm font-medium text-gray-500 mb-2">QC Comment</dt>
                        <dd className="bg-amber-50 border-l-4 border-amber-400 p-3 rounded-r-lg">
                          <p className="text-sm text-amber-900 whitespace-pre-wrap">{lead.qcComment}</p>
                        </dd>
                      </div>
                    )}
                    
                    {/* Move to Next Stage Button - Keep this one as it's contextual */}
                    {stageCompletion?.isComplete && showActions && lead?.pipelineStage !== 'Closed' && lead?.pipelineStage !== 'Dead' && (
                      <div className="pt-3 border-t border-gray-100">
                        <button
                          onClick={handleMoveToNextStage}
                          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors shadow-sm"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                          </svg>
                          Move to Next Stage
                        </button>
                      </div>
                    )}
                  </dl>
                </div>
              </div>

              {/* Property Details or Custom Fields */}
              {(() => {
                // Check if there are actual custom fields (non-standard fields)
                const standardFields = ['homeownerFirst', 'homeownerLast', 'phone', 'email', 'addressText'];
                const hasCustomFields = lead.customFields && Object.keys(lead.customFields).some(key => !standardFields.includes(key));
                
                return !hasCustomFields ? (
                <div className="bg-white rounded-2xl p-6 border border-gray-100">
                  <h3 className="text-lg font-semibold text-gray-900 mb-6">Property Details</h3>
                  
                  {/* Property Information */}
                  <div className="mb-6">
                    <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-3">Property Information</h4>
                    <dl className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {lead.bedrooms !== undefined && (
                      <div>
                        <dt className="text-sm font-medium text-gray-500">Bedrooms</dt>
                        <dd className="text-sm text-gray-900 mt-1">{lead.bedrooms}</dd>
                      </div>
                    )}
                    {lead.bathrooms !== undefined && (
                      <div>
                        <dt className="text-sm font-medium text-gray-500">Bathrooms</dt>
                        <dd className="text-sm text-gray-900 mt-1">{lead.bathrooms}</dd>
                      </div>
                    )}
                    {lead.marketValue && (
                      <div>
                        <dt className="text-sm font-medium text-gray-500">Market Value</dt>
                        <dd className="text-sm text-gray-900 mt-1">${lead.marketValue.toLocaleString()}</dd>
                      </div>
                    )}
                    {lead.askingPrice && (
                      <div>
                        <dt className="text-sm font-medium text-gray-500">Asking Price</dt>
                        <dd className="text-sm text-gray-900 mt-1">${lead.askingPrice.toLocaleString()}</dd>
                      </div>
                    )}
                    {lead.negotiable && (
                      <div>
                        <dt className="text-sm font-medium text-gray-500">Negotiable</dt>
                        <dd className="text-sm text-gray-900 mt-1">{lead.negotiable}</dd>
                      </div>
                    )}
                    {lead.propertyType && (
                      <div>
                        <dt className="text-sm font-medium text-gray-500">Property Type</dt>
                        <dd className="text-sm text-gray-900 mt-1">{lead.propertyType}</dd>
                      </div>
                    )}
                    {lead.listingStatus && (
                      <div>
                        <dt className="text-sm font-medium text-gray-500">Listing Status</dt>
                        <dd className="text-sm text-gray-900 mt-1">{lead.listingStatus}</dd>
                      </div>
                    )}
                    {lead.occupancy && (
                      <div>
                        <dt className="text-sm font-medium text-gray-500">Occupancy</dt>
                        <dd className="text-sm text-gray-900 mt-1">{lead.occupancy}</dd>
                      </div>
                    )}
                    {lead.license && (
                      <div>
                        <dt className="text-sm font-medium text-gray-500">License</dt>
                        <dd className="text-sm text-gray-900 mt-1">{lead.license}</dd>
                      </div>
                    )}
                    </dl>
                  </div>

                  {/* Seller Information */}
                  <div className="mb-6">
                    <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-3">Seller Information</h4>
                    <dl className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {lead.sellingReason && (
                      <div>
                        <dt className="text-sm font-medium text-gray-500">Selling Reason</dt>
                        <dd className="text-sm text-gray-900 mt-1">{lead.sellingReason}</dd>
                      </div>
                    )}
                    {lead.ownershipTimelineValue && lead.ownershipTimelineUnit && (
                      <div>
                        <dt className="text-sm font-medium text-gray-500">Ownership Timeline</dt>
                        <dd className="text-sm text-gray-900 mt-1">{lead.ownershipTimelineValue} {lead.ownershipTimelineUnit}</dd>
                      </div>
                    )}
                    {lead.closingTimeline && (
                      <div>
                        <dt className="text-sm font-medium text-gray-500">Closing Timeline</dt>
                        <dd className="text-sm text-gray-900 mt-1">{lead.closingTimeline}</dd>
                      </div>
                    )}
                    {lead.motivationRating !== undefined && (
                      <div>
                        <dt className="text-sm font-medium text-gray-500">Motivation Rating</dt>
                        <dd className="text-sm text-gray-900 mt-1">{lead.motivationRating}/10</dd>
                      </div>
                    )}
                    {lead.conditionRating !== undefined && (
                      <div>
                        <dt className="text-sm font-medium text-gray-500">Condition Rating</dt>
                        <dd className="text-sm text-gray-900 mt-1">{lead.conditionRating}/10</dd>
                      </div>
                    )}
                    </dl>
                  </div>

                  {/* Financial Information */}
                  <div className="mb-6">
                    <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-3">Financial Information</h4>
                    <dl className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {lead.mortgageYesNo !== undefined && (
                      <div>
                        <dt className="text-sm font-medium text-gray-500">Mortgage</dt>
                        <dd className="text-sm text-gray-900 mt-1">{lead.mortgageYesNo ? 'Yes' : 'No'}</dd>
                      </div>
                    )}
                    {lead.mortgageAmount && (
                      <div>
                        <dt className="text-sm font-medium text-gray-500">Mortgage Amount</dt>
                        <dd className="text-sm text-gray-900 mt-1">${lead.mortgageAmount.toLocaleString()}</dd>
                      </div>
                    )}
                    </dl>
                  </div>

                  {/* Additional Notes */}
                  {lead.additionalInfo && (
                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-3">Additional Information</h4>
                      <p className="text-sm text-gray-900 bg-gray-50 p-4 rounded-xl">{lead.additionalInfo}</p>
                    </div>
                  )}
                </div>

              ) : hasCustomFields ? (
                <div className="bg-white rounded-2xl p-6 border border-gray-100">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Lead Information</h3>
                  <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {(() => {
                      // Create a map of field IDs to labels from the form template
                      const fieldMap = new Map();
                      if (lead.campaign?.formTemplate?.fields) {
                        lead.campaign.formTemplate.fields.forEach((field: any) => {
                          // Store with original ID
                          fieldMap.set(field.id, field.label);
                          // Also store without "field_" prefix if it has one
                          if (field.id.startsWith('field_')) {
                            const withoutPrefix = field.id.replace('field_', '');
                            fieldMap.set(withoutPrefix, field.label);
                          }
                          // Also store with "field_" prefix if it doesn't have one
                          if (!field.id.startsWith('field_')) {
                            fieldMap.set(`field_${field.id}`, field.label);
                          }
                        });
                      }

                      const standardFields = ['homeownerFirst', 'homeownerLast', 'phone', 'email', 'addressText'];
                      const customFieldEntries = Object.entries(lead.customFields!).filter(([key]) => 
                        !standardFields.includes(key)
                      );

                      return customFieldEntries.map(([key, value]) => {
                        // Try to get label from template
                        let label = fieldMap.get(key);
                        
                        // If not found, format the key to be readable
                        if (!label) {
                          // Check if it's a timestamp-based ID (all digits) or starts with "field_"
                          if (/^\d+$/.test(key) || key.startsWith('field_')) {
                            // These are form builder field IDs - just use a generic numbered label
                            const fieldNumber = customFieldEntries.findIndex(([k]) => k === key) + 1;
                            label = `Field ${fieldNumber}`;
                          } else if (key.includes('_')) {
                            // Format snake_case to Title Case
                            label = key.split('_').map(word => 
                              word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
                            ).join(' ');
                          } else if (/[A-Z]/.test(key)) {
                            // Format camelCase to Title Case
                            label = key.replace(/([A-Z])/g, ' $1').trim();
                            label = label.charAt(0).toUpperCase() + label.slice(1);
                          } else {
                            // Just capitalize first letter
                            label = key.charAt(0).toUpperCase() + key.slice(1);
                          }
                        }

                        return (
                          <div key={key}>
                            <dt className="text-sm font-medium text-gray-500">{label}</dt>
                            <dd className="text-sm text-gray-900 mt-1">
                              {typeof value === 'boolean' 
                                ? (value ? 'Yes' : 'No')
                                : Array.isArray(value)
                                ? value.join(', ')
                                : value?.toString() || 'N/A'}
                            </dd>
                          </div>
                        );
                      });
                    })()}
                  </dl>
                </div>
              ) : null;
              })()}

              {/* Tasks Section - Only for Clients */}
              {showTasks && tasks.length > 0 && (
                <div className="bg-white rounded-2xl p-6 border border-gray-100">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Tasks ({pendingTasks.length} pending)</h3>
                  <div className="space-y-4">
                    {pendingTasks.map((task) => (
                      <div key={task.id} className="border-b border-gray-100 pb-4 last:border-0">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900">{task.title}</p>
                            <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                              <span>👤 {task.assignedUser.name}</span>
                              <span>•</span>
                              <span>📅 {new Date(task.dueDate).toLocaleDateString()}</span>
                            </div>
                          </div>
                          <span className="px-2 py-1 text-xs rounded-full font-medium bg-amber-100 text-amber-700">
                            Pending
                          </span>
                        </div>
                        {task.description && (
                          <div className="w-full bg-gray-50 rounded-lg p-3 mt-2">
                            <p className="text-xs text-gray-700">{task.description}</p>
                          </div>
                        )}
                      </div>
                    ))}
                    {completedTasks.length > 0 && (
                      <details className="mt-4 pt-4 border-t border-gray-200">
                        <summary className="cursor-pointer text-sm font-medium text-gray-600 hover:text-gray-900">
                          View {completedTasks.length} completed {completedTasks.length === 1 ? 'task' : 'tasks'}
                        </summary>
                        <div className="mt-4 space-y-4">
                          {completedTasks.map((task) => (
                            <div key={task.id} className="border-b border-gray-100 pb-4 last:border-0">
                              <div className="flex items-start justify-between mb-2">
                                <div className="flex-1">
                                  <p className="text-sm font-medium text-gray-900">{task.title}</p>
                                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                                    <span>👤 {task.assignedUser.name}</span>
                                    <span>•</span>
                                    <span>✓ Completed</span>
                                  </div>
                                </div>
                                <span className="px-2 py-1 text-xs rounded-full font-medium bg-emerald-100 text-emerald-700">
                                  Completed
                                </span>
                              </div>
                              {task.completionNote && (
                                <div className="w-full bg-gray-50 rounded-lg p-3 mt-2">
                                  <p className="text-xs text-gray-700">{task.completionNote}</p>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </details>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Right Column - Notes & Schedules (Only for Client and TeamMember) */}
            {(user?.role === 'Client' || user?.role === 'TeamMember') && (
            <div className="space-y-6">
              {/* Notes */}
              <div className="bg-white rounded-2xl p-6 border border-gray-100">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Notes ({notes.length})</h3>
                  {lead?.pipelineStage !== 'Closed' && lead?.pipelineStage !== 'Dead' && (
                    <button
                      onClick={() => setShowNoteForm(!showNoteForm)}
                      className="px-3 py-1.5 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors"
                    >
                      + Add Note
                    </button>
                  )}
                </div>

                {showNoteForm && (
                  <div className="mb-4 p-4 bg-gray-50 rounded-xl">
                    <textarea
                      value={newNote}
                      onChange={(e) => setNewNote(e.target.value)}
                      placeholder="Enter your note..."
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm"
                    />
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={handleAddNote}
                        className="px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => {
                          setShowNoteForm(false);
                          setNewNote('');
                        }}
                        className="px-4 py-2 bg-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-300"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {notes.length === 0 ? (
                  <p className="text-gray-400 text-center py-8 text-sm">No notes yet</p>
                ) : (
                  <div className="space-y-4 max-h-96 overflow-y-auto">
                    {notes.map((note) => (
                      <div key={note.id} className="border-b border-gray-100 pb-4 last:border-0">
                        <p className="text-sm text-gray-900 whitespace-pre-wrap">{note.content}</p>
                        <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
                          <span>{new Date(note.createdAt).toLocaleString()}</span>
                          {note.authorName && <span className="font-medium">{note.authorName}</span>}
                        </div>
                        {note.recordingUrl && (
                          <a 
                            href={note.recordingUrl} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="text-xs text-primary text-primary-hover mt-1 inline-block"
                          >
                            🎤 Recording
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Schedules */}
              <div className="bg-white rounded-2xl p-6 border border-gray-100">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Schedules ({schedules.length})</h3>
                  {lead?.pipelineStage !== 'Closed' && lead?.pipelineStage !== 'Dead' && (
                    <button
                      onClick={() => setShowScheduleForm(!showScheduleForm)}
                      className="px-3 py-1.5 bg-primary text-white text-sm font-medium rounded-lg bg-primary-hover transition-colors"
                    >
                      + Schedule
                    </button>
                  )}
                </div>

                {showScheduleForm && (
                  <div className="mb-4 p-4 bg-gray-50 rounded-xl space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Date</label>
                        <input
                          type="date"
                          value={scheduleDate}
                          onChange={(e) => setScheduleDate(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary500 focus:border-transparent text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Time</label>
                        <input
                          type="time"
                          value={scheduleTime}
                          onChange={(e) => setScheduleTime(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary500 focus:border-transparent text-sm"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Type</label>
                      <select
                        value={scheduleType}
                        onChange={(e) => setScheduleType(e.target.value as 'CALL' | 'APPOINTMENT')}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary500 focus:border-transparent text-sm"
                      >
                        <option value="CALL">Call</option>
                        <option value="APPOINTMENT">Appointment</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Notes (optional)</label>
                      <textarea
                        value={scheduleNotes}
                        onChange={(e) => setScheduleNotes(e.target.value)}
                        placeholder="Add notes..."
                        rows={2}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary500 focus:border-transparent text-sm"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={handleAddSchedule}
                        className="px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg bg-primary-hover"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => {
                          setShowScheduleForm(false);
                          setScheduleDate('');
                          setScheduleTime('');
                          setScheduleNotes('');
                        }}
                        className="px-4 py-2 bg-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-300"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {schedules.length === 0 ? (
                  <p className="text-gray-400 text-center py-8 text-sm">No schedules yet</p>
                ) : (
                  <div className="space-y-4 max-h-96 overflow-y-auto">
                    {schedules.map((schedule) => (
                      <div key={schedule.id} className="border-b border-gray-100 pb-4 last:border-0">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900">
                              {schedule.type === 'CALL' ? '📞 Call' : '📅 Appointment'}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                              {new Date(schedule.scheduledDate).toLocaleString()}
                            </p>
                          </div>
                          <span className={`px-2 py-1 text-xs rounded-full font-medium ${
                            schedule.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' :
                            schedule.status === 'CANCELLED' ? 'bg-rose-100 text-rose-700' :
                            'bg-primary-light text-primary'
                          }`}>
                            {schedule.status}
                          </span>
                        </div>
                        {schedule.notes && (
                          <div className="w-full bg-gray-50 rounded-lg p-3 mt-2">
                            <p className="text-xs text-gray-700 whitespace-pre-line">{schedule.notes}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Activity History */}
              <div className="bg-white rounded-2xl p-6 border border-gray-100">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Activity History</h3>
                
                {activities.length === 0 ? (
                  <p className="text-gray-400 text-center py-8 text-sm">No activity yet</p>
                ) : (
                  <div className="space-y-4">
                    {activities.map((activity) => {
                      // Determine icon and color based on action type
                      const getActivityIcon = (actionType: string) => {
                        switch (actionType) {
                          case 'pipeline_changed':
                            return { 
                              icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>,
                              color: 'text-primary'
                            };
                          case 'task_completed':
                            return { 
                              icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
                              color: 'text-emerald-600'
                            };
                          case 'stage_completed':
                            return { 
                              icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>,
                              color: 'text-emerald-600'
                            };
                          case 'note_added':
                            return { 
                              icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>,
                              color: 'text-gray-600'
                            };
                          case 'schedule_created':
                            return { 
                              icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
                              color: 'text-purple-600'
                            };
                          case 'lead_created':
                            return { 
                              icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>,
                              color: 'text-primary'
                            };
                          default:
                            return { 
                              icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
                              color: 'text-gray-600'
                            };
                        }
                      };

                      const { icon, color } = getActivityIcon(activity.actionType);
                      
                      // Get background color based on quality rating
                      const getQualityBgColor = (qualityRating?: string) => {
                        if (!qualityRating) return '';
                        switch (qualityRating.toLowerCase()) {
                          case 'green':
                            return 'bg-emerald-50 border-emerald-100';
                          case 'orange':
                            return 'bg-orange-50 border-orange-100';
                          case 'red':
                            return 'bg-red-50 border-red-100';
                          default:
                            return '';
                        }
                      };

                      const qualityRating = activity.metadata?.qualityRating;
                      const bgColor = getQualityBgColor(qualityRating);
                      
                      return (
                        <div key={activity.id} className={`flex gap-3 pb-4 border-b border-gray-100 last:border-0 last:pb-0 ${bgColor ? `${bgColor} -mx-3 px-3 py-3 rounded-lg border` : ''}`}>
                          <div className={`flex-shrink-0 ${color}`}>
                            {icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-gray-900">{activity.description}</p>
                            <p className="text-xs text-gray-500 mt-1">
                              {new Date(activity.createdAt).toLocaleString()}
                            </p>
                            {activity.metadata && typeof activity.metadata === 'object' && (
                              <div className="mt-1 text-xs text-gray-600">
                                {activity.metadata.stage && (
                                  <span className="inline-block px-2 py-0.5 bg-gray-100 rounded text-gray-700">
                                    {activity.metadata.stage}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
            )}
          </div>
        </div>
      </div>

      {/* QC Action Buttons - Show only for QC role from QC Dashboard */}
      {user?.role === 'QualityControl' && isQCMode && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
          <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-lg">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">QC Actions</h3>
            
            {/* Duplicate Warning */}
            {checkingDuplicate && (
              <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                <p className="text-sm text-gray-600">Checking for duplicates...</p>
              </div>
            )}
            
            {duplicateInfo && duplicateInfo.isDuplicate && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
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
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold border ${
                              match.status === 'Qualified' ? 'bg-green-100 text-green-800 border-green-200' :
                              match.status === 'Disqualified' ? 'bg-red-100 text-red-800 border-red-200' :
                              match.status === 'Duplicate' ? 'bg-cyan-100 text-cyan-800 border-cyan-200' :
                              match.status === 'Callback' ? 'bg-gray-900 text-white border-gray-700' :
                              'bg-yellow-100 text-yellow-800 border-yellow-200'
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
            
            {/* Recording Upload Section */}
            <div className="mb-6 pb-6 border-b border-gray-200">
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
                    file:bg-primary-light file:text-primary
                    hover:file:bg-cyan-100
                    file:rounded-lg
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
                <p className="mt-2 text-sm text-primary">
                  Uploading recording...
                </p>
              )}
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <button
                onClick={handleQCQualify}
                className="flex items-center justify-center gap-2 px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors shadow-sm"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Qualify
              </button>
              
              <button
                onClick={handleQCDisqualify}
                className="flex items-center justify-center gap-2 px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors shadow-sm"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Disqualify
              </button>
              
              <button
                onClick={handleQCDuplicate}
                className="flex items-center justify-center gap-2 px-4 py-3 bg-primary bg-primary-hover text-white rounded-lg font-medium transition-colors shadow-sm"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Duplicate
              </button>
              
              <button
                onClick={handleQCCallback}
                className="flex items-center justify-center gap-2 px-4 py-3 bg-gray-900 hover:bg-gray-800 text-white rounded-lg font-medium transition-colors shadow-sm"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                Callback
              </button>

              <button
                onClick={handleQCOverride}
                className="flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-br from-orange-400 to-orange-500 hover:from-orange-500 hover:to-orange-600 text-white rounded-lg font-medium transition-colors shadow-sm"
                title="Disqualify for agent but send to client as qualified"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                Override
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Re-assign to Stage Modal */}
      {showReassignModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Re-assign Lead to Stage</h3>
            
            <p className="text-sm text-gray-600 mb-6">
              Re-assign this lead to a stage for rework. This will clear quality ratings and create new tasks.
            </p>

            {/* Stage Selection */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Stage <span className="text-red-500">*</span>
              </label>
              <select
                value={reassignStage}
                onChange={(e) => handleReassignStageChange(e.target.value)}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
              >
                <option value="">Choose a stage...</option>
                {pipelineStages.map((stage) => (
                  <option key={stage.id} value={stage.name}>
                    {stage.displayName}
                  </option>
                ))}
              </select>
            </div>

            {/* Assignment Method */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Assignment Method
              </label>
              <div className="space-y-3">
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="auto"
                    checked={reassignMethod === 'auto'}
                    onChange={(e) => handleReassignMethodChange('auto')}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700">
                    <strong>Auto-assign (Round Robin)</strong> - System will assign to next available team member
                  </span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="manual"
                    checked={reassignMethod === 'manual'}
                    onChange={(e) => handleReassignMethodChange('manual')}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700">
                    <strong>Choose specific member</strong> - Select a team member manually
                  </span>
                </label>
              </div>
            </div>

            {/* Team Member Selection (conditional) */}
            {reassignMethod === 'manual' && reassignStage && (
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Team Member <span className="text-red-500">*</span>
                </label>
                <select
                  value={reassignMemberId}
                  onChange={(e) => setReassignMemberId(e.target.value)}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                >
                  <option value="">Choose a team member...</option>
                  {availableMembers.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name} - {member.positionTitle}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowReassignModal(false);
                  setReassignStage('');
                  setReassignMethod('auto');
                  setReassignMemberId('');
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
                disabled={reassigning}
              >
                Cancel
              </button>
              <button
                onClick={handleReassignLead}
                disabled={reassigning}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {reassigning ? 'Re-assigning...' : 'Confirm Re-assignment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">
              Confirm Action
            </h3>
            
            <p className="text-sm text-gray-600 mb-6">
              {confirmAction === 'qualify' 
                ? 'Are you sure you want to mark this lead as Qualified?' 
                : 'Are you sure you want to mark this lead as Duplicate?'}
            </p>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowConfirmModal(false);
                  setConfirmAction(null);
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmAction}
                className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors ${
                  confirmAction === 'qualify' 
                    ? 'bg-green-600 hover:bg-green-700' 
                    : 'bg-primary bg-primary-hover'
                }`}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Archive Confirmation Modal */}
      {showArchiveModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                archiveStage === 'Closed' ? 'bg-primary-light' : 'bg-red-100'
              }`}>
                <svg className={`w-6 h-6 ${archiveStage === 'Closed' ? 'text-primary' : 'text-red-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {archiveStage === 'Closed' ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  )}
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900">
                Mark as {archiveStage}?
              </h3>
            </div>
            
            <p className="text-sm text-gray-600 mb-6">
              {archiveStage === 'Closed' 
                ? 'Are you sure you want to mark this lead as Closed? This indicates a successful deal. All pending tasks will be automatically completed.'
                : 'Are you sure you want to mark this lead as Dead? This indicates the lead is no longer viable. All pending tasks will be automatically completed.'}
            </p>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowArchiveModal(false);
                  setArchiveStage(null);
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmArchiveLead}
                className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors ${
                  archiveStage === 'Closed' 
                    ? 'bg-primary bg-primary-hover' 
                    : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                Mark as {archiveStage}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QC Comment Modal */}
      {showQCCommentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">
              {qcAction === 'Disqualified' ? 'Disqualify Lead' : 
               qcAction === 'Callback' ? 'Mark as Callback' : 
               'Override Qualify Lead'}
            </h3>
            
            <p className="text-sm text-gray-600 mb-4">
              {qcAction === 'Override' ? (
                <>
                  This will <strong>disqualify the lead for the agent</strong> but <strong>send it to the client as qualified</strong>. 
                  Please provide a reason:
                </>
              ) : (
                <>Please provide a reason for {qcAction === 'Disqualified' ? 'disqualifying' : 'marking as callback'} this lead:</>
              )}
            </p>

            <textarea
              value={qcCommentText}
              onChange={(e) => setQCCommentText(e.target.value)}
              placeholder="Enter your comment..."
              rows={4}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary500 focus:border-transparent"
              autoFocus
            />

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowQCCommentModal(false);
                  setQCCommentText('');
                  setQCAction(null);
                }}
                disabled={qcProcessing}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={qcAction === 'Override' ? handleQCOverrideSubmit : handleQCSubmitComment}
                disabled={qcProcessing || !qcCommentText.trim()}
                className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors disabled:opacity-50 ${
                  qcAction === 'Disqualified' 
                    ? 'bg-red-600 hover:bg-red-700' 
                    : qcAction === 'Override'
                    ? 'bg-gradient-to-br from-orange-400 to-orange-500 hover:from-orange-500 hover:to-orange-600'
                    : 'bg-gray-900 hover:bg-gray-800'
                }`}
              >
                {qcProcessing ? 'Processing...' : 'Submit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default LeadDetail;




