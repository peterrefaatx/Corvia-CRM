import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout/Layout';
import { useToast } from '../contexts/ToastContext';
import api from '../services/api';
import { usePageTitle } from '../hooks/usePageTitle';

interface AutomationRule {
  id: string;
  pipelineStage: string;
  ruleConfig: {
    tasks: Array<{
      title: string;
      description: string;
      assign_to_role: string;
      due_in_hours: number;
    }>;
  };
  isActive: boolean;
  createdAt: string;
}

interface PipelineStage {
  id: string;
  name: string;
  order: number;
}

interface Position {
  id: string;
  title: string;
  description: string;
  isActive: boolean;
  _count?: {
    teamMembers: number;
  };
}

const ClientAutomationRules: React.FC = () => {
  usePageTitle('Automation Rules');
  const { showSuccess, showError } = useToast();
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [pipelineStages, setPipelineStages] = useState<PipelineStage[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formData, setFormData] = useState({
    pipelineStage: '',
    taskTitle: '',
    taskDescription: '',
    assignToPosition: '',
    dueInHours: 24
  });

  useEffect(() => {
    loadRules();
    loadPipelineStages();
    loadPositions();
  }, []);

  const loadRules = async () => {
    try {
      setLoading(true);
      const response = await api.get('/pipeline/automation-rules');
      setRules(response.data);
    } catch (error: any) {
      console.error('Failed to load rules:', error);
      showError('Failed to load automation rules');
    } finally {
      setLoading(false);
    }
  };

  const loadPipelineStages = async () => {
    try {
      const response = await api.get('/client/pipeline-stages');
      setPipelineStages(response.data);
    } catch (error: any) {
      console.error('Failed to load pipeline stages:', error);
      showError('Failed to load pipeline stages');
    }
  };

  const loadPositions = async () => {
    try {
      const response = await api.get('/client/positions');
      const activePositions = response.data.filter((pos: Position) => pos.isActive);
      setPositions(activePositions);
    } catch (error: any) {
      console.error('Failed to load positions:', error);
      showError('Failed to load positions');
    }
  };

  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.pipelineStage || !formData.taskTitle || !formData.assignToPosition) {
      showError('Please fill in all required fields');
      return;
    }

    try {
      await api.post('/pipeline/automation-rules', {
        pipelineStage: formData.pipelineStage,
        ruleConfig: {
          tasks: [{
            title: formData.taskTitle,
            description: formData.taskDescription,
            assign_to_role: formData.assignToPosition,
            due_in_hours: formData.dueInHours
          }]
        },
        isActive: true
      });

      showSuccess('Automation rule created successfully');
      setShowCreateModal(false);
      setFormData({
        pipelineStage: '',
        taskTitle: '',
        taskDescription: '',
        assignToPosition: '',
        dueInHours: 24
      });
      loadRules();
    } catch (error: any) {
      console.error('Failed to create rule:', error);
      showError(error.response?.data?.error || 'Failed to create rule');
    }
  };

  const handleToggleActive = async (rule: AutomationRule) => {
    try {
      await api.patch(`/pipeline/automation-rules/${rule.id}/toggle`);
      showSuccess(`Rule ${rule.isActive ? 'deactivated' : 'activated'} successfully`);
      loadRules();
    } catch (error: any) {
      console.error('Failed to toggle rule:', error);
      showError('Failed to toggle rule');
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    if (!window.confirm('Are you sure you want to delete this automation rule?')) return;

    try {
      await api.delete(`/pipeline/automation-rules/${ruleId}`);
      showSuccess('Rule deleted successfully');
      loadRules();
    } catch (error: any) {
      console.error('Failed to delete rule:', error);
      showError('Failed to delete rule');
    }
  };

  const handleOpenCreateModal = () => {
    loadPositions();
    loadPipelineStages();
    setShowCreateModal(true);
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
        {/* Header */}
        <div className="bg-white border-b border-gray-100 px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">Automation Rules</h1>
              <p className="text-sm text-gray-500 mt-1">
                Automatically create tasks when leads enter pipeline stages
              </p>
            </div>
            <button
              onClick={handleOpenCreateModal}
              className="px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-hover transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create Rule
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="px-8 py-6">

          {/* Rules Table */}
          {rules.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
              <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-gray-50 mb-4">
                <svg className="h-8 w-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No automation rules</h3>
              <p className="text-sm text-gray-500 mb-6">Create your first rule to automate task creation</p>
              <button
                onClick={handleOpenCreateModal}
                className="px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg bg-primary-hover transition-colors inline-flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Create Rule
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <table className="min-w-full divide-y divide-gray-100">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Pipeline Stage
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Task Details
                    </th>
                    <th className="px-6 py-4 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Assigned To
                    </th>
                    <th className="px-6 py-4 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Due In
                    </th>
                    <th className="px-6 py-4 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-4 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {rules.map((rule) => (
                    <React.Fragment key={rule.id}>
                      {rule.ruleConfig.tasks.map((task, taskIndex) => (
                        <tr key={`${rule.id}-${taskIndex}`} className="hover:bg-gray-50 transition-colors">
                          {taskIndex === 0 && (
                            <td 
                              className="px-6 py-4 whitespace-nowrap align-top" 
                              rowSpan={rule.ruleConfig.tasks.length}
                            >
                              <div className="text-sm font-semibold text-gray-900">
                                {rule.pipelineStage}
                              </div>
                            </td>
                          )}
                          <td className="px-6 py-4">
                            <div className="text-sm font-medium text-gray-900">{task.title}</div>
                            {task.description && (
                              <div className="text-sm text-gray-600 mt-1">{task.description}</div>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            <div className="inline-flex items-center gap-1.5 text-sm text-gray-700">
                              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                              </svg>
                              {task.assign_to_role}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            <div className="inline-flex items-center gap-1.5 text-sm text-gray-700">
                              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              {task.due_in_hours}h
                            </div>
                          </td>
                          {taskIndex === 0 && (
                            <>
                              <td 
                                className="px-6 py-4 whitespace-nowrap text-center align-top" 
                                rowSpan={rule.ruleConfig.tasks.length}
                              >
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                  rule.isActive 
                                    ? 'bg-green-100 text-green-800' 
                                    : 'bg-gray-100 text-gray-800'
                                }`}>
                                  {rule.isActive ? 'Active' : 'Inactive'}
                                </span>
                              </td>
                              <td 
                                className="px-6 py-4 whitespace-nowrap text-center align-top" 
                                rowSpan={rule.ruleConfig.tasks.length}
                              >
                                <div className="flex items-center justify-center gap-2">
                                  <button
                                    onClick={() => handleToggleActive(rule)}
                                    className={`inline-flex items-center justify-center w-8 h-8 rounded-full transition-colors ${
                                      rule.isActive
                                        ? 'text-gray-400 hover:text-orange-600 hover:bg-orange-50'
                                        : 'text-gray-400 hover:text-green-600 hover:bg-green-50'
                                    }`}
                                    title={rule.isActive ? 'Deactivate' : 'Activate'}
                                  >
                                    {rule.isActive ? (
                                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                                      </svg>
                                    ) : (
                                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                      </svg>
                                    )}
                                  </button>
                                  <button
                                    onClick={() => handleDeleteRule(rule.id)}
                                    className="inline-flex items-center justify-center w-8 h-8 rounded-full text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                                    title="Delete"
                                  >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                  </button>
                                </div>
                              </td>
                            </>
                          )}
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Create Rule Modal */}
          {showCreateModal && (
            <div className="fixed inset-0 bg-black/40 backdrop-blur-sm overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-8 border border-gray-100">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-semibold text-gray-900">Create Automation Rule</h3>
                  <button
                    onClick={() => setShowCreateModal(false)}
                    className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                
                <form onSubmit={handleCreateRule}>
                  <div className="space-y-5">
                    <div>
                      <label className="block text-sm font-medium text-gray-900 mb-2">
                        Pipeline Stage <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={formData.pipelineStage}
                        onChange={(e) => setFormData({...formData, pipelineStage: e.target.value})}
                        className="block w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary500 focus:border-transparent transition-all"
                        required
                      >
                        <option value="">Select stage</option>
                        {pipelineStages.map((stage) => (
                          <option key={stage.id} value={stage.name}>
                            {stage.name}
                          </option>
                        ))}
                      </select>
                      <p className="text-xs text-gray-500 mt-1.5">
                        Task will be created when a lead enters this stage
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-900 mb-2">
                        Task Title <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={formData.taskTitle}
                        onChange={(e) => setFormData({...formData, taskTitle: e.target.value})}
                        placeholder="e.g., Confirm appointment"
                        className="block w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary500 focus:border-transparent transition-all"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-900 mb-2">
                        Task Description
                      </label>
                      <textarea
                        value={formData.taskDescription}
                        onChange={(e) => setFormData({...formData, taskDescription: e.target.value})}
                        placeholder="Describe what needs to be done..."
                        rows={3}
                        className="block w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary500 focus:border-transparent transition-all resize-none"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-900 mb-2">
                        Assign to Position <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={formData.assignToPosition}
                        onChange={(e) => setFormData({...formData, assignToPosition: e.target.value})}
                        className="block w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary500 focus:border-transparent transition-all"
                        required
                      >
                        <option value="">Select position</option>
                        {positions.map((position) => (
                          <option key={position.id} value={position.title}>
                            {position.title} {position._count && `(${position._count.teamMembers} members)`}
                          </option>
                        ))}
                      </select>
                      <p className="text-xs text-gray-500 mt-1.5">
                        Tasks distributed fairly among team members
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-900 mb-2">
                        Due in Hours
                      </label>
                      <input
                        type="number"
                        value={formData.dueInHours}
                        onChange={(e) => setFormData({...formData, dueInHours: parseInt(e.target.value)})}
                        min="1"
                        className="block w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary500 focus:border-transparent transition-all"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 mt-8">
                    <button
                      type="button"
                      onClick={() => setShowCreateModal(false)}
                      className="px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2.5 text-sm font-medium text-white bg-primary bg-primary-hover rounded-lg transition-colors"
                    >
                      Create Rule
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default ClientAutomationRules;




