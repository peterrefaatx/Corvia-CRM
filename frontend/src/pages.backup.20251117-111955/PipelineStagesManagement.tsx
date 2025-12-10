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
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin h-12 w-12 border-b-2 border-indigo-600"></div>
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
            <div>
              <h1 className="text-2xl text-slate-900" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 700 }}>
                Pipeline Stages
              </h1>
              <p className="text-sm text-slate-500 mt-1" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 400 }}>
                Customize your sales pipeline stages
              </p>
            </div>
            
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowAddForm(!showAddForm)}
                className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition-colors"
                style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 500 }}
              >
                {showAddForm ? 'Cancel' : '+ Add Stage'}
              </button>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-auto p-8">
          {/* Add Form */}
          {showAddForm && (
            <div className="bg-white rounded-xl border border-slate-100 border-l-4 border-l-indigo-500 p-6 mb-6">
              <h3 className="text-base text-slate-900 mb-4" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 600 }}>
                Add New Pipeline Stage
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-xs text-slate-500 uppercase tracking-wide mb-2" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 500 }}>
                    Stage Name (Internal)
                  </label>
                  <input
                    type="text"
                    value={newStageName}
                    onChange={(e) => setNewStageName(e.target.value)}
                    placeholder="e.g., proposal-sent"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-indigo-500 transition-colors"
                    style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 400 }}
                  />
                  <p className="text-xs text-slate-500 mt-1.5" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 400 }}>
                    Used internally, no spaces
                  </p>
                </div>
                <div>
                  <label className="block text-xs text-slate-500 uppercase tracking-wide mb-2" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 500 }}>
                    Display Name
                  </label>
                  <input
                    type="text"
                    value={newStageDisplayName}
                    onChange={(e) => setNewStageDisplayName(e.target.value)}
                    placeholder="e.g., Proposal Sent"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-indigo-500 transition-colors"
                    style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 400 }}
                  />
                  <p className="text-xs text-slate-500 mt-1.5" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 400 }}>
                    Shown to users
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={addStage}
                  className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors"
                  style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 500 }}
                >
                  Add Stage
                </button>
                <button
                  onClick={() => {
                    setShowAddForm(false);
                    setNewStageName('');
                    setNewStageDisplayName('');
                  }}
                  className="px-4 py-2 bg-white text-slate-700 text-sm rounded-lg hover:bg-slate-50 transition-colors border border-slate-200"
                  style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 500 }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}



          {/* Stages List */}
          <div className="bg-white rounded-xl border border-slate-100 border-l-4 border-l-slate-200 overflow-hidden">
            <div className="overflow-auto pipeline-scrollbar" style={{ maxHeight: '600px' }}>
              <table className="min-w-full divide-y divide-slate-100">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs text-slate-900 uppercase tracking-wider" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 600 }}>
                    Order
                  </th>
                  <th className="px-6 py-4 text-left text-xs text-slate-900 uppercase tracking-wider" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 600 }}>
                    Stage Name
                  </th>
                  <th className="px-6 py-4 text-left text-xs text-slate-900 uppercase tracking-wider" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 600 }}>
                    Display Name
                  </th>
                  <th className="px-6 py-4 text-left text-xs text-slate-900 uppercase tracking-wider" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 600 }}>
                    Type
                  </th>
                  <th className="px-6 py-4 text-center text-xs text-slate-900 uppercase tracking-wider" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 600 }}>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100">
                {stages.map((stage) => (
                  <tr
                    key={stage.id}
                    draggable
                    onDragStart={() => handleDragStart(stage)}
                    onDragOver={handleDragOver}
                    onDrop={() => handleDrop(stage)}
                    className="hover:bg-slate-50 transition-colors cursor-move group"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400 group-hover:text-slate-600 text-xs">⋮⋮</span>
                        <span className="text-sm text-slate-900" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 600 }}>
                          {stage.order}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-slate-600" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 400 }}>
                        {stage.name}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {editingId === stage.id ? (
                        <input
                          type="text"
                          value={editingDisplayName}
                          onChange={(e) => setEditingDisplayName(e.target.value)}
                          className="px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-indigo-500 transition-colors"
                          style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 400 }}
                          autoFocus
                        />
                      ) : (
                        <span className="text-sm text-slate-900" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 600 }}>
                          {stage.displayName}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {stage.isSystem ? (
                        <span className="text-xs px-2.5 py-1 bg-purple-100 text-purple-700 rounded-full" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 500 }}>
                          System
                        </span>
                      ) : (
                        <span className="text-xs px-2.5 py-1 bg-green-100 text-green-700 rounded-full" style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 500 }}>
                          Custom
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center justify-center gap-2">
                        {editingId === stage.id ? (
                          <>
                            <button
                              onClick={() => updateStage(stage.id)}
                              className="px-3 py-1.5 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700 transition-colors"
                              style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 500 }}
                            >
                              Save
                            </button>
                            <button
                              onClick={() => {
                                setEditingId(null);
                                setEditingDisplayName('');
                              }}
                              className="px-3 py-1.5 bg-white text-slate-700 text-xs rounded-lg hover:bg-slate-50 transition-colors border border-slate-200"
                              style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 500 }}
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
                              className="w-8 h-8 rounded-full flex items-center justify-center text-indigo-600 hover:bg-indigo-50 transition-colors"
                              title="Edit"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            {!stage.isSystem && (
                              <button
                                onClick={() => deleteStage(stage.id)}
                                className="w-8 h-8 rounded-full flex items-center justify-center text-red-600 hover:bg-red-50 transition-colors"
                                title="Delete"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
      </div>
    </Layout>
  );
};

export default PipelineStagesManagement;
