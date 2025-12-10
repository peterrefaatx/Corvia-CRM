import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout/Layout';
import api from '../services/api';
import { useToast } from '../contexts/ToastContext';

interface ClientNote {
  id: string;
  content: string;
  recordingUrl?: string;
  createdAt: string;
  updatedAt: string;
}

interface ClientSchedule {
  id: string;
  leadId: string;
  scheduledDate: string;
  type: 'CALL' | 'APPOINTMENT';
  status: 'SCHEDULED' | 'COMPLETED' | 'CANCELLED' | 'RESCHEDULED';
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

interface StageQuality {
  id: string;
  leadId: string;
  pipelineStage: string;
  qualityRating: string;
  ratedAt: string;
  ratedBy: string;
  ratedByName: string;
}

interface StageCompletionStatus {
  isComplete: boolean;
  pendingCount: number;
  completedCount: number;
  totalCount: number;
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
  assignedAgent?: string;
  temperature: string;
  clientNotes?: ClientNote[];
  campaign?: { name: string; formTemplateId?: string };
  stageQualities?: StageQuality[];
  stageCompletion?: StageCompletionStatus;
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
  taskQualityIndicator?: string;
  taskQualityStage?: string;
}

type PipelineStage = string;

interface PipelineStageData {
  id: string;
  name: string;
  displayName: string;
  order: number;
  isActive: boolean;
  isSystem: boolean;
}

const ClientPipeline: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
  const [pipelineStages, setPipelineStages] = useState<PipelineStageData[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [draggedLead, setDraggedLead] = useState<Lead | null>(null);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [selectedLeadTemplate, setSelectedLeadTemplate] = useState<any>(null);
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [newNoteRecordingUrl, setNewNoteRecordingUrl] = useState('');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteContent, setEditingNoteContent] = useState('');
  const [editingNoteRecordingUrl, setEditingNoteRecordingUrl] = useState('');
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'Closed' | 'Dead' | null>(null);
  const [playingRecording, setPlayingRecording] = useState<string | null>(null);
  const [selectedStageFilter, setSelectedStageFilter] = useState<string>('all');
  
  // Schedule states
  const [schedules, setSchedules] = useState<ClientSchedule[]>([]);
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [scheduleType, setScheduleType] = useState<'CALL' | 'APPOINTMENT'>('CALL');
  const [scheduleNotes, setScheduleNotes] = useState('');
  const [reschedulingId, setReschedulingId] = useState<string | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('');
  
  // Team availability states
  const [showTeamPopover, setShowTeamPopover] = useState<string | null>(null);
  const [stageTeamMembers, setStageTeamMembers] = useState<Record<string, any[]>>({});
  const [loadingTeam, setLoadingTeam] = useState(false);

  useEffect(() => {
    loadPipelineStages();
    loadLeads();
    loadAutomationRules();
  }, []);

  const loadPipelineStages = async () => {
    try {
      const response = await api.get('/pipeline-stages');
      // Filter out system stages (Closed, Dead) for the pipeline view
      const activeStages = response.data.filter((stage: PipelineStageData) => !stage.isSystem);
      setPipelineStages(activeStages);
    } catch (error) {
      console.error('Failed to load pipeline stages:', error);
      // Fallback to default stages if API fails
      setPipelineStages([
        { id: '1', name: 'Attempting Contact', displayName: 'Attempting Contact', order: 1, isActive: true, isSystem: false },
        { id: '2', name: 'Contacted', displayName: 'Contacted', order: 2, isActive: true, isSystem: false },
        { id: '3', name: 'Follow-Up', displayName: 'Follow-Up', order: 3, isActive: true, isSystem: false },
        { id: '4', name: 'Appointment', displayName: 'Appointment', order: 4, isActive: true, isSystem: false },
        { id: '5', name: 'Offer', displayName: 'Offer', order: 5, isActive: true, isSystem: false },
        { id: '6', name: 'Negotiation', displayName: 'Negotiation', order: 6, isActive: true, isSystem: false },
        { id: '7', name: 'Contract', displayName: 'Contract', order: 7, isActive: true, isSystem: false },
      ]);
    }
  };

