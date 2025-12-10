import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout/Layout';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import { usePageTitle } from '../hooks/usePageTitle';
import { 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Star,
  TrendingUp,
  ListTodo
} from 'lucide-react';

interface Task {
  id: string;
  title: string;
  description: string;
  dueDate: string;
  status: 'pending' | 'completed' | 'archived';
  completionNote?: string;
  completedAt?: string;
  lead: {
    id: string;
    serialNumber: string;
    homeownerFirst: string;
    homeownerLast: string;
    addressText: string;
    pipelineStage: string;
    phone: string;
  };
}

interface Stats {
  totalTasks: number;
  pendingTasks: number;
  completedToday: number;
  overdueTasks: number;
}

interface Lead {
  id: string;
  serialNumber: string;
  homeownerFirst: string;
  homeownerLast: string;
  phone: string;
  addressText: string;
  marketValue: number;
  askingPrice: number | null;
  pipelineStage: string;
  starred: boolean;
  clientReviewed: boolean;
  callRecordingUrl: string | null;
  campaign: {
    id: string;
    name: string;
    formTemplateId: string | null;
  };
  customFields: any;
}

interface Schedule {
  id: string;
  leadId: string;
  scheduledDate: string;
  type: 'CALL' | 'APPOINTMENT';
  status: 'SCHEDULED' | 'COMPLETED' | 'CANCELLED' | 'RESCHEDULED' | 'MISSED';
  notes?: string;
  lead: {
    id: string;
    serialNumber: string;
    homeownerFirst: string;
    homeownerLast: string;
    phone: string;
    addressText: string;
    pipelineStage: string;
  };
}

