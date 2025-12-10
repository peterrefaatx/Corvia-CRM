import React, { useState, useEffect } from 'react';
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

  useEffect(() => {
    loadPipelineStages();
    loadLeads();
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
      const mappedLeads = response.data
        .filter((lead: any) => lead.clientReviewed === true)
        .map((lead: any) => ({
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
          clientNotes: lead.clientNotes || []
        }));
      setLeads(mappedLeads);
    } catch (error) {
      showToast('Failed to load leads', 'error');
    } finally {
      setLoading(false);
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

  const handleStageChange = async (leadId: string, newStage: PipelineStage) => {
    try {
      await api.patch(`/client/leads/${leadId}/pipeline-stage`, {
        stage: newStage
      });
      
      setLeads(leads.map(lead => 
        lead.id === leadId 
          ? { ...lead, pipelineStage: newStage, lastUpdated: new Date().toISOString() }
          : lead
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

  const getTemperatureColor = (temp: string) => {
    const colors = {
      Hot: 'bg-red-600',
      Warm: 'bg-yellow-600',
      Cold: 'bg-blue-600',
      NoAskingPrice: 'bg-purple-600'
    };
    return colors[temp as keyof typeof colors] || 'bg-gray-600';
  };

  const getStageColor = (stage: PipelineStage) => {
    const colors = {
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
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin h-12 w-12 border-b-2 border-cyan-600"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="h-screen flex flex-col" style={{ backgroundColor: '#f7f6f5' }}>
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
                  className="w-64 px-4 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-indigo-500 transition-colors bg-white"
                  style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 400 }}
                />
                <span className="absolute right-3 top-2.5 text-slate-400">🔍</span>
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
                      ? 'bg-indigo-600 text-white'
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
                      ? 'bg-indigo-600 text-white'
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
                        <h3 className="text-slate-900 text-xs uppercase tracking-wider" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 600 }}>
                          {stage.displayName}
                        </h3>
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
                          className="bg-slate-50 rounded-lg border border-slate-100 p-4 hover:border-indigo-200 hover:shadow-sm transition-all cursor-move"
                        >
                          {/* Lead Name */}
                          <div className="text-slate-900 text-sm mb-2" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 600 }}>
                            {lead.homeownerFirst} {lead.homeownerLast}
                          </div>

                          {/* Address */}
                          <div className="text-xs text-slate-500 mb-2 line-clamp-2" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 400 }}>
                            {lead.addressText}
                          </div>

                          {/* Phone */}
                          <div className="text-xs text-slate-700 mb-3" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 500 }}>
                            {lead.phone}
                          </div>

                          {/* Date & Notes */}
                          <div className="flex items-center justify-between mb-3 pb-3 border-b border-slate-200">
                            <span className="text-xs text-slate-400" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 400 }}>
                              {new Date(lead.lastUpdated).toLocaleDateString()}
                            </span>
                            {lead.clientNotes && lead.clientNotes.length > 0 && (
                              <span className="text-xs text-indigo-600" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 500 }}>
                                📝 {lead.clientNotes.length}
                              </span>
                            )}
                          </div>

                          {/* Action Buttons */}
                          <div className="flex gap-2">
                            <button
                              onClick={() => openDetailsModal(lead.id)}
                              className="flex-1 px-3 py-2 bg-indigo-600 text-white text-xs rounded-lg hover:bg-indigo-700 transition-colors"
                              style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 500 }}
                            >
                              Details
                            </button>
                            <button
                              onClick={(e) => openNotesModal(lead, e)}
                              className="flex-1 px-3 py-2 bg-white text-slate-700 text-xs rounded-lg hover:bg-slate-50 transition-colors border border-slate-200"
                              style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 500 }}
                            >
                              Notes
                            </button>
                          </div>

                          {/* Assigned Agent */}
                          {lead.assignedAgent && (
                            <div className="mt-3 pt-3 border-t border-slate-200">
                              <span className="text-xs text-slate-500" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 400 }}>
                                Agent: <span className="text-slate-700" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 500 }}>{lead.assignedAgent}</span>
                              </span>
                            </div>
                          )}
                        </div>
                      ))}

                      {stageLeads.length === 0 && (
                        <div className="text-center py-12 text-slate-400 text-xs" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 400 }}>
                          No leads
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
          <div className="flex-1 overflow-auto p-6">
            <div className="bg-white rounded-xl border border-slate-100 border-l-4 border-l-slate-200">
              <table className="min-w-full divide-y divide-slate-100">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs text-slate-900 uppercase tracking-wider" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 600 }}>
                      Lead
                    </th>
                    <th className="px-6 py-4 text-left text-xs text-slate-900 uppercase tracking-wider" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 600 }}>
                      Address
                    </th>
                    <th className="px-6 py-4 text-left text-xs text-slate-900 uppercase tracking-wider" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 600 }}>
                      Phone
                    </th>
                    <th className="px-6 py-4 text-left text-xs text-slate-900 uppercase tracking-wider" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 600 }}>
                      Stage
                    </th>
                    <th className="px-6 py-4 text-left text-xs text-slate-900 uppercase tracking-wider" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 600 }}>
                      Last Updated
                    </th>
                    <th className="px-6 py-4 text-left text-xs text-slate-900 uppercase tracking-wider" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 600 }}>
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-100">
                  {leads
                    .filter(lead => {
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
                      <tr key={lead.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-slate-900 text-sm" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 600 }}>
                            {lead.homeownerFirst} {lead.homeownerLast}
                          </div>
                          <div className="text-xs text-slate-500" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 400 }}>{lead.serialNumber}</div>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 400 }}>
                          {lead.addressText}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 500 }}>
                          {lead.phone}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <select
                            value={lead.pipelineStage || 'Attempting Contact'}
                            onChange={(e) => handleStageChange(lead.id, e.target.value as PipelineStage)}
                            className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-indigo-500 transition-colors bg-white text-slate-700"
                            style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 500 }}
                          >
                            {pipelineStages.map((stage) => (
                              <option key={stage.id} value={stage.name}>{stage.displayName}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 400 }}>
                          {new Date(lead.lastUpdated).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <button
                            onClick={() => openDetailsModal(lead.id)}
                            className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition-colors"
                            style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 500 }}
                          >
                            View Details
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
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
                          const fieldDef = selectedLeadTemplate.fields?.find((f: any) => f.id === fieldId);
                          const label = fieldDef?.label || fieldId;
                          
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
                                  schedule.status === 'SCHEDULED' ? 'bg-blue-100 text-blue-700' :
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
