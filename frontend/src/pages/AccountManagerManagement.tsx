import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout/Layout';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

interface User {
  id: string;
  fullName: string;
  username: string;
  role: string;
  team?: {
    id: string;
    name: string;
  };
}

interface AMAssignment {
  accountManager: User;
  teamLeaders: User[];
  qcAgents: User[];
  itUsers: User[];
}

const AccountManagerManagement: React.FC = () => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [accountManagers, setAccountManagers] = useState<User[]>([]);
  const [teamLeaders, setTeamLeaders] = useState<User[]>([]);
  const [qcAgents, setQcAgents] = useState<User[]>([]);
  const [itUsers, setItUsers] = useState<User[]>([]);
  const [selectedAM, setSelectedAM] = useState<string>('');
  const [selectedTLs, setSelectedTLs] = useState<string[]>([]);
  const [selectedQCs, setSelectedQCs] = useState<string[]>([]);
  const [selectedITs, setSelectedITs] = useState<string[]>([]);
  const [assignments, setAssignments] = useState<AMAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user?.role !== 'Manager') {
      navigate('/');
      return;
    }
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, navigate]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get('/users');
      
      const ams = response.data.filter((u: User) => u.role === 'AccountManager');
      const tls = response.data.filter((u: User) => u.role === 'TeamLeader');
      const qcs = response.data.filter((u: User) => u.role === 'QualityControl');
      const its = response.data.filter((u: User) => u.role === 'IT');
      
      setAccountManagers(ams);
      setTeamLeaders(tls);
      setQcAgents(qcs);
      setItUsers(its);
      
      // Load current assignments for all AMs
      if (ams.length > 0) {
        await loadAllAssignments(ams, tls, qcs, its);
      } else {
        setAssignments([]);
      }
    } catch (error: any) {
      console.error('Failed to load data:', error);
      setError(error?.response?.data?.error || error?.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const loadAllAssignments = async (ams: User[], tls: User[], qcs: User[], its: User[]) => {
    try {
      const assignmentPromises = ams.map(async (am) => {
        try {
          const [tlQcResponse, itResponse] = await Promise.all([
            api.get(`/admin/account-manager/${am.id}/team-leaders`),
            api.get(`/admin/it-assignments/account-manager/${am.id}`)
          ]);
          
          const assignedTLIds = tlQcResponse.data.teamLeaderIds || [];
          const assignedQCIds = tlQcResponse.data.qcAgentIds || [];
          const assignedITUsers = itResponse.data.itUsers || [];
          
          const assignedTLs = tls.filter(tl => assignedTLIds.includes(tl.id));
          const assignedQCs = qcs.filter(qc => assignedQCIds.includes(qc.id));
          
          return { 
            accountManager: am, 
            teamLeaders: assignedTLs, 
            qcAgents: assignedQCs,
            itUsers: assignedITUsers
          };
        } catch (error) {
          console.error(`Failed to load assignments for ${am.fullName}:`, error);
          return { accountManager: am, teamLeaders: [], qcAgents: [], itUsers: [] };
        }
      });
      
      const results = await Promise.all(assignmentPromises);
      setAssignments(results);
    } catch (error) {
      console.error('Failed to load assignments:', error);
    }
  };

  const loadTeamLeadersForAM = async (amId: string) => {
    try {
      const [tlQcResponse, itResponse] = await Promise.all([
        api.get(`/admin/account-manager/${amId}/team-leaders`),
        api.get(`/admin/it-assignments/account-manager/${amId}`)
      ]);
      
      setSelectedTLs(tlQcResponse.data.teamLeaderIds || []);
      setSelectedQCs(tlQcResponse.data.qcAgentIds || []);
      setSelectedITs(itResponse.data.itUsers?.map((u: User) => u.id) || []);
    } catch (error) {
      console.error('Failed to load assignments:', error);
      setSelectedTLs([]);
      setSelectedQCs([]);
      setSelectedITs([]);
    }
  };

  const handleAMChange = (amId: string) => {
    setSelectedAM(amId);
    if (amId) {
      loadTeamLeadersForAM(amId);
    } else {
      setSelectedTLs([]);
      setSelectedQCs([]);
      setSelectedITs([]);
    }
  };

  // Check if a Team Leader is assigned to another Account Manager
  const isTLAssignedToOther = (tlId: string): boolean => {
    if (!selectedAM) return false;
    return assignments.some(a => 
      a.accountManager.id !== selectedAM && 
      a.teamLeaders.some(tl => tl.id === tlId)
    );
  };

  // Check if a QC Agent is assigned to another Account Manager
  const isQCAssignedToOther = (qcId: string): boolean => {
    if (!selectedAM) return false;
    return assignments.some(a => 
      a.accountManager.id !== selectedAM && 
      a.qcAgents.some(qc => qc.id === qcId)
    );
  };

  const toggleTeamLeader = (tlId: string) => {
    // Don't allow toggling if assigned to another AM
    if (isTLAssignedToOther(tlId)) return;
    
    setSelectedTLs(prev => 
      prev.includes(tlId) 
        ? prev.filter(id => id !== tlId)
        : [...prev, tlId]
    );
  };

  const toggleQCAgent = (qcId: string) => {
    // Don't allow toggling if assigned to another AM
    if (isQCAssignedToOther(qcId)) return;
    
    setSelectedQCs(prev => 
      prev.includes(qcId) 
        ? prev.filter(id => id !== qcId)
        : [...prev, qcId]
    );
  };

  const toggleITUser = (itId: string) => {
    setSelectedITs(prev => 
      prev.includes(itId) 
        ? prev.filter(id => id !== itId)
        : [...prev, itId]
    );
  };

  const handleSave = async () => {
    if (!selectedAM) return;
    
    try {
      setSaving(true);
      
      // Save TL and QC assignments
      await api.put(`/admin/account-manager/${selectedAM}/team-leaders`, {
        teamLeaderIds: selectedTLs,
        qcAgentIds: selectedQCs
      });
      
      // Save IT assignments
      if (selectedITs.length > 0) {
        await api.post('/admin/it-assignments', {
          itUserIds: selectedITs,
          accountManagerId: selectedAM
        });
      }
      
      showToast('All assignments saved successfully!', 'success');
      // Reload assignments to reflect changes
      await loadData();
    } catch (error) {
      console.error('Failed to save:', error);
      showToast('Failed to save assignments', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#fafafa' }}><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <div className="py-6 px-4 sm:px-6 lg:px-8">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h2 className="text-xl font-bold text-red-900 mb-2">Error Loading Data</h2>
            <p className="text-red-700 mb-4">{error}</p>
            <button
              onClick={loadData}
              className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700"
            >
              Retry
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="py-4 px-4 sm:px-6 lg:px-8" style={{ backgroundColor: '#f7f6f5' }}>
        {/* Back Button */}
        <button
          onClick={() => navigate('/admin')}
          className="mb-6 flex items-center text-gray-600 hover:text-gray-900 transition-colors"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          <span className="text-sm font-medium">Back</span>
        </button>
        {/* Stats Cards */}
        <div className="grid grid-cols-5 gap-3 mb-4">
          <div className="bg-white rounded-lg p-4 shadow-sm border-l-4" style={{ borderLeftColor: '#e5e5e5' }}>
            <div className="text-gray-600 text-xs font-medium mb-1">ACM's</div>
            <div className="text-gray-900 text-2xl font-bold">{accountManagers.length}</div>
          </div>
          <div className="bg-white rounded-lg p-4 shadow-sm border-l-4" style={{ borderLeftColor: '#e5e5e5' }}>
            <div className="text-gray-600 text-xs font-medium mb-1">Team Leaders</div>
            <div className="text-gray-900 text-2xl font-bold">{teamLeaders.length}</div>
          </div>
          <div className="bg-white rounded-lg p-4 shadow-sm border-l-4" style={{ borderLeftColor: '#e5e5e5' }}>
            <div className="text-gray-600 text-xs font-medium mb-1">QC Agents</div>
            <div className="text-gray-900 text-2xl font-bold">{qcAgents.length}</div>
          </div>
          <div className="bg-white rounded-lg p-4 shadow-sm border-l-4" style={{ borderLeftColor: '#e5e5e5' }}>
            <div className="text-gray-600 text-xs font-medium mb-1">IT Personnel</div>
            <div className="text-gray-900 text-2xl font-bold">{itUsers.length}</div>
          </div>
          <div className="bg-white rounded-lg p-4 shadow-sm border-l-4" style={{ borderLeftColor: '#e5e5e5' }}>
            <div className="text-gray-600 text-xs font-medium mb-1">Total Assigned</div>
            <div className="text-gray-900 text-2xl font-bold">
              {assignments.reduce((sum, a) => sum + a.teamLeaders.length + a.qcAgents.length + a.itUsers.length, 0)}
            </div>
          </div>
        </div>

        {/* Assignment Section */}
        <div className="bg-white rounded-lg p-4 mb-4 shadow-sm">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            {/* Select Account Manager */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">Select Account Manager</label>
              <select
                value={selectedAM}
                onChange={(e) => handleAMChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
              >
                <option value="">-- Select Account Manager --</option>
                {accountManagers.map(am => (
                  <option key={am.id} value={am.id}>
                    {am.fullName}
                  </option>
                ))}
              </select>
            </div>

            {/* Assign Team Leaders */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                Team Leaders ({selectedTLs.length} selected)
              </label>
              {!selectedAM ? (
                <div className="text-sm text-gray-500 text-center py-8 border-2 border-dashed border-gray-300 rounded-lg">
                  Select an Account Manager first
                </div>
              ) : (
                <div className="space-y-1 max-h-64 overflow-y-auto border border-gray-200 rounded-lg p-2">
                  {teamLeaders.length === 0 ? (
                    <p className="text-xs text-gray-500 text-center py-4">No Team Leaders available</p>
                  ) : (
                    teamLeaders.map(tl => {
                      const isAssignedToOther = isTLAssignedToOther(tl.id);
                      const isDisabled = isAssignedToOther;
                      
                      return (
                        <label 
                          key={tl.id}
                          className={`flex items-center p-2 border rounded transition-colors text-xs ${
                            isDisabled
                              ? 'border-gray-200 bg-gray-100 cursor-not-allowed opacity-60'
                              : selectedTLs.includes(tl.id)
                              ? 'border-blue-500 bg-primary-light cursor-pointer'
                              : 'border-transparent hover:bg-gray-50 cursor-pointer'
                          }`}
                          title={isDisabled ? 'Already assigned to another Account Manager' : ''}
                        >
                          <input
                            type="checkbox"
                            checked={selectedTLs.includes(tl.id)}
                            onChange={() => toggleTeamLeader(tl.id)}
                            disabled={isDisabled}
                            className="w-3 h-3 text-primary rounded disabled:cursor-not-allowed"
                          />
                          <span className={`ml-2 font-medium ${isDisabled ? 'text-gray-500' : 'text-gray-900'}`}>
                            {tl.fullName}
                            {isDisabled && <span className="ml-1 text-xs text-red-600">(Assigned)</span>}
                          </span>
                        </label>
                      );
                    })
                  )}
                </div>
              )}
            </div>

            {/* Assign QC Agents */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                QC Agents ({selectedQCs.length} selected)
              </label>
              {!selectedAM ? (
                <div className="text-sm text-gray-500 text-center py-8 border-2 border-dashed border-gray-300 rounded-lg">
                  Select an Account Manager first
                </div>
              ) : (
                <div className="space-y-1 max-h-64 overflow-y-auto border border-gray-200 rounded-lg p-2">
                  {qcAgents.length === 0 ? (
                    <p className="text-xs text-gray-500 text-center py-4">No QC Agents available</p>
                  ) : (
                    qcAgents.map(qc => {
                      const isAssignedToOther = isQCAssignedToOther(qc.id);
                      const isDisabled = isAssignedToOther;
                      
                      return (
                        <label 
                          key={qc.id}
                          className={`flex items-center p-2 border rounded transition-colors text-xs ${
                            isDisabled
                              ? 'border-gray-200 bg-gray-100 cursor-not-allowed opacity-60'
                              : selectedQCs.includes(qc.id)
                              ? 'border-blue-500 bg-primary-light cursor-pointer'
                              : 'border-transparent hover:bg-gray-50 cursor-pointer'
                          }`}
                          title={isDisabled ? 'Already assigned to another Account Manager' : ''}
                        >
                          <input
                            type="checkbox"
                            checked={selectedQCs.includes(qc.id)}
                            onChange={() => toggleQCAgent(qc.id)}
                            disabled={isDisabled}
                            className="w-3 h-3 text-primary rounded disabled:cursor-not-allowed"
                          />
                          <span className={`ml-2 font-medium ${isDisabled ? 'text-gray-500' : 'text-gray-900'}`}>
                            {qc.fullName}
                            {isDisabled && <span className="ml-1 text-xs text-red-600">(Assigned)</span>}
                          </span>
                        </label>
                      );
                    })
                  )}
                </div>
              )}
            </div>

            {/* Assign IT Personnel */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                IT Personnel ({selectedITs.length} selected)
              </label>
              {!selectedAM ? (
                <div className="text-sm text-gray-500 text-center py-8 border-2 border-dashed border-gray-300 rounded-lg">
                  Select an Account Manager first
                </div>
              ) : (
                <div className="space-y-1 max-h-64 overflow-y-auto border border-gray-200 rounded-lg p-2">
                  {itUsers.length === 0 ? (
                    <p className="text-xs text-gray-500 text-center py-4">No IT Personnel available</p>
                  ) : (
                    itUsers.map(it => (
                      <label 
                        key={it.id}
                        className={`flex items-center p-2 border rounded cursor-pointer transition-colors text-xs ${
                          selectedITs.includes(it.id)
                            ? 'border-teal-500 bg-teal-50'
                            : 'border-transparent hover:bg-gray-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedITs.includes(it.id)}
                          onChange={() => toggleITUser(it.id)}
                          className="w-3 h-3 text-teal-600 rounded"
                        />
                        <span className="ml-2 font-medium text-gray-900">{it.fullName}</span>
                      </label>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Save Button */}
          {selectedAM && (
            <div className="mt-4 flex justify-end">
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-6 py-2 bg-primary text-white rounded-lg bg-primary-hover disabled:bg-gray-400 font-semibold transition-colors"
              >
                {saving ? 'Saving...' : `Save (${selectedTLs.length} TL + ${selectedQCs.length} QC + ${selectedITs.length} IT)`}
              </button>
            </div>
          )}
        </div>

        {/* Current Assignments */}
        <div className="bg-white rounded-lg p-4 shadow-sm">
          <h2 className="text-lg font-bold text-gray-900 mb-3">Current Assignments</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-center text-xs font-semibold text-gray-700">Account Manager</th>
                  <th className="px-4 py-2 text-center text-xs font-semibold text-gray-700">Team Leaders</th>
                  <th className="px-4 py-2 text-center text-xs font-semibold text-gray-700">QC Agents</th>
                  <th className="px-4 py-2 text-center text-xs font-semibold text-gray-700">IT Personnel</th>
                  <th className="px-4 py-2 text-center text-xs font-semibold text-gray-700">Total</th>
                  <th className="px-4 py-2 text-center text-xs font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {assignments.map(({ accountManager, teamLeaders: assignedTLs, qcAgents: assignedQCs, itUsers: assignedITs }) => (
                  <tr key={accountManager.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-center">
                      <div className="text-sm font-semibold text-gray-900">{accountManager.fullName}</div>
                      <div className="text-xs text-gray-500">{accountManager.username}</div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {assignedTLs.length > 0 ? (
                        <div className="flex flex-wrap gap-1 justify-center">
                          {assignedTLs.map(tl => (
                            <span key={tl.id} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-primary-light text-blue-800">
                              {tl.fullName}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {assignedQCs.length > 0 ? (
                        <div className="flex flex-wrap gap-1 justify-center">
                          {assignedQCs.map(qc => (
                            <span key={qc.id} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-primary-light text-blue-800">
                              {qc.fullName}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {assignedITs.length > 0 ? (
                        <div className="flex flex-wrap gap-1 justify-center">
                          {assignedITs.map(it => (
                            <span key={it.id} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-teal-100 text-teal-800">
                              {it.fullName}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-800">
                        {assignedTLs.length + assignedQCs.length + assignedITs.length}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleAMChange(accountManager.id)}
                        className="text-primary hover:text-blue-800 text-xs font-semibold"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            {assignments.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                No Account Managers found
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default AccountManagerManagement;





