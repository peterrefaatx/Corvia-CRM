import React, { useState, useEffect } from 'react';
import {
  Database,
  RefreshCw,
  Trash2,
  RotateCcw,
  AlertCircle,
  CheckCircle,
  Clock
} from 'lucide-react';
import api from '../services/api';
import Layout from '../components/Layout/Layout';
import { useToast } from '../contexts/ToastContext';

interface BackupMetadata {
  timestamp: string;
  type: 'daily' | 'monthly' | 'yearly' | 'manual';
  size: number;
  checksum: string;
  recordCounts: Record<string, number>;
  version: string;
}

interface BackupInfo {
  path: string;
  type: 'daily' | 'monthly' | 'yearly';
  date: string;
  metadata: BackupMetadata;
  folderName: string;
}

interface RestoreJob {
  status: 'running' | 'completed' | 'failed';
  message: string;
  progress: number;
  currentStep: string;
  startedAt: string;
  completedAt?: string;
  safetyBackup?: string;
  error?: string;
  result?: any;
}

interface BackupSettings {
  enabled: boolean;
  dailyTime: string;
  retentionDays: number;
  retentionMonths: number;
  retentionYears: number;
}

const BackupRestore: React.FC = () => {
  const { showToast } = useToast();
  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [restoreDialog, setRestoreDialog] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [backupToDelete, setBackupToDelete] = useState<BackupInfo | null>(null);
  const [selectedBackup, setSelectedBackup] = useState<BackupInfo | null>(null);
  const [restoreJob, setRestoreJob] = useState<RestoreJob | null>(null);
  const [restoreJobId, setRestoreJobId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'backups' | 'settings'>('backups');
  const [settings, setSettings] = useState<BackupSettings>({
    enabled: true,
    dailyTime: '04:00',
    retentionDays: 30,
    retentionMonths: 12,
    retentionYears: 5
  });

  useEffect(() => {
    loadBackups();
    loadSettings();
  }, []);

  useEffect(() => {
    if (restoreJobId) {
      const interval = setInterval(() => {
        checkRestoreStatus(restoreJobId);
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [restoreJobId]);

  const loadBackups = async () => {
    setLoading(true);
    try {
      const response = await api.get('/backup/list');
      setBackups(response.data.backups);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load backups');
    } finally {
      setLoading(false);
    }
  };

  const loadSettings = async () => {
    try {
      const response = await api.get('/backup/settings');
      setSettings(response.data.settings);
    } catch (err: any) {
      console.error('Failed to load settings:', err);
    }
  };

  const saveSettings = async () => {
    try {
      await api.put('/backup/settings', settings);
      setSuccess('Settings saved successfully');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save settings');
    }
  };

  const createBackup = async () => {
    setCreating(true);
    setError(null);
    setSuccess(null);
    try {
      await api.post('/backup/create', {});
      setSuccess('Backup created successfully');
      loadBackups();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create backup');
    } finally {
      setCreating(false);
    }
  };

  const deleteBackup = async (backup: BackupInfo) => {
    setBackupToDelete(backup);
    setDeleteDialog(true);
  };

  const confirmDelete = async () => {
    if (!backupToDelete) return;

    try {
      await api.delete(`/backup/${backupToDelete.type}/${backupToDelete.folderName}`);
      showToast('Backup deleted successfully', 'success');
      setDeleteDialog(false);
      setBackupToDelete(null);
      loadBackups();
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to delete backup', 'error');
    }
  };

  const startRestore = async (backup: BackupInfo) => {
    setSelectedBackup(backup);
    setRestoreDialog(true);
  };

  const confirmRestore = async () => {
    if (!selectedBackup) return;

    setRestoreDialog(false);
    setError(null);
    setSuccess(null);
    setRestoreJob(null);
    setRestoreJobId(null);

    try {
      const response = await api.post(
        `/backup/restore/${selectedBackup.type}/${selectedBackup.folderName}`,
        {}
      );

      setRestoreJobId(response.data.jobId);
      setSuccess('Restore started. Monitoring progress...');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to start restore');
    }
  };

  const checkRestoreStatus = async (jobId: string) => {
    try {
      const response = await api.get(`/backup/restore-status/${jobId}`);

      setRestoreJob(response.data);

      if (response.data.status === 'completed') {
        setRestoreJobId(null);
        setSuccess('Restore completed successfully!');
        loadBackups();
      } else if (response.data.status === 'failed') {
        setRestoreJobId(null);
        setError(`Restore failed: ${response.data.error}`);
      }
    } catch (err: any) {
      console.error('Failed to check restore status:', err);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'daily': return 'bg-primary-light text-primary';
      case 'monthly': return 'bg-purple-100 text-purple-800';
      case 'yearly': return 'bg-green-100 text-green-800';
      case 'manual': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Layout>
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Backup & Restore</h1>
          <div className="flex gap-3">
            <button
              onClick={loadBackups}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
            <button
              onClick={createBackup}
              disabled={creating}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg bg-primary-hover disabled:opacity-50"
            >
              <Database className="w-4 h-4" />
              {creating ? 'Creating...' : 'Run Backup Now'}
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-red-800">{error}</p>
            </div>
            <button onClick={() => setError(null)} className="text-red-600 hover:text-red-800">×</button>
          </div>
        )}

        {success && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-green-800">{success}</p>
            </div>
            <button onClick={() => setSuccess(null)} className="text-green-600 hover:text-green-800">×</button>
          </div>
        )}

        {restoreJob && restoreJob.status === 'running' && (
          <div className="mb-4 p-4 bg-primary-light border border-primary200 rounded-lg">
            <div className="flex items-center gap-3 mb-2">
              <Clock className="w-5 h-5 text-primary animate-spin" />
              <h3 className="font-semibold text-primary">Restore in Progress</h3>
            </div>
            <p className="text-sm text-primary mb-2">{restoreJob.currentStep}</p>
            <div className="w-full bg-primary-light rounded-full h-2">
              <div
                className="bg-primary h-2 rounded-full transition-all duration-300"
                style={{ width: `${restoreJob.progress}%` }}
              />
            </div>
            <p className="text-xs text-primary mt-1">{restoreJob.progress}% - {restoreJob.message}</p>
          </div>
        )}

        <div className="mb-4 border-b border-gray-200">
          <div className="flex gap-4">
            <button
              onClick={() => setActiveTab('backups')}
              className={`px-4 py-2 font-medium border-b-2 transition-colors ${
                activeTab === 'backups'
                  ? 'border-blue-600 text-primary'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Backups
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`px-4 py-2 font-medium border-b-2 transition-colors ${
                activeTab === 'settings'
                  ? 'border-blue-600 text-primary'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Settings
            </button>
          </div>
        </div>

        {activeTab === 'backups' && (
          <div className="space-y-6">
            {loading ? (
              <div className="bg-white rounded-lg shadow p-12 text-center">
                <div className="flex justify-center">
                  <RefreshCw className="w-8 h-8 text-primary animate-spin" />
                </div>
              </div>
            ) : (
              <>
                {/* Daily Backups */}
                <div className="bg-white rounded-lg shadow overflow-hidden">
                  <div className="bg-primary-light px-6 py-3 border-b border-primary100">
                    <h3 className="text-lg font-semibold text-primary flex items-center gap-2">
                      <span className="px-2 py-1 text-xs font-semibold rounded-full bg-primary-light text-primary">DAILY</span>
                      Daily Backups ({backups.filter(b => b.type === 'daily').length})
                    </h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Timestamp</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Size</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Records</th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {backups.filter(b => b.type === 'daily').length === 0 ? (
                          <tr>
                            <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                              No daily backups found
                            </td>
                          </tr>
                        ) : (
                          backups.filter(b => b.type === 'daily').map((backup) => (
                            <tr key={backup.path} className="hover:bg-gray-50">
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{backup.date}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatDate(backup.metadata.timestamp)}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{formatBytes(backup.metadata.size)}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {Object.values(backup.metadata.recordCounts).reduce((a, b) => a + b, 0)}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                <button
                                  onClick={() => startRestore(backup)}
                                  className="text-primary hover:text-blue-900 mr-3"
                                  title="Restore"
                                >
                                  <RotateCcw className="w-5 h-5" />
                                </button>
                                <button
                                  onClick={() => deleteBackup(backup)}
                                  className="text-red-600 hover:text-red-900"
                                  title="Delete"
                                >
                                  <Trash2 className="w-5 h-5" />
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Monthly Backups */}
                <div className="bg-white rounded-lg shadow overflow-hidden">
                  <div className="bg-purple-50 px-6 py-3 border-b border-purple-100">
                    <h3 className="text-lg font-semibold text-purple-900 flex items-center gap-2">
                      <span className="px-2 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-800">MONTHLY</span>
                      Monthly Backups ({backups.filter(b => b.type === 'monthly').length})
                    </h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Month</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Timestamp</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Size</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Records</th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {backups.filter(b => b.type === 'monthly').length === 0 ? (
                          <tr>
                            <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                              No monthly backups found
                            </td>
                          </tr>
                        ) : (
                          backups.filter(b => b.type === 'monthly').map((backup) => (
                            <tr key={backup.path} className="hover:bg-gray-50">
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{backup.date}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatDate(backup.metadata.timestamp)}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{formatBytes(backup.metadata.size)}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {Object.values(backup.metadata.recordCounts).reduce((a, b) => a + b, 0)}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                <button
                                  onClick={() => startRestore(backup)}
                                  className="text-primary hover:text-blue-900 mr-3"
                                  title="Restore"
                                >
                                  <RotateCcw className="w-5 h-5" />
                                </button>
                                <button
                                  onClick={() => deleteBackup(backup)}
                                  className="text-red-600 hover:text-red-900"
                                  title="Delete"
                                >
                                  <Trash2 className="w-5 h-5" />
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Yearly Backups */}
                <div className="bg-white rounded-lg shadow overflow-hidden">
                  <div className="bg-green-50 px-6 py-3 border-b border-green-100">
                    <h3 className="text-lg font-semibold text-green-900 flex items-center gap-2">
                      <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">YEARLY</span>
                      Yearly Backups ({backups.filter(b => b.type === 'yearly').length})
                    </h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Year</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Timestamp</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Size</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Records</th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {backups.filter(b => b.type === 'yearly').length === 0 ? (
                          <tr>
                            <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                              No yearly backups found
                            </td>
                          </tr>
                        ) : (
                          backups.filter(b => b.type === 'yearly').map((backup) => (
                            <tr key={backup.path} className="hover:bg-gray-50">
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{backup.date}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatDate(backup.metadata.timestamp)}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{formatBytes(backup.metadata.size)}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {Object.values(backup.metadata.recordCounts).reduce((a, b) => a + b, 0)}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                <button
                                  onClick={() => startRestore(backup)}
                                  className="text-primary hover:text-blue-900 mr-3"
                                  title="Restore"
                                >
                                  <RotateCcw className="w-5 h-5" />
                                </button>
                                <button
                                  onClick={() => deleteBackup(backup)}
                                  className="text-red-600 hover:text-red-900"
                                  title="Delete"
                                >
                                  <Trash2 className="w-5 h-5" />
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-6">Backup Settings</h2>
            <div className="space-y-6">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="enabled"
                  checked={settings.enabled}
                  onChange={(e) => setSettings({ ...settings, enabled: e.target.checked })}
                  className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="enabled" className="ml-2 text-sm font-medium text-gray-900">
                  Enable Automatic Backups
                </label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Daily Backup Time
                  </label>
                  <input
                    type="time"
                    value={settings.dailyTime}
                    onChange={(e) => setSettings({ ...settings, dailyTime: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  />
                  <p className="mt-1 text-xs text-gray-500">Time in Cairo timezone (24-hour format)</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Keep Daily Backups (days)
                  </label>
                  <input
                    type="number"
                    value={settings.retentionDays}
                    onChange={(e) => setSettings({ ...settings, retentionDays: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Keep Monthly Backups (months)
                  </label>
                  <input
                    type="number"
                    value={settings.retentionMonths}
                    onChange={(e) => setSettings({ ...settings, retentionMonths: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Keep Yearly Backups (years)
                  </label>
                  <input
                    type="number"
                    value={settings.retentionYears}
                    onChange={(e) => setSettings({ ...settings, retentionYears: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="pt-4">
                <button
                  onClick={saveSettings}
                  className="px-6 py-2 bg-primary text-white rounded-lg bg-primary-hover"
                >
                  Save Settings
                </button>
              </div>
            </div>
          </div>
        )}

        {restoreDialog && selectedBackup && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <h2 className="text-xl font-semibold mb-4">Confirm Restore</h2>
              <p className="text-gray-700 mb-4">
                Are you sure you want to restore this backup?
              </p>
              <div className="bg-gray-50 p-4 rounded-lg mb-4 space-y-2">
                <p className="text-sm"><strong>Type:</strong> {selectedBackup.type}</p>
                <p className="text-sm"><strong>Date:</strong> {selectedBackup.date}</p>
                <p className="text-sm"><strong>Timestamp:</strong> {formatDate(selectedBackup.metadata.timestamp)}</p>
              </div>
              <div className="bg-primary-light border border-primary200 rounded-lg p-4 mb-4">
                <p className="text-sm text-primary font-medium mb-2">Smart Merge Process:</p>
                <ul className="text-xs text-primary space-y-1 list-disc list-inside">
                  <li>A safety backup will be created first</li>
                  <li>Missing records will be inserted</li>
                  <li>Existing records updated only if backup is newer</li>
                  <li>No data will be deleted</li>
                </ul>
              </div>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setRestoreDialog(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmRestore}
                  className="px-4 py-2 bg-primary text-white rounded-lg bg-primary-hover"
                >
                  Restore
                </button>
              </div>
            </div>
          </div>
        )}

        {deleteDialog && backupToDelete && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <h2 className="text-xl font-semibold mb-4 text-red-600">Confirm Delete</h2>
              <p className="text-gray-700 mb-4">
                Are you sure you want to delete this backup? This action cannot be undone.
              </p>
              <div className="bg-gray-50 p-4 rounded-lg mb-4 space-y-2">
                <p className="text-sm"><strong>Type:</strong> {backupToDelete.type}</p>
                <p className="text-sm"><strong>Date:</strong> {backupToDelete.date}</p>
              </div>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => {
                    setDeleteDialog(false);
                    setBackupToDelete(null);
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default BackupRestore;