const TeamMemberDashboard: React.FC = () => {
  usePageTitle('My Dashboard');
  const navigate = useNavigate();
  const { showSuccess, showError } = useToast();
  const { user, refreshUser } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [allLeads, setAllLeads] = useState<Lead[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalTasks: 0,
    pendingTasks: 0,
    completedToday: 0,
    overdueTasks: 0
  });
  const [loading, setLoading] = useState(true);
  const [loadingLeads, setLoadingLeads] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('pending');
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [completionNote, setCompletionNote] = useState('');
  const [qualityRating, setQualityRating] = useState<'green' | 'orange' | 'red' | null>(null);
  const [playingRecording, setPlayingRecording] = useState<string | null>(null);
  const [showStarredOnly, setShowStarredOnly] = useState(false);
  
  // Check if user has view_all permission
  const canViewAllLeads = user?.permissions?.leads?.view_all === true;

  useEffect(() => {
    refreshUser(); // Refresh permissions on page load
  }, []);

  useEffect(() => {
    loadDashboardData();
    if (canViewAllLeads) {
      loadAllLeads();
    }
  }, [filterStatus, canViewAllLeads]);

  const loadAllLeads = async () => {
    try {
      setLoadingLeads(true);
      const response = await api.get('/auth/team-member/all-leads');
      setAllLeads(response.data);
    } catch (error: any) {
      console.error('Failed to load all leads:', error);
      if (error.response?.status !== 403) {
        showError('Failed to load qualified leads');
      }
    } finally {
      setLoadingLeads(false);
    }
  };

  const toggleStar = async (leadId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    try {
      const response = await api.patch(`/team-member/leads/${leadId}/star`, { starred: !allLeads.find(l => l.id === leadId)?.starred });
      setAllLeads(allLeads.map(lead => 
        lead.id === leadId ? { ...lead, starred: response.data.starred } : lead
      ));
    } catch (error) {
      console.error('Failed to toggle star:', error);
      showError('Failed to update favorite status');
    }
  };

  const playRecording = (recordingUrl: string) => {
    setPlayingRecording(recordingUrl);
  };

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (filterStatus !== 'all') {
        params.status = filterStatus;
      }
      
      const [tasksResponse, schedulesResponse] = await Promise.all([
        api.get('/team-member/tasks', { params }),
        api.get('/client/schedules')
      ]);
      
      const tasksData = tasksResponse.data;
      setTasks(tasksData);

      // Filter schedules to only show today's and upcoming
      const now = new Date();
      const todaySchedules = schedulesResponse.data.filter((s: Schedule) => {
        const scheduleDate = new Date(s.scheduledDate);
        return (s.status === 'SCHEDULED' || s.status === 'RESCHEDULED') && scheduleDate >= now;
      }).sort((a: Schedule, b: Schedule) => 
        new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime()
      ).slice(0, 5); // Show only next 5 schedules
      
      setSchedules(todaySchedules);

      // Calculate stats
      const pending = tasksData.filter((t: Task) => t.status === 'pending').length;
      const today = new Date().toDateString();
      const completedToday = tasksData.filter((t: Task) => 
        t.status === 'completed' && 
        t.completedAt && 
        new Date(t.completedAt).toDateString() === today
      ).length;
      const overdue = tasksData.filter((t: Task) => 
        t.status === 'pending' && 
        new Date(t.dueDate) < new Date()
      ).length;

      setStats({
        totalTasks: tasksData.length,
        pendingTasks: pending,
        completedToday,
        overdueTasks: overdue
      });
    } catch (error: any) {
      console.error('Failed to load dashboard:', error);
      showError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteClick = (task: Task) => {
    setSelectedTask(task);
    setCompletionNote('');
    setQualityRating(null);
    setShowCompleteModal(true);
  };

  const handleCompleteTask = async () => {
    if (!selectedTask) return;

    if (!completionNote.trim()) {
      showError('Please add a completion note');
      return;
    }

    if (!qualityRating) {
      showError('Please select a quality rating');
      return;
    }

    try {
      await api.put(`/tasks/${selectedTask.id}/complete`, {
        completionNote: completionNote.trim(),
        qualityRating: qualityRating
      });
      showSuccess('Task completed successfully');
      setShowCompleteModal(false);
      setSelectedTask(null);
      setCompletionNote('');
      setQualityRating(null);
      loadDashboardData();
    } catch (error: any) {
      console.error('Failed to complete task:', error);
      showError(error.response?.data?.error || 'Failed to complete task');
    }
  };

  const isOverdue = (dueDate: string, status: string) => {
    if (status !== 'pending') return false;
    return new Date(dueDate) < new Date();
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays === -1) return 'Yesterday';
    if (diffDays < 0) return `${Math.abs(diffDays)} days overdue`;
    if (diffDays < 7) return `In ${diffDays} days`;
    
    return date.toLocaleDateString();
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">


        {/* Name Tag Card */}
        <div className="mb-8">
          <div className="bg-white rounded-2xl p-8 border border-gray-100">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center">
              <div className="text-center">
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">
                  Team Member
                </p>
                <p className="text-2xl font-semibold text-gray-900">
                  {user?.fullName || user?.name || 'Team Member'}
                </p>
              </div>
              
              <div className="text-center border-l border-r border-gray-100">
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">
                  Position
                </p>
                <p className="text-xl font-bold bg-gradient-to-r from-blue-600 to-blue-600 bg-clip-text text-transparent">
                  {user?.positionTitle || 'Not Assigned'}
                </p>
              </div>
              
              <div className="text-center">
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">
                  Client
                </p>
                <p className="text-2xl font-semibold text-gray-900">
                  {user?.clientName || 'Not Assigned'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Cards - Premium Minimal Design */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          {/* Total Tasks */}
          <div className="bg-white rounded-2xl p-6 border border-gray-100 hover:border-gray-200 transition-all duration-200">
            <div className="flex items-start justify-between mb-4">
              <div className="p-2">
                <ListTodo className="w-5 h-5 text-gray-400" strokeWidth={1.5} />
              </div>
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total</span>
            </div>
            <div className="space-y-1">
              <p className="text-3xl font-bold text-gray-900">{stats.totalTasks}</p>
              <p className="text-sm font-medium text-gray-500">Tasks assigned</p>
            </div>
          </div>

          {/* Pending */}
          <div className="bg-white rounded-2xl p-6 border border-amber-100 hover:border-amber-200 transition-all duration-200">
            <div className="flex items-start justify-between mb-4">
              <div className="p-2">
                <Clock className="w-5 h-5 text-amber-500" strokeWidth={1.5} />
              </div>
              <span className="text-xs font-bold text-amber-600 uppercase tracking-wider">Pending</span>
            </div>
            <div className="space-y-1">
              <p className="text-3xl font-bold text-gray-900">{stats.pendingTasks}</p>
              <p className="text-sm font-medium text-gray-500">Awaiting action</p>
            </div>
          </div>

          {/* Completed Today */}
          <div className="bg-white rounded-2xl p-6 border border-emerald-100 hover:border-emerald-200 transition-all duration-200">
            <div className="flex items-start justify-between mb-4">
              <div className="p-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-500" strokeWidth={1.5} />
              </div>
              <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Today</span>
            </div>
            <div className="space-y-1">
              <p className="text-3xl font-bold text-gray-900">{stats.completedToday}</p>
              <p className="text-sm font-medium text-gray-500">Completed</p>
            </div>
          </div>

          {/* Overdue */}
          <div className="bg-white rounded-2xl p-6 border border-rose-100 hover:border-rose-200 transition-all duration-200">
            <div className="flex items-start justify-between mb-4">
              <div className="p-2">
                <AlertCircle className="w-5 h-5 text-rose-500" strokeWidth={1.5} />
              </div>
              <span className="text-xs font-bold text-rose-600 uppercase tracking-wider">Overdue</span>
            </div>
            <div className="space-y-1">
              <p className="text-3xl font-bold text-gray-900">{stats.overdueTasks}</p>
              <p className="text-sm font-medium text-gray-500">Need attention</p>
            </div>
          </div>
        </div>

        {/* Qualified Leads - Premium Design - REMOVED */}
        {false && canViewAllLeads && (() => {
          const filteredLeads = showStarredOnly 
            ? allLeads.filter(lead => lead.starred)
            : allLeads;

          return (
          <div className="mb-8 bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center">
              <div className="flex items-center space-x-3">
                <TrendingUp className="w-5 h-5 text-gray-400" strokeWidth={1.5} />
                <h2 className="text-lg font-medium text-gray-900">
                  Qualified Leads
                </h2>
                <button
                  onClick={() => setShowStarredOnly(!showStarredOnly)}
                  title={showStarredOnly ? 'Show all leads' : 'Show starred leads only'}
                  className="p-1.5 hover:bg-gray-50 rounded-lg transition-colors"
                >
                  <Star 
                    className={`w-4 h-4 ${showStarredOnly ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}`}
                    strokeWidth={1.5}
                  />
                </button>
              </div>
              <span className="text-sm text-gray-500 font-light">
                {filteredLeads.length} {filteredLeads.length === 1 ? 'lead' : 'leads'}
              </span>
            </div>

            {loadingLeads ? (
              <div className="flex items-center justify-center py-16">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-200 border-t-gray-900"></div>
              </div>
            ) : filteredLeads.length === 0 ? (
              <div className="text-center py-16 px-4">
                <TrendingUp className="w-12 h-12 text-gray-300 mx-auto mb-4" strokeWidth={1.5} />
                <p className="text-lg font-light text-gray-900 mb-2">
                  No qualified leads yet
                </p>
                <p className="text-sm text-gray-500">
                  Leads will appear here once they are qualified
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Serial</th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contact</th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Address</th>
                      <th className="px-6 py-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Market Value</th>
                      <th className="px-6 py-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Asking Price</th>
                      <th className="px-6 py-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Campaign</th>
                      <th className="px-6 py-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Recording</th>
                      <th className="px-6 py-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                      <th className="px-6 py-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Pipeline</th>
                      <th className="px-6 py-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        <Star className="w-4 h-4 mx-auto text-gray-400" strokeWidth={1.5} />
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filteredLeads.map((lead) => (
                      <tr key={lead.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-left text-gray-900 font-medium">
                          {lead.serialNumber}
                        </td>
                        <td className="px-6 py-4 text-sm text-left">
                          <div className="text-gray-900 font-medium">
                            {lead.homeownerFirst} {lead.homeownerLast}
                          </div>
                          <div className="text-gray-500 text-xs mt-0.5">
                            {lead.phone}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-left text-gray-600">
                          {lead.addressText}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-900 font-medium">
                          ${lead.marketValue.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-900 font-medium">
                          {lead.askingPrice ? `$${lead.askingPrice.toLocaleString()}` : 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-600">
                          {lead.campaign?.name || 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          {lead.callRecordingUrl ? (
                            <button 
                              onClick={() => playRecording(lead.callRecordingUrl!)}
                              className="inline-flex items-center justify-center text-red-600 hover:text-red-700 transition-colors"
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
                            onClick={() => navigate(`/team-member/leads/${lead.id}`)}
                            className="text-primary text-primary-hover text-sm font-medium transition-colors"
                          >
                            View
                          </button>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          {!lead.clientReviewed ? (
                            <button
                              onClick={async () => {
                                try {
                                  await api.patch(`/team-member/leads/${lead.id}/review`);
                                  showSuccess('Lead moved to pipeline');
                                  loadAllLeads();
                                } catch (error) {
                                  showError('Failed to move lead to pipeline');
                                }
                              }}
                              className="inline-flex items-center justify-center rounded-full border-2 border-gray-400 text-gray-400 hover:border-emerald-600 hover:text-emerald-600 transition-colors"
                              title="Add to Pipeline"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                              </svg>
                            </button>
                          ) : (
                            <span className="text-gray-400 text-sm">✓</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <button
                            onClick={(e) => toggleStar(lead.id, e)}
                            className="inline-flex items-center justify-center transition-all duration-200"
                            title={lead.starred ? 'Remove from favorites' : 'Add to favorites'}
                          >
                            <Star 
                              className={`w-5 h-5 ${
                                lead.starred 
                                  ? 'fill-amber-400 text-amber-400' 
                                  : 'text-gray-300'
                              }`}
                              strokeWidth={1.5}
                            />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          );
        })()}

        {/* Upcoming Schedules - Premium Design */}
        {schedules.length > 0 && (
          <div className="mb-8 bg-white rounded-2xl border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-medium text-gray-900">Upcoming Schedules</h2>
              <button
                onClick={() => navigate('/team-member/schedules')}
                className="text-sm font-medium text-gray-900 hover:text-gray-600 transition-colors"
              >
                View All →
              </button>
            </div>
            <div className="space-y-3">
              {schedules.map((schedule) => {
                const scheduleDate = new Date(schedule.scheduledDate);
                const isToday = scheduleDate.toDateString() === new Date().toDateString();
                
                return (
                  <div
                    key={schedule.id}
                    className={`flex items-center justify-between p-4 rounded-xl border transition-all ${
                      isToday 
                        ? 'border-amber-200 bg-amber-50/50' 
                        : 'border-gray-100 hover:border-gray-200 bg-white'
                    }`}
                  >
                    <div className="flex items-center space-x-4">
                      <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${
                        schedule.type === 'CALL' 
                          ? 'bg-primary-light' 
                          : 'bg-purple-50'
                      }`}>
                        {schedule.type === 'CALL' ? (
                          <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                          </svg>
                        ) : (
                          <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {schedule.lead.homeownerFirst} {schedule.lead.homeownerLast}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">{schedule.lead.phone}</p>
                        {schedule.notes && (
                          <p className="text-xs text-gray-600 mt-1 italic">"{schedule.notes}"</p>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-900">
                        {scheduleDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {isToday ? 'Today' : scheduleDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </p>
                      {isToday && (
                        <span className="inline-block mt-1.5 text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full font-medium">
                          Today
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Task Filters - Premium Pills */}
        <div className="mb-6 flex items-center space-x-2">
          <span className="text-sm text-gray-500 mr-2">Show:</span>
          <button
            onClick={() => setFilterStatus('all')}
            className={`px-4 py-2 text-sm font-medium rounded-full transition-all ${
              filterStatus === 'all'
                ? 'bg-gray-900 text-white shadow-sm'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            All Tasks
          </button>
          <button
            onClick={() => setFilterStatus('pending')}
            className={`px-4 py-2 text-sm font-medium rounded-full transition-all ${
              filterStatus === 'pending'
                ? 'bg-gray-900 text-white shadow-sm'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            Pending
          </button>
          <button
            onClick={() => setFilterStatus('completed')}
            className={`px-4 py-2 text-sm font-medium rounded-full transition-all ${
              filterStatus === 'completed'
                ? 'bg-gray-900 text-white shadow-sm'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            Completed
          </button>
        </div>

        {/* Tasks List - Premium Cards */}
        {tasks.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
            <ListTodo className="w-12 h-12 text-gray-300 mx-auto mb-4" strokeWidth={1.5} />
            <h3 className="text-lg font-light text-gray-900 mb-2">No Tasks</h3>
            <p className="text-sm text-gray-500">
              {filterStatus === 'all' 
                ? 'You have no tasks assigned yet'
                : `No ${filterStatus} tasks`}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {tasks.map((task) => (
              <div
                key={task.id}
                className={`bg-white rounded-2xl border transition-all hover:shadow-sm overflow-hidden ${
                  isOverdue(task.dueDate, task.status)
                    ? 'border-rose-200 bg-rose-50/30'
                    : task.status === 'completed'
                    ? 'border-emerald-200 bg-emerald-50/30'
                    : 'border-gray-100 hover:border-gray-200'
                }`}
              >
                <div className="flex items-stretch">
                  {/* Task Content */}
                  <div className="flex-1 p-6">
                    {/* Task Header */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h3 className="text-base font-medium text-gray-900 mb-1">{task.title}</h3>
                        {task.description && (
                          <p className="text-sm text-gray-600">{task.description}</p>
                        )}
                      </div>
                      {isOverdue(task.dueDate, task.status) && (
                        <span className="ml-3 inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-rose-100 text-rose-700">
                          Overdue
                        </span>
                      )}
                    </div>

                    {/* Task Meta */}
                    <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                      <div className="flex items-center">
                        <Clock className="w-4 h-4 mr-1.5" strokeWidth={1.5} />
                        <span className="font-light">{formatDate(task.dueDate)}</span>
                      </div>
                      <div className="flex items-center">
                        <span className="font-light">
                          Lead: {task.lead.homeownerFirst} {task.lead.homeownerLast}
                        </span>
                      </div>
                      <div className="flex items-center text-gray-400">
                        <span className="font-light">{task.lead.phone}</span>
                      </div>
                    </div>

                    {/* Completion Note */}
                    {task.completionNote && (
                      <div className="mt-3 p-3 bg-emerald-50 border border-emerald-100 rounded-xl">
                        <p className="text-sm text-emerald-900">
                          <span className="font-medium">Completed:</span> {task.completionNote}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Action Buttons - Full Height, No Gap, Flush Right */}
                  <div className="flex">
                    <button
                      onClick={() => navigate(`/team-member/leads/${task.lead.id}`)}
                      className="px-4 bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 transition-all shadow-sm flex items-center justify-center"
                    >
                      View Lead
                    </button>
                    {task.status === 'pending' && (
                      <button
                        onClick={() => handleCompleteClick(task)}
                        className="px-4 bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition-all shadow-sm flex items-center justify-center"
                      >
                        Complete
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Complete Task Modal - Premium Design */}
        {showCompleteModal && selectedTask && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-8 border border-gray-100">
              <h3 className="text-xl font-medium text-gray-900 mb-6">Complete Task</h3>
              
              <div className="mb-6 p-4 bg-gray-50 rounded-xl border border-gray-100">
                <p className="text-sm text-gray-600 mb-2">
                  <span className="font-medium text-gray-900">Task:</span> {selectedTask.title}
                </p>
                <p className="text-sm text-gray-600">
                  <span className="font-medium text-gray-900">Lead:</span> {selectedTask.lead.homeownerFirst} {selectedTask.lead.homeownerLast}
                </p>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-900 mb-3">
                  Completion Note <span className="text-rose-500">*</span>
                </label>
                <textarea
                  value={completionNote}
                  onChange={(e) => setCompletionNote(e.target.value)}
                  placeholder="Describe what was done to complete this task..."
                  rows={4}
                  className="block w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all"
                  required
                />
              </div>

              <div className="mb-8">
                <label className="block text-sm font-medium text-gray-900 mb-3">
                  Quality Rating <span className="text-rose-500">*</span>
                </label>
                <div className="flex gap-3">
                  <button
                    onClick={() => setQualityRating('green')}
                    className={`flex-1 h-16 rounded-xl transition-all ${
                      qualityRating === 'green'
                        ? 'bg-emerald-500 ring-4 ring-emerald-200'
                        : 'bg-emerald-200 hover:bg-emerald-300'
                    }`}
                    title="Excellent"
                  />
                  
                  <button
                    onClick={() => setQualityRating('orange')}
                    className={`flex-1 h-16 rounded-xl transition-all ${
                      qualityRating === 'orange'
                        ? 'bg-amber-500 ring-4 ring-amber-200'
                        : 'bg-amber-200 hover:bg-amber-300'
                    }`}
                    title="Acceptable"
                  />
                  
                  <button
                    onClick={() => setQualityRating('red')}
                    className={`flex-1 h-16 rounded-xl transition-all ${
                      qualityRating === 'red'
                        ? 'bg-rose-500 ring-4 ring-rose-200'
                        : 'bg-rose-200 hover:bg-rose-300'
                    }`}
                    title="Needs Work"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowCompleteModal(false);
                    setSelectedTask(null);
                    setCompletionNote('');
                    setQualityRating(null);
                  }}
                  className="px-6 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCompleteTask}
                  className="px-6 py-2.5 text-sm font-medium text-white bg-gray-900 hover:bg-gray-800 rounded-xl transition-colors shadow-sm"
                >
                  Complete Task
                </button>
              </div>
            </div>
          </div>
        )}

        </div>
      </div>

      {/* Audio Player Modal */}
      {playingRecording && (
        <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Call Recording</h3>
              <button
                onClick={() => setPlayingRecording(null)}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
              >
                ×
              </button>
            </div>
            <audio controls className="w-full" autoPlay>
              <source src={playingRecording} type="audio/mpeg" />
              Your browser does not support the audio element.
            </audio>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default TeamMemberDashboard;




