import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout/Layout';
import api from '../services/api';
import { useToast } from '../contexts/ToastContext';

interface PipelineStage {
  id: string;
  name: string;
  displayName: string;
  order: number;
  isActive: boolean;
  isSystem: boolean;
}

const PipelineStagesManagement: React.FC = () => {
  const { showToast } = useToast();
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newStageName, setNewStageName] = useState('');
  const [newStageDisplayName, setNewStageDisplayName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingDisplayName, setEditingDisplayName] = useState('');
  const [draggedStage, setDraggedStage] = useState<PipelineStage | null>(null);

  useEffect(() => {
    loadStages();
  }, []);

  const loadStages = async () => {
    try {
      const response = await api.get('/pipeline-stages');
      setStages(response.data);
    } catch (error) {
      showToast('Failed to load pipeline stages', 'error');
    } finally {
      setLoading(false);
    }
  };

  const addStage = async () => {
    if (!newStageName.trim() || !newStageDisplayName.trim()) {
      showToast('Please fill in all fields', 'error');
      return;
    }

    try {
      await api.post('/pipeline-stages', {
        name: newStageName.trim(),
        displayName: newStageDisplayName.trim(),
      });
      await loadStages();
      setNewStageName('');
      setNewStageDisplayName('');
      setShowAddForm(false);
      showToast('Pipeline stage added successfully', 'success');
    } catch (error: any) {
      showToast(error.response?.data?.error || 'Failed to add pipeline stage', 'error');
    }
  };

  const updateStage = async (id: string) => {
    if (!editingDisplayName.trim()) {
      showToast('Display name cannot be empty', 'error');
      return;
    }

    try {
      await api.put(`/pipeline-stages/${id}`, {
        displayName: editingDisplayName.trim(),
      });
      await loadStages();
      setEditingId(null);
      setEditingDisplayName('');
      showToast('Pipeline stage updated successfully', 'success');
    } catch (error: any) {
      showToast(error.response?.data?.error || 'Failed to update pipeline stage', 'error');
    }
  };

  const deleteStage = async (id: string) => {
    try {
      await api.delete(`/pipeline-stages/${id}`);
      await loadStages();
      showToast('Pipeline stage deleted successfully', 'success');
    } catch (error: any) {
      showToast(error.response?.data?.error || 'Failed to delete pipeline stage', 'error');
    }
  };

  const handleDragStart = (stage: PipelineStage) => {
    setDraggedStage(stage);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (targetStage: PipelineStage) => {
    if (!draggedStage || draggedStage.id === targetStage.id) return;

    const reorderedStages = [...stages];
    const draggedIndex = reorderedStages.findIndex(s => s.id === draggedStage.id);
    const targetIndex = reorderedStages.findIndex(s => s.id === targetStage.id);

    // Remove dragged item
    const [removed] = reorderedStages.splice(draggedIndex, 1);
    // Insert at new position
    reorderedStages.splice(targetIndex, 0, removed);

    // Update order numbers
    const updatedStages = reorderedStages.map((stage, index) => ({
      id: stage.id,
      order: index + 1,
    }));

    try {
      await api.post('/pipeline-stages/reorder', { stages: updatedStages });
      await loadStages();
      showToast('Pipeline stages reordered successfully', 'success');
    } catch (error) {
      showToast('Failed to reorder pipeline stages', 'error');
    } finally {
      setDraggedStage(null);
    }
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
              <h1 className="text-2xl font-semibold text-gray-900">Pipeline Stages</h1>
              <p className="text-sm text-gray-500 mt-1">
                Customize your sales pipeline stages
              </p>
            </div>
            
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-hover transition-colors flex items-center gap-2"
            >
              {showAddForm ? (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Cancel
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add Stage
                </>
              )}
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="px-8 py-6">
          {/* Add Form */}
          {showAddForm && (
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-primary200 rounded-xl p-6 mb-6">
              <h3 className="text-base font-semibold text-gray-900 mb-5 flex items-center gap-2">
                <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add New Pipeline Stage
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Stage Name (Internal)
                  </label>
                  <input
                    type="text"
                    value={newStageName}
                    onChange={(e) => setNewStageName(e.target.value)}
                    placeholder="e.g., proposal-sent"
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                  <p className="text-xs text-gray-500 mt-1.5">
                    Used internally, no spaces
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Display Name
                  </label>
                  <input
                    type="text"
                    value={newStageDisplayName}
                    onChange={(e) => setNewStageDisplayName(e.target.value)}
                    placeholder="e.g., Proposal Sent"
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                  <p className="text-xs text-gray-500 mt-1.5">
                    Shown to users
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={addStage}
                  className="px-5 py-2.5 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-hover transition-colors"
                >
                  Add Stage
                </button>
                <button
                  onClick={() => {
                    setShowAddForm(false);
                    setNewStageName('');
                    setNewStageDisplayName('');
                  }}
                  className="px-5 py-2.5 bg-white text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-100 transition-colors border border-gray-300"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}



          {/* Stages List */}
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Order
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Stage Name
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Display Name
                  </th>
                  <th className="px-6 py-4 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-4 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {stages.map((stage) => (
                  <tr
                    key={stage.id}
                    draggable
                    onDragStart={() => handleDragStart(stage)}
                    onDragOver={handleDragOver}
                    onDrop={() => handleDrop(stage)}
                    className="hover:bg-gray-50 transition-colors cursor-move group"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-400 group-hover:text-gray-600 text-xs">⋮⋮</span>
                        <span className="text-sm font-semibold text-gray-900">
                          {stage.order}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-600">
                        {stage.name}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {editingId === stage.id ? (
                        <input
                          type="text"
                          value={editingDisplayName}
                          onChange={(e) => setEditingDisplayName(e.target.value)}
                          className="px-4 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                          autoFocus
                        />
                      ) : (
                        <span className="text-sm font-medium text-gray-900">
                          {stage.displayName}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      {stage.isSystem ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
                          System
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800 border border-green-200">
                          Custom
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="flex items-center justify-center gap-2">
                        {editingId === stage.id ? (
                          <>
                            <button
                              onClick={() => updateStage(stage.id)}
                              className="px-4 py-2 bg-primary text-white text-xs font-medium rounded-lg hover:bg-primary-hover transition-colors"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => {
                                setEditingId(null);
                                setEditingDisplayName('');
                              }}
                              className="px-4 py-2 bg-white text-gray-700 text-xs font-medium rounded-lg hover:bg-gray-100 transition-colors border border-gray-300"
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => {
                                setEditingId(stage.id);
                                setEditingDisplayName(stage.displayName);
                              }}
                              className="inline-flex items-center justify-center w-8 h-8 rounded-full text-gray-400 hover:text-primary hover:bg-primary-light transition-colors"
                              title="Edit"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            {!stage.isSystem && (
                              <button
                                onClick={() => deleteStage(stage.id)}
                                className="inline-flex items-center justify-center w-8 h-8 rounded-full text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                                title="Delete"
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default PipelineStagesManagement;




