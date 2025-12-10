import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout/Layout';
import { useToast } from '../contexts/ToastContext';
import api from '../services/api';
import { usePageTitle } from '../hooks/usePageTitle';

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
  };
  assignedUser: {
    id: string;
    name: string;
    positionTitle: string;
  };
}

const ClientTasks: React.FC = () => {
  usePageTitle('Tasks');
  const navigate = useNavigate();
  const { showSuccess, showError } = useToast();
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('pending');
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [completionNote, setCompletionNote] = useState('');
  const [qualityRating, setQualityRating] = useState<'green' | 'orange' | 'red' | null>(null);

  useEffect(() => {
    loadTasks();
  }, []);

  const loadTasks = async () => {
    try {
      setLoading(true);
      const response = await api.get('/tasks');
      setAllTasks(response.data);
    } catch (error: any) {
      console.error('Failed to load tasks:', error);
      showError('Failed to load tasks');
    } finally {
      setLoading(false);
    }
  };

  // Filter tasks on frontend
  const tasks = filterStatus === 'all' 
    ? allTasks 
    : allTasks.filter(t => t.status === filterStatus);

  const handleCompleteClick = (task: Task) => {
    setSelectedTask(task);
    setCompletionNote('');
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
        qualityRating
      });
      showSuccess('Task completed successfully');
      setShowCompleteModal(false);
      setSelectedTask(null);
      setCompletionNote('');
      setQualityRating(null);
      loadTasks();
    } catch (error: any) {
      console.error('Failed to complete task:', error);
      showError(error.response?.data?.error || 'Failed to complete task');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'archived':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
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

  const pendingTasks = allTasks.filter(t => t.status === 'pending');
  const completedTasks = allTasks.filter(t => t.status === 'completed');

  return (
    <Layout>
      <div className="min-h-screen" style={{ backgroundColor: '#fafafa' }}>
        <div className="w-full px-4 sm:px-6 lg:px-8 py-8">
          {/* Header Card */}
          <div className="bg-white rounded-2xl p-6 border border-gray-100 mb-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Tasks</h1>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-3xl font-bold text-cyan-600">{pendingTasks.length}</p>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Pending</p>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-bold text-green-600">{completedTasks.length}</p>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Completed</p>
                </div>
              </div>
            </div>
            
            {/* Filters Row */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setFilterStatus('all')}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  filterStatus === 'all'
                    ? 'bg-primary text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                All ({allTasks.length})
              </button>
              <button
                onClick={() => setFilterStatus('pending')}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  filterStatus === 'pending'
                    ? 'bg-primary text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Pending ({pendingTasks.length})
              </button>
              <button
                onClick={() => setFilterStatus('completed')}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  filterStatus === 'completed'
                    ? 'bg-primary text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Completed ({completedTasks.length})
              </button>
            </div>
          </div>

          {/* Tasks List */}
          {tasks.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
              <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
              <p className="text-lg font-medium text-gray-900">No tasks found</p>
              <p className="text-sm text-gray-500 mt-2">
                {filterStatus === 'all' 
                  ? 'Tasks will appear here once assigned'
                  : `No ${filterStatus} tasks at the moment`}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {tasks.map((task) => (
                <div
                  key={task.id}
                  className="bg-white rounded-xl shadow-sm hover:shadow-md transition-all duration-200 border border-gray-200 overflow-hidden"
                >
                  <div className="flex items-stretch">
                    {/* Task Content */}
                    <div className="flex-1 p-6">
                      {/* Task Header */}
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-lg font-semibold text-gray-900">{task.title}</h3>
                            {isOverdue(task.dueDate, task.status) && (
                              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-rose-500 text-white shadow-sm">
                                <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                </svg>
                                OVERDUE
                              </span>
                            )}
                            {task.status === 'completed' && (
                              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-emerald-500 text-white shadow-sm">
                                <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                                COMPLETED
                              </span>
                            )}
                          </div>
                          {task.description && (
                            <p className="text-sm text-gray-600 leading-relaxed">{task.description}</p>
                          )}
                        </div>
                      </div>

                      {/* Task Meta - Premium Info Cards */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg border border-gray-100">
                          <svg className="w-5 h-5 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <div>
                            <div className="text-xs text-gray-500 font-medium">Due Date</div>
                            <div className="text-sm font-semibold text-gray-900">{formatDate(task.dueDate)}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg border border-gray-100">
                          <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                          <div>
                            <div className="text-xs text-gray-500 font-medium">Lead</div>
                            <div className="text-sm font-semibold text-gray-900">{task.lead.homeownerFirst} {task.lead.homeownerLast}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg border border-gray-100">
                          <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                          </svg>
                          <div>
                            <div className="text-xs text-gray-500 font-medium">Assigned To</div>
                            <div className="text-sm font-semibold text-gray-900">{task.assignedUser.name}</div>
                          </div>
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

                    {/* Action Buttons - Icon Style */}
                    <div className="flex items-center gap-2 px-4">
                      <button
                        onClick={() => navigate(`/client/lead/${task.lead.id}`)}
                        className="p-3 text-gray-600 hover:text-cyan-600 hover:bg-cyan-50 rounded-xl transition-all duration-200"
                        title="View Lead"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </button>
                      {task.status === 'pending' && (
                        <button
                          onClick={() => handleCompleteClick(task)}
                          className="px-4 py-2 bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 rounded-xl transition-all duration-200 flex items-center gap-2 shadow-sm"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Complete
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Complete Task Modal */}
          {showCompleteModal && selectedTask && (
            <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Complete Task</h3>
              
              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-2">
                  <strong>Task:</strong> {selectedTask.title}
                </p>
                <p className="text-sm text-gray-600">
                  <strong>Lead:</strong> {selectedTask.lead.homeownerFirst} {selectedTask.lead.homeownerLast}
                </p>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Quality Rating <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-3 mb-6">
                  <button
                    onClick={() => setQualityRating('green')}
                    className={`flex-1 py-3 px-4 rounded-lg border-2 transition-all ${
                      qualityRating === 'green'
                        ? 'border-green-500 bg-green-50'
                        : 'border-gray-200 hover:border-green-300'
                    }`}
                  >
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 rounded-full bg-green-500"></div>
                      <span className="font-medium text-gray-900">Good</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Positive outcome</p>
                  </button>
                  <button
                    onClick={() => setQualityRating('orange')}
                    className={`flex-1 py-3 px-4 rounded-lg border-2 transition-all ${
                      qualityRating === 'orange'
                        ? 'border-orange-500 bg-orange-50'
                        : 'border-gray-200 hover:border-orange-300'
                    }`}
                  >
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 rounded-full bg-orange-500"></div>
                      <span className="font-medium text-gray-900">Neutral</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Needs follow-up</p>
                  </button>
                  <button
                    onClick={() => setQualityRating('red')}
                    className={`flex-1 py-3 px-4 rounded-lg border-2 transition-all ${
                      qualityRating === 'red'
                        ? 'border-red-500 bg-red-50'
                        : 'border-gray-200 hover:border-red-300'
                    }`}
                  >
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 rounded-full bg-red-500"></div>
                      <span className="font-medium text-gray-900">Issue</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Negative outcome</p>
                  </button>
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Completion Note <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={completionNote}
                  onChange={(e) => setCompletionNote(e.target.value)}
                  placeholder="Describe what was done to complete this task..."
                  rows={4}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Explain what actions were taken to complete this task
                </p>
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowCompleteModal(false);
                    setSelectedTask(null);
                    setCompletionNote('');
                    setQualityRating(null);
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCompleteTask}
                  className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-md"
                >
                  Complete Task
                </button>
              </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default ClientTasks;




