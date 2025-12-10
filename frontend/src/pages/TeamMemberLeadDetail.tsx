import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout/Layout';
import { useToast } from '../contexts/ToastContext';
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

const TeamMemberLeadDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showError, showSuccess } = useToast();
  const [lead, setLead] = useState<Lead | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Note form state
  const [showNoteForm, setShowNoteForm] = useState(false);
  const [newNote, setNewNote] = useState('');
  
  // Schedule form state
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [scheduleType, setScheduleType] = useState<'CALL' | 'APPOINTMENT'>('CALL');
  const [scheduleNotes, setScheduleNotes] = useState('');

  usePageTitle(lead ? `${lead.homeownerFirst} ${lead.homeownerLast}` : 'Lead Details');

  useEffect(() => {
    loadLeadData();
  }, [id]);

  const loadLeadData = async () => {
    try {
      setLoading(true);
      const [leadRes, notesRes, schedulesRes] = await Promise.all([
        api.get(`/team-member/leads/${id}`),
        api.get(`/team-member/leads/${id}/notes`),
        api.get(`/team-member/leads/${id}/schedules`)
      ]);

      setLead(leadRes.data);
      setNotes(notesRes.data || []);
      setSchedules(schedulesRes.data || []);
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
      await api.post(`/team-member/leads/${id}/notes`, { content: newNote });
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
      await api.post(`/team-member/leads/${id}/schedules`, {
        scheduledDate,
        type: scheduleType,
        notes: scheduleNotes
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
            onClick={() => navigate('/team-member/dashboard')}
            className="mt-4 text-cyan-600 hover:text-cyan-700"
          >
            Back to Dashboard
          </button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-screen" style={{ backgroundColor: '#fafafa' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="mb-8">
            <button
              onClick={() => navigate('/team-member/dashboard')}
              className="text-cyan-600 hover:text-cyan-700 mb-4 flex items-center text-sm font-medium"
            >
              ← Back to Dashboard
            </button>
            <div className="bg-white rounded-2xl p-6 border border-gray-100">
              <h1 className="text-2xl font-semibold text-gray-900">
                {lead.homeownerFirst} {lead.homeownerLast}
              </h1>
              <p className="text-gray-500 mt-1 text-sm">Serial: {lead.serialNumber}</p>
            </div>
          </div>

          {/* Main Content - Two Column Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column - Lead Information */}
            <div className="lg:col-span-2 space-y-6">
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
                    <div>
                      <dt className="text-sm font-medium text-gray-500">Pipeline Stage</dt>
                      <dd className="text-sm text-gray-900 mt-1">
                        {lead.clientReviewed ? lead.pipelineStage : 'Under Review'}
                      </dd>
                    </div>
                    {lead.campaign && (
                      <div>
                        <dt className="text-sm font-medium text-gray-500">Campaign</dt>
                        <dd className="text-sm text-gray-900 mt-1">{lead.campaign.name}</dd>
                      </div>
                    )}
                  </dl>
                </div>
              </div>

              {/* Property Details or Custom Fields */}
              {(!lead.customFields || Object.keys(lead.customFields).length === 0) ? (
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
              ) : (
                <div className="bg-white rounded-2xl p-6 border border-gray-100">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Lead Information</h3>
                  <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {(() => {
                      const fieldMap = new Map();
                      if (lead.campaign?.formTemplate?.fields) {
                        lead.campaign.formTemplate.fields.forEach((field: any) => {
                          fieldMap.set(field.id, field.label);
                        });
                      }

                      const standardFields = ['homeownerFirst', 'homeownerLast', 'phone', 'email', 'addressText'];
                      const customFieldEntries = Object.entries(lead.customFields!).filter(([key]) => 
                        !standardFields.includes(key)
                      );

                      let fieldCounter = 1;
                      return customFieldEntries.map(([key, value]) => {
                        let label = fieldMap.get(key);
                        if (!label) {
                          if (/^\d+$/.test(key)) {
                            label = `Custom Field ${fieldCounter++}`;
                          } else {
                            label = key.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase());
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
              )}
            </div>

            {/* Right Column - Notes & Schedules */}
            <div className="space-y-6">
              {/* Notes */}
              <div className="bg-white rounded-2xl p-6 border border-gray-100">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Notes ({notes.length})</h3>
                  <button
                    onClick={() => setShowNoteForm(!showNoteForm)}
                    className="px-3 py-1.5 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors"
                  >
                    + Add Note
                  </button>
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
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Schedules */}
              <div className="bg-white rounded-2xl p-6 border border-gray-100">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Schedules ({schedules.length})</h3>
                  <button
                    onClick={() => setShowScheduleForm(!showScheduleForm)}
                    className="px-3 py-1.5 bg-primary text-white text-sm font-medium rounded-lg bg-primary-hover transition-colors"
                  >
                    + Schedule
                  </button>
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
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900">
                              {schedule.type === 'CALL' ? '📞 Call' : '📅 Appointment'}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                              {new Date(schedule.scheduledDate).toLocaleString()}
                            </p>
                            {schedule.notes && (
                              <p className="text-xs text-gray-600 mt-2">{schedule.notes}</p>
                            )}
                          </div>
                          <span className={`px-2 py-1 text-xs rounded-full font-medium ${
                            schedule.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' :
                            schedule.status === 'CANCELLED' ? 'bg-rose-100 text-rose-700' :
                            'bg-primary-light text-primary'
                          }`}>
                            {schedule.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default TeamMemberLeadDetail;