  const loadLeads = async () => {
    try {
      const response = await api.get('/client/leads');
      // Map the API response and filter only reviewed leads
      const mappedLeads = await Promise.all(
        response.data
          .filter((lead: any) => lead.clientReviewed === true)
          .map(async (lead: any) => {
            // Fetch stage completion status for each lead
            let stageCompletion: StageCompletionStatus | undefined;
            try {
              const statusResponse = await api.get(`/tasks/lead/${lead.id}/stage-status`);
              stageCompletion = statusResponse.data;
            } catch (error) {
              console.error(`Failed to load stage status for lead ${lead.id}:`, error);
            }

            return {
              id: lead.id,
              serialNumber: lead.serialNumber,
              homeownerFirst: lead.homeownerFirst,
              homeownerLast: lead.homeownerLast,
              phone: lead.phone,
              addressText: lead.addressText,
              pipelineStage: lead.pipelineStage || 'Attempting Contact',
              lastUpdated: lead.updatedAt || lead.createdAt,
              assignedAgent: lead.agent?.name,
              temperature: lead.temperature || 'Cold',
              clientNotes: lead.clientNotes || [],
              stageQualities: lead.stageQualities || [],
              taskQualityIndicator: lead.taskQualityIndicator,
              taskQualityStage: lead.taskQualityStage,
              stageCompletion
            };
          })
      );
      setLeads(mappedLeads);
    } catch (error) {
      showToast('Failed to load leads', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadAutomationRules = async () => {
    try {
      const [rulesResponse, membersResponse] = await Promise.all([
        api.get('/pipeline/automation-rules'),
        api.get('/client/team-members')
      ]);
      
      const rules = rulesResponse.data;
      const members = membersResponse.data;
      
      // Map stages to their assigned positions and team members
      const stageTeamMap: Record<string, any[]> = {};
      
      rules.forEach((rule: any) => {
        const stageName = rule.pipelineStage;
        const tasks = rule.ruleConfig?.tasks || [];
        
        tasks.forEach((task: any) => {
          const position = task.assign_to_role;
          const teamMembersForPosition = members.filter((m: any) => 
            m.positionTitle === position && m.status === 'active'
          );
          
          if (!stageTeamMap[stageName]) {
            stageTeamMap[stageName] = [];
          }
          
          teamMembersForPosition.forEach((member: any) => {
            if (!stageTeamMap[stageName].find((m: any) => m.id === member.id)) {
              stageTeamMap[stageName].push(member);
            }
          });
        });
      });
      
      setStageTeamMembers(stageTeamMap);
    } catch (error) {
      console.error('Failed to load automation rules:', error);
    }
  };

  const toggleMemberAvailability = async (memberId: string, memberName: string, currentAvailability: boolean) => {
    try {
      setLoadingTeam(true);
      const newAvailability = !currentAvailability;
      await api.patch(`/client/team-members/${memberId}/availability`, {
        isAvailable: newAvailability
      });
      showToast(`${memberName} is now ${newAvailability ? 'available' : 'on day off'}`, 'success');
      await loadAutomationRules();
    } catch (error: any) {
      showToast(error.response?.data?.error || 'Failed to update availability', 'error');
    } finally {
      setLoadingTeam(false);
    }
  };

  const openNotesModal = (lead: Lead, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedLead(lead);
    setShowNotesModal(true);
  };

  const openDetailsModal = async (leadId: string) => {
    try {
      // Fetch full lead details
      const response = await api.get(`/client/leads`);
      const fullLead = response.data.find((l: any) => l.id === leadId);
      if (fullLead) {
        setSelectedLead({
          ...fullLead,
          pipelineStage: fullLead.pipelineStage || 'Attempting Contact',
          lastUpdated: fullLead.updatedAt || fullLead.createdAt
        });
        
        // Fetch template if lead's campaign uses one
        if (fullLead.campaign?.formTemplateId) {
          try {
            const templateResponse = await api.get(`/form-templates/${fullLead.campaign.formTemplateId}`);
            setSelectedLeadTemplate(templateResponse.data);
          } catch (error) {
            console.error('Failed to load form template:', error);
            setSelectedLeadTemplate(null);
          }
        } else {
          setSelectedLeadTemplate(null);
        }
        
        setShowDetailsModal(true);
        await loadSchedules(leadId);
      }
    } catch (error) {
      showToast('Failed to load lead details', 'error');
    }
  };

  const closeNotesModal = () => {
    setShowNotesModal(false);
    setSelectedLead(null);
    setNewNote('');
    setNewNoteRecordingUrl('');
    setEditingNoteId(null);
    setEditingNoteContent('');
    setEditingNoteRecordingUrl('');
  };

  const addNote = async () => {
    if (!selectedLead || !newNote.trim()) return;
    try {
      const response = await api.post(`/client/leads/${selectedLead.id}/notes`, {
        content: newNote.trim(),
        recordingUrl: newNoteRecordingUrl.trim() || null
      });
      const updatedLead = {
        ...selectedLead,
        clientNotes: [response.data, ...(selectedLead.clientNotes || [])]
      };
      setSelectedLead(updatedLead);
      setLeads(leads.map(lead => lead.id === selectedLead.id ? updatedLead : lead));
      setNewNote('');
      setNewNoteRecordingUrl('');
      showToast('Note added successfully', 'success');
    } catch (error) {
      showToast('Failed to add note', 'error');
    }
  };

  const updateNote = async (noteId: string) => {
    if (!editingNoteContent.trim() || !selectedLead) return;
    try {
      const response = await api.put(`/client/notes/${noteId}`, {
        content: editingNoteContent.trim(),
        recordingUrl: editingNoteRecordingUrl.trim() || null
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
      setEditingNoteRecordingUrl('');
      showToast('Note updated successfully', 'success');
    } catch (error) {
      showToast('Failed to update note', 'error');
    }
  };

  const deleteNote = async (noteId: string) => {
    if (!selectedLead) return;
    
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

  const markLeadAs = (stage: 'Closed' | 'Dead') => {
    setConfirmAction(stage);
    setShowConfirmModal(true);
  };

  const confirmMarkLead = async () => {
    if (!selectedLead || !confirmAction) return;

    try {
      await api.patch(`/client/leads/${selectedLead.id}/pipeline-stage`, { stage: confirmAction });
      
      // Remove from current leads list
      setLeads(leads.filter(lead => lead.id !== selectedLead.id));
      setShowConfirmModal(false);
      setConfirmAction(null);
      setShowDetailsModal(false);
      setSelectedLead(null);
      showToast(`Lead marked as ${confirmAction} successfully!`, 'success');
    } catch (error: any) {
      showToast(`Failed to mark lead as ${confirmAction}`, 'error');
    }
  };

  const cancelMarkLead = () => {
    setShowConfirmModal(false);
    setConfirmAction(null);
  };

  const getLeadsByStage = (stage: PipelineStage) => {
    return leads.filter(lead => 
      (lead.pipelineStage || 'Delivered') === stage &&
      (searchQuery === '' || 
        lead.homeownerFirst.toLowerCase().includes(searchQuery.toLowerCase()) ||
        lead.homeownerLast.toLowerCase().includes(searchQuery.toLowerCase()) ||
        lead.phone.includes(searchQuery) ||
        lead.addressText.toLowerCase().includes(searchQuery.toLowerCase())
      )
    );
  };

  const handleDragStart = (lead: Lead) => {
    setDraggedLead(lead);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (stage: PipelineStage) => {
    if (!draggedLead) return;

    // Prevent moving to the same stage
    if (draggedLead.pipelineStage === stage) {
      setDraggedLead(null);
      return;
    }

    // Check if current stage tasks are complete before allowing forward movement
    const currentStageIndex = pipelineStages.findIndex(s => s.name === draggedLead.pipelineStage);
    const targetStageIndex = pipelineStages.findIndex(s => s.name === stage);
    
    // Only enforce completion check when moving forward
    if (targetStageIndex > currentStageIndex) {
      if (!draggedLead.stageCompletion?.isComplete) {
        showToast('Complete all tasks in the current stage before moving forward', 'error');
        setDraggedLead(null);
        return;
      }
    }

    try {
      await api.patch(`/client/leads/${draggedLead.id}/pipeline-stage`, {
        stage
      });
      
      setLeads(leads.map(lead => 
        lead.id === draggedLead.id 
          ? { ...lead, pipelineStage: stage, lastUpdated: new Date().toISOString() }
          : lead
      ));
      showToast('Pipeline stage updated', 'success');
    } catch (error) {
      showToast('Failed to update pipeline stage', 'error');
    } finally {
      setDraggedLead(null);
    }
  };

  const moveToNextStage = async (lead: Lead, e: React.MouseEvent) => {
    e.stopPropagation();
    
    const currentStageIndex = pipelineStages.findIndex(s => s.name === lead.pipelineStage);
    if (currentStageIndex === -1 || currentStageIndex === pipelineStages.length - 1) {
      showToast('Lead is already in the final stage', 'info');
      return;
    }
    
    const nextStage = pipelineStages[currentStageIndex + 1];
    
    try {
      await api.patch(`/client/leads/${lead.id}/pipeline-stage`, {
        stage: nextStage.name
      });
      
      setLeads(leads.map(l => 
        l.id === lead.id 
          ? { ...l, pipelineStage: nextStage.name, lastUpdated: new Date().toISOString() }
          : l
      ));
      showToast(`Moved to ${nextStage.displayName}`, 'success');
      
      // Reload leads to refresh stage completion status
      setTimeout(() => loadLeads(), 500);
    } catch (error) {
      showToast('Failed to move to next stage', 'error');
    }
  };

  const handleStageChange = async (leadId: string, newStage: PipelineStage) => {
    const lead = leads.find(l => l.id === leadId);
    if (!lead) return;

    // Check if current stage tasks are complete before allowing forward movement
    const currentStageIndex = pipelineStages.findIndex(s => s.name === lead.pipelineStage);
    const targetStageIndex = pipelineStages.findIndex(s => s.name === newStage);
    
    // Only enforce completion check when moving forward
    if (targetStageIndex > currentStageIndex) {
      if (!lead.stageCompletion?.isComplete) {
        showToast('Complete all tasks in the current stage before moving forward', 'error');
        return;
      }
    }

    try {
      await api.patch(`/client/leads/${leadId}/pipeline-stage`, {
        stage: newStage
      });
      
      setLeads(leads.map(l => 
        l.id === leadId 
          ? { ...l, pipelineStage: newStage, lastUpdated: new Date().toISOString() }
          : l
      ));
      showToast('Pipeline stage updated', 'success');
    } catch (error) {
      showToast('Failed to update pipeline stage', 'error');
    }
  };

  const loadSchedules = async (leadId: string) => {
    try {
      const response = await api.get(`/client/leads/${leadId}/schedules`);
      setSchedules(response.data);
    } catch (error) {
      console.error('Failed to load schedules:', error);
    }
  };

  const createSchedule = async () => {
    if (!selectedLead || !scheduleDate || !scheduleTime) {
      showToast('Please fill in all required fields', 'error');
      return;
    }

    try {
      const scheduledDateTime = new Date(`${scheduleDate}T${scheduleTime}`);
      await api.post(`/client/leads/${selectedLead.id}/schedules`, {
        scheduledDate: scheduledDateTime.toISOString(),
        type: scheduleType,
        notes: scheduleNotes || null
      });
      
      await loadSchedules(selectedLead.id);
      setShowScheduleForm(false);
      setScheduleDate('');
      setScheduleTime('');
      setScheduleNotes('');
      showToast('Schedule created successfully', 'success');
    } catch (error) {
      showToast('Failed to create schedule', 'error');
    }
  };

  const updateScheduleStatus = async (scheduleId: string, status: ClientSchedule['status']) => {
    try {
      await api.patch(`/client/schedules/${scheduleId}`, { status });
      setSchedules(schedules.map(s => s.id === scheduleId ? { ...s, status } : s));
      showToast('Schedule updated successfully', 'success');
    } catch (error) {
      showToast('Failed to update schedule', 'error');
    }
  };

  const deleteSchedule = async (scheduleId: string) => {
    try {
      await api.delete(`/client/schedules/${scheduleId}`);
      setSchedules(schedules.filter(s => s.id !== scheduleId));
      showToast('Schedule deleted successfully', 'success');
    } catch (error) {
      showToast('Failed to delete schedule', 'error');
    }
  };

  const startReschedule = (schedule: ClientSchedule) => {
    setReschedulingId(schedule.id);
    const date = new Date(schedule.scheduledDate);
    setRescheduleDate(date.toISOString().split('T')[0]);
    setRescheduleTime(date.toTimeString().slice(0, 5));
  };

  const confirmReschedule = async (scheduleId: string) => {
    if (!rescheduleDate || !rescheduleTime) {
      showToast('Please select date and time', 'error');
      return;
    }

    try {
      const newDateTime = new Date(`${rescheduleDate}T${rescheduleTime}`);
      await api.patch(`/client/schedules/${scheduleId}`, {
        scheduledDate: newDateTime.toISOString(),
        status: 'RESCHEDULED'
      });
      
      setSchedules(schedules.map(s => 
        s.id === scheduleId 
          ? { ...s, scheduledDate: newDateTime.toISOString(), status: 'RESCHEDULED' }
          : s
      ));
      setReschedulingId(null);
      setRescheduleDate('');
      setRescheduleTime('');
      showToast('Schedule rescheduled successfully', 'success');
    } catch (error) {
      showToast('Failed to reschedule', 'error');
    }
  };

  const getQualityIndicatorBg = (lead: Lead) => {
    // Only show quality indicator if it's for the current stage
    if (!lead.taskQualityIndicator || lead.taskQualityStage !== lead.pipelineStage) {
      return 'bg-slate-50';
    }
    
    switch (lead.taskQualityIndicator) {
      case 'green':
        return 'bg-green-50 border-green-200';
      case 'orange':
        return 'bg-orange-50 border-orange-200';
      case 'red':
        return 'bg-red-50 border-red-200';
      default:
        return 'bg-slate-50';
    }
  };

  const getTemperatureColor = (temp: string) => {
    const colors = {
      Hot: 'bg-red-600',
      Warm: 'bg-yellow-600',
      Cold: 'bg-primary',
      NoAskingPrice: 'bg-primary'
    };
    return colors[temp as keyof typeof colors] || 'bg-gray-600';
  };

  const getStageColor = (stage: PipelineStage) => {
    const colors: Record<string, string> = {
      'Attempting Contact': 'bg-gray-50',
      'Contacted': 'bg-gray-50',
      'Follow-Up': 'bg-gray-50',
      'Appointment': 'bg-gray-50',
      'Offer': 'bg-gray-50',
      'Negotiation': 'bg-gray-50',
      'Contract': 'bg-gray-50',
      'Closed': 'bg-gray-50',
      'Dead': 'bg-gray-50'
    };
    return colors[stage] || 'bg-gray-50';
  };

  if (loading) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#fafafa' }}>
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="h-screen flex flex-col" style={{ backgroundColor: '#fafafa' }}>
        {/* Top Navigation */}
        <div className="bg-white border-b border-slate-100 px-8 py-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl text-slate-900" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 700 }}>Pipeline</h1>
            
            <div className="flex items-center gap-4">
              {/* Search Bar */}
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search leads..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-64 px-4 py-2 pl-10 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-indigo-500 transition-colors bg-white"
                  style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 400 }}
                />
                <svg className="w-4 h-4 absolute left-3 top-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>

              {/* Stage Filter (only show in list view) */}
              {viewMode === 'list' && (
                <select
                  value={selectedStageFilter}
                  onChange={(e) => setSelectedStageFilter(e.target.value)}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-indigo-500 transition-colors bg-white"
                  style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 500 }}
                >
                  <option value="all">All Stages</option>
                  {pipelineStages.map((stage) => (
                    <option key={stage.id} value={stage.name}>{stage.displayName}</option>
                  ))}
                </select>
              )}

              {/* View Toggle */}
              <div className="flex rounded-lg border border-slate-200 overflow-hidden">
                <button
                  onClick={() => setViewMode('kanban')}
                  className={`px-5 py-2 text-sm transition-all ${
                    viewMode === 'kanban'
                      ? 'bg-primary text-white'
                      : 'bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                  style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 500 }}
                >
                  Kanban
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`px-5 py-2 text-sm transition-all border-l border-slate-200 ${
                    viewMode === 'list'
                      ? 'bg-primary text-white'
                      : 'bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                  style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 500 }}
                >
                  List
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Kanban Board */}
        {viewMode === 'kanban' && (
          <div className="flex-1 overflow-x-auto overflow-y-hidden p-6 pipeline-scrollbar">
            <div className="flex gap-4 h-full min-w-max">
              {pipelineStages.map((stage) => {
                const stageLeads = getLeadsByStage(stage.name);
                return (
                  <div
                    key={stage.id}
                    className="flex flex-col w-80 bg-white rounded-xl border border-slate-100 border-l-4 border-l-slate-200"
                    onDragOver={handleDragOver}
                    onDrop={() => handleDrop(stage.name)}
                  >
                    {/* Column Header */}
                    <div className="px-4 py-4 border-b border-slate-100">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <h3 className="text-slate-900 text-xs uppercase tracking-wider" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 600 }}>
                            {stage.displayName}
                          </h3>
                          {stageTeamMembers[stage.name] && stageTeamMembers[stage.name].length > 0 && (
                            <div className="relative">
                              <button
                                onClick={() => setShowTeamPopover(showTeamPopover === stage.name ? null : stage.name)}
                                className="p-1 hover:bg-slate-100 rounded transition-colors"
                                title="View team members"
                              >
                                <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                                </svg>
                              </button>
                              
                              {showTeamPopover === stage.name && (
                                <>
                                  <div 
                                    className="fixed inset-0 z-10" 
                                    onClick={() => setShowTeamPopover(null)}
                                  />
                                  <div className="absolute left-0 top-8 z-20 w-64 bg-white rounded-lg shadow-xl border border-slate-200 p-3">
                                    <div className="text-xs font-semibold text-slate-700 mb-2 uppercase tracking-wide">
                                      Team Members
                                    </div>
                                    <div className="space-y-2">
                                      {stageTeamMembers[stage.name].map((member: any) => (
                                        <div key={member.id} className="flex items-center justify-between p-2 hover:bg-slate-50 rounded">
                                          <div className="flex-1">
                                            <div className="text-sm font-medium text-slate-900">{member.name}</div>
                                            <div className="text-xs text-slate-500">{member.positionTitle}</div>
                                          </div>
                                          <button
                                            onClick={() => toggleMemberAvailability(member.id, member.name, member.isAvailable ?? true)}
                                            disabled={loadingTeam}
                                            className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                                              (member.isAvailable ?? true)
                                                ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                                                : 'bg-orange-100 text-orange-700 hover:bg-orange-200'
                                            } ${loadingTeam ? 'opacity-50 cursor-not-allowed' : ''}`}
                                          >
                                            {(member.isAvailable ?? true) ? '✓' : '✗'}
                                          </button>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                        <span className="text-xs text-slate-600 bg-slate-50 px-2.5 py-1 rounded-md" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 600 }}>
                          {stageLeads.length}
                        </span>
                      </div>
                    </div>

                    {/* Cards Container */}
                    <div className="flex-1 overflow-y-auto p-3 space-y-3">
                      {stageLeads.map((lead) => (
                        <div
                          key={lead.id}
                          draggable
                          onDragStart={() => handleDragStart(lead)}
                          className="group bg-white rounded-xl shadow-sm hover:shadow-md transition-all duration-200 cursor-move relative overflow-hidden border border-gray-200"
                        >
                          <div className="p-4">
                            {/* Header Section */}
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex-1">
                                <h3 className="text-sm font-semibold text-gray-900 mb-1">
                                  {lead.homeownerFirst} {lead.homeownerLast}
                                </h3>
                                <div className="flex items-center gap-2 text-xs text-gray-500">
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                  </svg>
                                  <span>{lead.phone}</span>
                                </div>
                              </div>
                              
                              {/* Badges */}
                              <div className="flex items-center gap-2">
                                {/* Quality Badge */}
                                {lead.taskQualityIndicator && lead.taskQualityStage === lead.pipelineStage && (
                                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <circle 
                                      cx="12" 
                                      cy="12" 
                                      r="10" 
                                      fill={
                                        lead.taskQualityIndicator === 'green' ? '#10b981' :
                                        lead.taskQualityIndicator === 'orange' ? '#f59e0b' :
                                        lead.taskQualityIndicator === 'red' ? '#ef4444' : '#6b7280'
                                      }
                                    />
                                  </svg>
                                )}
                                
                                {/* Completion Badge */}
                                {lead.stageCompletion?.isComplete && (
                                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <circle cx="12" cy="12" r="10" fill="#10B981"/>
                                    <path d="M8 12L11 15L16 9" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                  </svg>
                                )}
                              </div>
                            </div>

                            {/* Address Section */}
                            <div className="mb-3 p-2 bg-gray-50 rounded-lg">
                              <div className="flex items-start gap-2">
                                <svg className="w-3.5 h-3.5 text-gray-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                                <p className="text-xs text-gray-600 line-clamp-2 leading-relaxed">
                                  {lead.addressText}
                                </p>
                              </div>
                            </div>

                            {/* Info Row */}
                            <div className="flex items-center justify-between mb-3 text-xs">
                              <div className="flex items-center gap-1 text-gray-500">
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                <span>{new Date(lead.lastUpdated).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                              </div>
                              
                              {lead.clientNotes && lead.clientNotes.length > 0 && (
                                <div className="flex items-center gap-1 text-primary font-medium">
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                                  </svg>
                                  <span>{lead.clientNotes.length}</span>
                                </div>
                              )}
                            </div>

                            {/* Task Progress */}
                            {lead.stageCompletion && (
                              <div className="mb-3">
                                <div className="flex items-center justify-between text-xs mb-1">
                                  <span className="text-gray-600 font-medium">Tasks</span>
                                  <span className="text-gray-500">
                                    {lead.stageCompletion.completedCount}/{lead.stageCompletion.totalCount}
                                  </span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                                  <div 
                                    className="h-full rounded-full transition-all duration-300"
                                    style={{
                                      width: `${(lead.stageCompletion.completedCount / lead.stageCompletion.totalCount) * 100}%`,
                                      backgroundColor: lead.stageCompletion.isComplete ? '#10b981' : '#0891b2'
                                    }}
                                  />
                                </div>
                              </div>
                            )}

                            {/* Action Buttons */}
                            <div className="flex gap-2">
                              <button
                                onClick={() => navigate(`/client/lead/${lead.id}`)}
                                className="flex-1 px-3 py-2 bg-primary text-white text-xs font-medium rounded-lg bg-primary-hover transition-all duration-200 flex items-center justify-center gap-1.5"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                                View
                              </button>
                              
                              {lead.stageCompletion?.isComplete && (
                                <button
                                  onClick={(e) => moveToNextStage(lead, e)}
                                  className="px-3 py-2 bg-emerald-500 text-white text-xs font-medium rounded-lg hover:bg-emerald-600 transition-all duration-200 flex items-center justify-center gap-1"
                                  title="Move to next stage"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                  </svg>
                                </button>
                              )}
                            </div>

                            {/* Assigned Agent */}
                            {lead.assignedAgent && (
                              <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-xs font-semibold">
                                  {lead.assignedAgent.charAt(0).toUpperCase()}
                                </div>
                                <span className="text-xs text-gray-600">{lead.assignedAgent}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}

                      {stageLeads.length === 0 && (
                        <div className="text-center py-12">
                          <svg className="w-12 h-12 mx-auto text-gray-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                          </svg>
                          <p className="text-sm text-gray-400 font-medium">No leads in this stage</p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* List View */}
        {viewMode === 'list' && (
          <div className="flex-1 overflow-auto p-6" style={{ backgroundColor: '#fafafa' }}>
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
                      Stage
                    </th>
                    <th className="px-6 py-4 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Last Updated
                    </th>
                    <th className="px-6 py-4 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {leads
                    .filter(lead => {
                      // Filter out Closed and Dead leads (system stages)
                      if (lead.pipelineStage === 'Closed' || lead.pipelineStage === 'Dead') {
                        return false;
                      }
                      
                      // Search filter
                      const matchesSearch = searchQuery === '' ||
                        lead.homeownerFirst.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        lead.homeownerLast.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        lead.phone.includes(searchQuery) ||
                        lead.addressText.toLowerCase().includes(searchQuery.toLowerCase());
                      
                      // Stage filter
                      const matchesStage = selectedStageFilter === 'all' || 
                        (lead.pipelineStage || 'Delivered') === selectedStageFilter;
                      
                      return matchesSearch && matchesStage;
                    })
                    .map((lead) => (
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
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <select
                            value={lead.pipelineStage || 'Attempting Contact'}
                            onChange={(e) => handleStageChange(lead.id, e.target.value as PipelineStage)}
                            className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary500 focus:border-transparent bg-white text-gray-700"
                          >
                            {pipelineStages.map((stage) => (
                              <option key={stage.id} value={stage.name}>{stage.displayName}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-500">
                          {new Date(lead.lastUpdated).toLocaleDateString()}
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
                      </tr>
                    ))}
                </tbody>
              </table>

              {leads.filter(lead => {
                if (lead.pipelineStage === 'Closed' || lead.pipelineStage === 'Dead') {
                  return false;
                }
                const matchesSearch = searchQuery === '' ||
                  lead.homeownerFirst.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  lead.homeownerLast.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  lead.phone.includes(searchQuery) ||
                  lead.addressText.toLowerCase().includes(searchQuery.toLowerCase());
                const matchesStage = selectedStageFilter === 'all' || 
                  (lead.pipelineStage || 'Delivered') === selectedStageFilter;
                return matchesSearch && matchesStage;
              }).length === 0 && (
                <div className="text-center py-12 text-gray-500">
                  <p className="text-lg font-medium">No leads found</p>
                  <p className="text-sm mt-2">Try adjusting your filters</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Notes Modal */}
        {showNotesModal && selectedLead && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white max-w-2xl w-full overflow-hidden rounded-xl border border-slate-100 shadow-2xl">
              {/* Header */}
              <div className="bg-white px-8 py-6 border-b border-slate-100">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-xl text-slate-900" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 600 }}>
                      {selectedLead.homeownerFirst} {selectedLead.homeownerLast}
                    </h3>
                    <p className="text-sm text-slate-500 mt-1" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 400 }}>{selectedLead.addressText}</p>
                    <p className="text-sm text-slate-500" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 400 }}>{selectedLead.phone}</p>
                  </div>
                  <button
                    onClick={closeNotesModal}
                    className="text-slate-400 hover:text-slate-600 text-2xl leading-none transition-colors"
                  >
                    ×
                  </button>
                </div>
              </div>

              {/* Body */}
              <div className="p-8 max-h-[60vh] overflow-y-auto" style={{ backgroundColor: '#f7f6f5' }}>
                <h4 className="text-xs text-slate-900 uppercase tracking-wider mb-4" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 600 }}>My Notes</h4>
                
                {/* Add New Note */}
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
                    className="mt-3 px-6 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition-colors disabled:bg-slate-300 disabled:cursor-not-allowed"
                    style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 500 }}
                  >
                    Add Note
                  </button>
                </div>

                {/* Notes List */}
                <div className="space-y-3">
                  {selectedLead.clientNotes && selectedLead.clientNotes.length > 0 ? (
                    selectedLead.clientNotes.map((note) => (
                      <div key={note.id} className="bg-white rounded-lg p-4 border border-slate-100">
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
                                className="px-4 py-1.5 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition-colors"
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
                                  className="text-indigo-600 hover:text-indigo-700 text-sm transition-colors"
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

              {/* Footer */}
              <div className="bg-white px-8 py-4 border-t border-slate-100 flex justify-end items-center">
                <button
                  onClick={closeNotesModal}
                  className="px-5 py-2 bg-slate-100 text-slate-700 text-sm rounded-lg hover:bg-slate-200 transition-colors"
                  style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 500 }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Lead Details Modal */}
        {showDetailsModal && selectedLead && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white max-w-4xl w-full overflow-hidden rounded-xl border border-slate-100 shadow-2xl max-h-[90vh] overflow-y-auto">
              {/* Header */}
              <div className="bg-white px-8 py-6 border-b border-slate-100">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-xl text-slate-900" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 600 }}>
                      {selectedLead.homeownerFirst} {selectedLead.homeownerLast}
                    </h3>
                    <p className="text-sm text-slate-500 mt-1" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 400 }}>Serial: {selectedLead.serialNumber}</p>
                  </div>
                  <button
                    onClick={() => setShowDetailsModal(false)}
                    className="text-slate-400 hover:text-slate-600 text-2xl leading-none transition-colors"
                  >
                    ×
                  </button>
                </div>
              </div>

              {/* Body */}
              <div className="p-8" style={{ backgroundColor: '#f7f6f5' }}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                          // Find the field definition from template to get the label
                          const fieldDef = selectedLeadTemplate?.fields?.find((f: any) => f.id === fieldId);
                          // Use field label, or convert fieldId to readable format if not found
                          const label = fieldDef?.label || fieldId.replace(/[_-]/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase());
                          
                          // Skip section headers and separators
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
                                className="bg-indigo-600 h-2 rounded-full transition-all" 
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
                                className="bg-indigo-600 h-2 rounded-full transition-all" 
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

                {/* Call Recording */}
                {selectedLead.callRecordingUrl && (
                  <div className="mt-4 bg-white rounded-lg p-6 border border-slate-100">
                    <h4 className="text-xs text-slate-900 uppercase tracking-wider mb-4" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 600 }}>Call Recording</h4>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => setPlayingRecording(selectedLead.callRecordingUrl!)}
                        className="flex-1 px-6 py-3 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition-colors"
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

                {/* Additional Info */}
                {selectedLead.additionalInfo && (
                  <div className="mt-4 bg-white rounded-lg p-6 border border-slate-100">
                    <h4 className="text-xs text-slate-900 uppercase tracking-wider mb-4" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 600 }}>Additional Information</h4>
                    <p className="text-sm text-slate-900 whitespace-pre-wrap" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 400 }}>{selectedLead.additionalInfo}</p>
                  </div>
                )}

                {/* Schedule Section */}
                <div className="mt-4 bg-white rounded-lg p-6 border border-slate-100">
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="text-xs text-slate-900 uppercase tracking-wider" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 600 }}>Schedules</h4>
                    <button
                      onClick={() => setShowScheduleForm(!showScheduleForm)}
                      className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition-colors"
                      style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 500 }}
                    >
                      {showScheduleForm ? 'Cancel' : '+ Schedule'}
                    </button>
                  </div>

                  {/* Schedule Form */}
                  {showScheduleForm && (
                    <div className="mb-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                          <label className="block text-xs text-slate-700 mb-2" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 500 }}>Date</label>
                          <input
                            type="date"
                            value={scheduleDate}
                            onChange={(e) => setScheduleDate(e.target.value)}
                            min={new Date().toISOString().split('T')[0]}
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-indigo-500"
                            style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 400 }}
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-slate-700 mb-2" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 500 }}>Time</label>
                          <input
                            type="time"
                            value={scheduleTime}
                            onChange={(e) => setScheduleTime(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-indigo-500"
                            style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 400 }}
                          />
                        </div>
                      </div>
                      <div className="mb-4">
                        <label className="block text-xs text-slate-700 mb-2" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 500 }}>Type</label>
                        <select
                          value={scheduleType}
                          onChange={(e) => setScheduleType(e.target.value as 'CALL' | 'APPOINTMENT')}
                          className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-indigo-500"
                          style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 400 }}
                        >
                          <option value="CALL">Call</option>
                          <option value="APPOINTMENT">Appointment</option>
                        </select>
                      </div>
                      <div className="mb-4">
                        <label className="block text-xs text-slate-700 mb-2" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 500 }}>Notes (Optional)</label>
                        <textarea
                          value={scheduleNotes}
                          onChange={(e) => setScheduleNotes(e.target.value)}
                          placeholder="Add notes about this schedule..."
                          className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-indigo-500"
                          style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 400 }}
                          rows={2}
                        />
                      </div>
                      <button
                        onClick={createSchedule}
                        className="w-full px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors"
                        style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 500 }}
                      >
                        Create Schedule
                      </button>
                    </div>
                  )}

                  {/* Schedules List */}
                  <div className="space-y-4">
                    {schedules.length > 0 ? (
                      schedules.map((schedule) => (
                        <div key={schedule.id} className="bg-white rounded-lg p-4 border border-slate-200">
                          <div className="flex justify-between items-start mb-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-3">
                                <span className="text-sm text-slate-900" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 600 }}>
                                  {schedule.type === 'CALL' ? '📞 Call' : '📅 Appointment'}
                                </span>
                                <span className={`text-xs px-2.5 py-1 rounded-full ${
                                  schedule.status === 'SCHEDULED' ? 'bg-primary-light text-primary' :
                                  schedule.status === 'COMPLETED' ? 'bg-green-100 text-green-700' :
                                  schedule.status === 'CANCELLED' ? 'bg-red-100 text-red-700' :
                                  'bg-yellow-100 text-yellow-700'
                                }`} style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 500 }}>
                                  {schedule.status}
                                </span>
                              </div>
                              <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                  <label className="text-xs text-slate-500 uppercase tracking-wide" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 500 }}>Date:</label>
                                  <span className="text-sm text-slate-900" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 500 }}>
                                    {new Date(schedule.scheduledDate).toLocaleDateString('en-US', { 
                                      month: 'short', 
                                      day: 'numeric', 
                                      year: 'numeric' 
                                    })}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <label className="text-xs text-slate-500 uppercase tracking-wide" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 500 }}>Time:</label>
                                  <span className="text-sm text-slate-900" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 500 }}>
                                    {new Date(schedule.scheduledDate).toLocaleTimeString('en-US', { 
                                      hour: 'numeric', 
                                      minute: '2-digit',
                                      hour12: true 
                                    })}
                                  </span>
                                </div>
                              </div>
                              {schedule.notes && (
                                <div className="mt-3 pt-3 border-t border-slate-100">
                                  <label className="text-xs text-slate-500 uppercase tracking-wide" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 500 }}>Notes</label>
                                  <p className="text-sm text-slate-900 mt-1" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 400 }}>
                                    {schedule.notes}
                                  </p>
                                </div>
                              )}
                            </div>
                            <button
                              onClick={() => deleteSchedule(schedule.id)}
                              className="text-slate-400 hover:text-red-600 transition-colors text-xl leading-none"
                            >
                              ×
                            </button>
                          </div>
                          {schedule.status === 'SCHEDULED' && (
                            <>
                              {reschedulingId === schedule.id ? (
                                <div className="mt-3 pt-3 border-t border-slate-100">
                                  <label className="block text-xs text-slate-500 uppercase tracking-wide mb-2" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 500 }}>Reschedule To</label>
                                  <div className="grid grid-cols-2 gap-3 mb-3">
                                    <div>
                                      <input
                                        type="date"
                                        value={rescheduleDate}
                                        onChange={(e) => setRescheduleDate(e.target.value)}
                                        min={new Date().toISOString().split('T')[0]}
                                        className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-indigo-500"
                                        style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 400 }}
                                      />
                                    </div>
                                    <div>
                                      <input
                                        type="time"
                                        value={rescheduleTime}
                                        onChange={(e) => setRescheduleTime(e.target.value)}
                                        className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-indigo-500"
                                        style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 400 }}
                                      />
                                    </div>
                                  </div>
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => confirmReschedule(schedule.id)}
                                      className="flex-1 px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition-colors"
                                      style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 500 }}
                                    >
                                      Confirm Reschedule
                                    </button>
                                    <button
                                      onClick={() => {
                                        setReschedulingId(null);
                                        setRescheduleDate('');
                                        setRescheduleTime('');
                                      }}
                                      className="flex-1 px-4 py-2 bg-white text-slate-700 text-sm rounded-lg hover:bg-slate-50 transition-colors border border-slate-200"
                                      style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 500 }}
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex gap-2 mt-3 pt-3 border-t border-slate-100">
                                  <button
                                    onClick={() => updateScheduleStatus(schedule.id, 'COMPLETED')}
                                    className="flex-1 px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors"
                                    style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 500 }}
                                  >
                                    Complete
                                  </button>
                                  <button
                                    onClick={() => startReschedule(schedule)}
                                    className="flex-1 px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition-colors"
                                    style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 500 }}
                                  >
                                    Reschedule
                                  </button>
                                  <button
                                    onClick={() => updateScheduleStatus(schedule.id, 'CANCELLED')}
                                    className="flex-1 px-4 py-2 bg-white text-slate-700 text-sm rounded-lg hover:bg-slate-50 transition-colors border border-slate-200"
                                    style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 500 }}
                                  >
                                    Cancel
                                  </button>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8">
                        <p className="text-sm text-slate-500" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 400 }}>
                          No schedules yet. Click "+ Schedule" to create one.
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Client Notes Section */}
                <div className="mt-4 bg-white rounded-lg p-6 border border-slate-100">
                  <h4 className="text-xs text-slate-900 uppercase tracking-wider mb-4" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 600 }}>My Notes</h4>
                  
                  {/* Add New Note */}
                  <div className="mb-6">
                    <textarea
                      value={newNote}
                      onChange={(e) => setNewNote(e.target.value)}
                      placeholder="Add a note about this lead..."
                      className="w-full px-4 py-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-indigo-500 transition-colors bg-white"
                      style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 400 }}
                      rows={3}
                    />
                    <input
                      type="url"
                      value={newNoteRecordingUrl}
                      onChange={(e) => setNewNoteRecordingUrl(e.target.value)}
                      placeholder="Recording URL (optional) - e.g., Dropbox, Google Drive link"
                      className="w-full mt-3 px-4 py-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-indigo-500 transition-colors bg-white"
                      style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 400 }}
                    />
                    <button
                      onClick={addNote}
                      disabled={!newNote.trim()}
                      className="mt-3 px-6 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition-colors disabled:bg-slate-300 disabled:cursor-not-allowed"
                      style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 500 }}
                    >
                      Add Note
                    </button>
                  </div>

                  {/* Notes List */}
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
                              <input
                                type="url"
                                value={editingNoteRecordingUrl}
                                onChange={(e) => setEditingNoteRecordingUrl(e.target.value)}
                                placeholder="Recording URL (optional)"
                                className="w-full mt-2 px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-indigo-500 bg-white"
                                style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 400 }}
                              />
                              <div className="mt-2 flex gap-2">
                                <button
                                  onClick={() => updateNote(note.id)}
                                  className="px-4 py-1.5 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition-colors"
                                  style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 500 }}
                                >
                                  Save
                                </button>
                                <button
                                  onClick={() => {
                                    setEditingNoteId(null);
                                    setEditingNoteContent('');
                                    setEditingNoteRecordingUrl('');
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
                              {note.recordingUrl && (
                                <div className="mt-3 pt-3 border-t border-slate-200">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-slate-500 uppercase tracking-wide" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 500 }}>Recording</span>
                                    <a
                                      href={note.recordingUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-sm text-indigo-600 hover:text-indigo-700 hover:underline transition-colors"
                                      style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 500 }}
                                    >
                                      Listen / Download
                                    </a>
                                  </div>
                                </div>
                              )}
                              <div className="mt-3 flex items-center justify-between">
                                <span className="text-xs text-slate-400" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 400 }}>
                                  {new Date(note.createdAt).toLocaleString()}
                                </span>
                                <div className="flex gap-3">
                                  <button
                                    onClick={() => {
                                      setEditingNoteId(note.id);
                                      setEditingNoteContent(note.content);
                                      setEditingNoteRecordingUrl(note.recordingUrl || '');
                                    }}
                                    className="text-indigo-600 hover:text-indigo-700 text-sm transition-colors"
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

              {/* Footer */}
              <div className="bg-white px-8 py-4 border-t border-slate-100 flex justify-between items-center">
                <div className="flex gap-2">
                  <button
                    onClick={() => markLeadAs('Closed')}
                    className="px-5 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors"
                    style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 500 }}
                  >
                    Mark as Closed
                  </button>
                  <button
                    onClick={() => markLeadAs('Dead')}
                    className="px-5 py-2 bg-white text-slate-700 text-sm rounded-lg hover:bg-slate-50 transition-colors border border-slate-200"
                    style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 500 }}
                  >
                    Mark as Dead
                  </button>
                </div>
                <button
                  onClick={() => setShowDetailsModal(false)}
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

        {/* Confirmation Modal */}
        {showConfirmModal && confirmAction && (
          <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
            <div className="bg-white max-w-md w-full rounded-xl border border-slate-100 shadow-2xl">
              {/* Header */}
              <div className="bg-white px-6 py-4 border-b border-slate-100">
                <h3 className="text-lg text-slate-900" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 600 }}>Confirm Action</h3>
              </div>

              {/* Body */}
              <div className="p-6" style={{ backgroundColor: '#f7f6f5' }}>
                <p className="text-slate-700 text-sm" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 400 }}>
                  {confirmAction === 'Closed' 
                    ? 'Mark this lead as Closed? It will be moved to the Closed Leads page.'
                    : 'Mark this lead as Dead? It will be moved to the Dead Leads page.'
                  }
                </p>
              </div>

              {/* Footer */}
              <div className="bg-white px-6 py-4 border-t border-slate-100 flex justify-end gap-2">
                <button
                  onClick={cancelMarkLead}
                  className="px-6 py-2 bg-slate-100 text-slate-700 text-sm rounded-lg hover:bg-slate-200 transition-colors"
                  style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 500 }}
                >
                  Cancel
                </button>
                <button
                  onClick={confirmMarkLead}
                  className="px-6 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition-colors"
                  style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 500 }}
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default ClientPipeline;




