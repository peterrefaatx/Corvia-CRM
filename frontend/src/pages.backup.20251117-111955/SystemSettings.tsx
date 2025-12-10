import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout/Layout';
import api from '../services/api';

interface Settings {
  workSchedule: any;
  leadManagement: any;
  serialNumber: any;
  dashboard: any;
  dataRetention: any;
  company: any;
  backup: any;
}

const SystemSettings: React.FC = () => {
  const [activeTab, setActiveTab] = useState('workSchedule');
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const response = await api.get('/settings');
      setSettings(response.data);
    } catch (error) {
      console.error('Failed to load settings:', error);
      setMessage('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    try {
      setSaving(true);
      await api.post('/settings/bulk', { settings });
      setMessage('Settings saved successfully!');
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      console.error('Failed to save settings:', error);
      setMessage('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = (category: string, key: string, value: any) => {
    setSettings(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        [category]: {
          ...prev[category as keyof Settings],
          [key]: value
        }
      };
    });
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-600"></div>
        </div>
      </Layout>
    );
  }

  if (!settings) {
    return (
      <Layout>
        <div className="text-center py-12">
          <p className="text-red-600">Failed to load settings</p>
        </div>
      </Layout>
    );
  }

  const tabs = [
    { id: 'workSchedule', label: 'Work Schedule', icon: 'clock' },
    { id: 'leadManagement', label: 'Lead Management', icon: 'clipboard' },
    { id: 'serialNumber', label: 'Serial Number', icon: 'hashtag' },
    { id: 'dashboard', label: 'Dashboard', icon: 'chart' },
    { id: 'dataRetention', label: 'Data Retention', icon: 'database' },
    { id: 'company', label: 'Company Info', icon: 'building' },
    { id: 'backup', label: 'Backup', icon: 'save' }
  ];

  const getIcon = (iconName: string) => {
    switch(iconName) {
      case 'clock':
        return <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />;
      case 'clipboard':
        return <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />;
      case 'hashtag':
        return <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />;
      case 'chart':
        return <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />;
      case 'database':
        return <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />;
      case 'building':
        return <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />;
      case 'save':
        return <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />;
      default:
        return null;
    }
  };

  return (
    <Layout>
      <div className="py-8 px-4 sm:px-6 lg:px-8" style={{ backgroundColor: '#f7f6f5' }}>
        <div className="mb-8">
          <button
            onClick={() => window.history.back()}
            className="flex items-center text-slate-600 hover:text-slate-900 transition-colors mb-6"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="text-sm font-semibold">Back</span>
          </button>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">System Settings</h1>
          <p className="text-slate-600">Configure system-wide settings and preferences</p>
        </div>

        {message && (
          <div className={`mb-6 p-4 rounded-xl border ${message.includes('success') ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
            <div className="flex items-center">
              <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {message.includes('success') ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                )}
              </svg>
              <span className="font-medium">{message}</span>
            </div>
          </div>
        )}

        <div className="flex gap-6">
          {/* Sidebar */}
          <div className="w-72 flex-shrink-0">
            <div className="bg-white rounded-xl border border-slate-100 p-3">
              <nav className="space-y-1">
                {tabs.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full text-left px-4 py-3 rounded-lg transition-all flex items-center space-x-3 ${
                      activeTab === tab.id
                        ? 'bg-indigo-50 text-indigo-700 border-l-4 border-indigo-600'
                        : 'text-slate-700 hover:bg-slate-50 border-l-4 border-transparent'
                    }`}
                  >
                    <svg className={`w-5 h-5 flex-shrink-0 ${activeTab === tab.id ? 'text-indigo-600' : 'text-slate-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      {getIcon(tab.icon)}
                    </svg>
                    <span className="font-medium">{tab.label}</span>
                  </button>
                ))}
              </nav>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1">
            <div className="bg-white rounded-xl border border-slate-100 p-8">
              {activeTab === 'workSchedule' && (
                <WorkScheduleSettings 
                  settings={settings.workSchedule} 
                  onChange={(key, value) => updateSetting('workSchedule', key, value)}
                />
              )}
              {activeTab === 'leadManagement' && (
                <LeadManagementSettings 
                  settings={settings.leadManagement} 
                  onChange={(key, value) => updateSetting('leadManagement', key, value)}
                />
              )}
              {activeTab === 'serialNumber' && (
                <SerialNumberSettings 
                  settings={settings.serialNumber} 
                  onChange={(key, value) => updateSetting('serialNumber', key, value)}
                />
              )}
              {activeTab === 'dashboard' && (
                <DashboardSettings 
                  settings={settings.dashboard} 
                  onChange={(key, value) => updateSetting('dashboard', key, value)}
                />
              )}
              {activeTab === 'dataRetention' && (
                <DataRetentionSettings 
                  settings={settings.dataRetention} 
                  onChange={(key, value) => updateSetting('dataRetention', key, value)}
                />
              )}
              {activeTab === 'company' && (
                <CompanySettings 
                  settings={settings.company} 
                  onChange={(key, value) => updateSetting('company', key, value)}
                />
              )}
              {activeTab === 'backup' && (
                <BackupSettings 
                  settings={settings.backup} 
                  onChange={(key, value) => updateSetting('backup', key, value)}
                />
              )}

              <div className="mt-8 pt-6 border-t border-slate-200 flex justify-end gap-3">
                <button
                  onClick={loadSettings}
                  className="px-6 py-2.5 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 font-medium transition-colors"
                >
                  Reset
                </button>
                <button
                  onClick={saveSettings}
                  disabled={saving}
                  className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors flex items-center space-x-2"
                >
                  {saving ? (
                    <>
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Save Changes</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

// Work Schedule Settings Component
const WorkScheduleSettings: React.FC<{ settings: any; onChange: (key: string, value: any) => void }> = ({ settings, onChange }) => (
  <div>
    <h2 className="text-2xl font-bold text-slate-900 mb-6">Work Schedule Configuration</h2>
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-2">Work Start Time</label>
        <input
          type="time"
          value={settings.workStartTime}
          onChange={(e) => onChange('workStartTime', e.target.value)}
          className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
        />
      </div>
      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-2">Work End Time</label>
        <input
          type="time"
          value={settings.workEndTime}
          onChange={(e) => onChange('workEndTime', e.target.value)}
          className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
        />
      </div>
      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-2">Daily Reset Time</label>
        <input
          type="time"
          value={settings.dailyResetTime}
          onChange={(e) => onChange('dailyResetTime', e.target.value)}
          className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
        />
      </div>
      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-2">Timezone</label>
        <select
          value={settings.timezone}
          onChange={(e) => onChange('timezone', e.target.value)}
          className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
        >
          <option value="Africa/Cairo">Egypt (Africa/Cairo)</option>
          <option value="America/New_York">New York</option>
          <option value="Europe/London">London</option>
          <option value="Asia/Dubai">Dubai</option>
        </select>
      </div>
    </div>
  </div>
);

// Lead Management Settings Component
const LeadManagementSettings: React.FC<{ settings: any; onChange: (key: string, value: any) => void }> = ({ settings, onChange }) => (
  <div>
    <h2 className="text-2xl font-bold text-slate-900 mb-6">Lead Management Rules</h2>
    <div className="space-y-4">
      <label className="flex items-center p-3 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors">
        <input
          type="checkbox"
          checked={settings.pendingPersist}
          onChange={(e) => onChange('pendingPersist', e.target.checked)}
          className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
        />
        <span className="ml-3 text-slate-700 font-medium">Pending leads persist across daily resets</span>
      </label>
      <label className="flex items-center p-3 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors">
        <input
          type="checkbox"
          checked={settings.callbackPersist}
          onChange={(e) => onChange('callbackPersist', e.target.checked)}
          className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
        />
        <span className="ml-3 text-slate-700 font-medium">Callback leads persist across daily resets</span>
      </label>
      <label className="flex items-center p-3 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors">
        <input
          type="checkbox"
          checked={settings.duplicateCheckPhone}
          onChange={(e) => onChange('duplicateCheckPhone', e.target.checked)}
          className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
        />
        <span className="ml-3 text-slate-700 font-medium">Check phone numbers for duplicates</span>
      </label>
      <label className="flex items-center p-3 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors">
        <input
          type="checkbox"
          checked={settings.duplicateCheckAddress}
          onChange={(e) => onChange('duplicateCheckAddress', e.target.checked)}
          className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
        />
        <span className="ml-3 text-slate-700 font-medium">Check addresses for duplicates</span>
      </label>
      <label className="flex items-center p-3 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors">
        <input
          type="checkbox"
          checked={settings.normalizePhone}
          onChange={(e) => onChange('normalizePhone', e.target.checked)}
          className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
        />
        <span className="ml-3 text-slate-700 font-medium">Normalize phone numbers (remove +1, formatting)</span>
      </label>
    </div>
  </div>
);

// Serial Number Settings Component
const SerialNumberSettings: React.FC<{ settings: any; onChange: (key: string, value: any) => void }> = ({ settings, onChange }) => {
  const generatePreview = () => {
    const prefix = settings.prefix || 'CORV';
    const separator = settings.separator || '';
    const digits = settings.counterDigits || 4;
    const dateStr = new Date().toISOString().slice(0,10).replace(/-/g,'');
    const counter = '0'.repeat(Math.max(0, digits - 1)) + '1';
    return `${prefix}${separator}${dateStr}${separator}${counter}`;
  };

  const generateExamples = () => {
    const prefix = settings.prefix || 'CORV';
    const separator = settings.separator || '';
    const digits = settings.counterDigits || 4;
    const dateStr = new Date().toISOString().slice(0,10).replace(/-/g,'');
    
    return [
      { label: 'First of day', value: `${prefix}${separator}${dateStr}${separator}${'0'.repeat(Math.max(0, digits - 1))}1` },
      { label: 'Example #10', value: `${prefix}${separator}${dateStr}${separator}${'0'.repeat(Math.max(0, digits - 2))}10` },
      { label: 'Example #100', value: `${prefix}${separator}${dateStr}${separator}${'0'.repeat(Math.max(0, digits - 3))}100` },
    ];
  };
  
  return (
    <div>
      <h2 className="text-2xl font-bold text-slate-900 mb-6">Serial Number Format</h2>
      <p className="text-slate-600 mb-6">Configure how serial numbers are generated for leads and records</p>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Configuration Panel */}
        <div className="space-y-6">
          <div className="border border-slate-200 rounded-xl p-6 bg-white">
            <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center space-x-2">
              <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
              <span>Format Configuration</span>
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Prefix
                  <span className="text-slate-500 font-normal ml-2">(e.g., CORV, LEAD, CRM)</span>
                </label>
                <input
                  type="text"
                  value={settings.prefix || ''}
                  onChange={(e) => onChange('prefix', e.target.value.toUpperCase())}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors font-mono"
                  placeholder="CORV"
                  maxLength={10}
                />
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Separator
                  <span className="text-slate-500 font-normal ml-2">(optional: -, _, . or leave empty)</span>
                </label>
                <input
                  type="text"
                  value={settings.separator || ''}
                  onChange={(e) => onChange('separator', e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors font-mono"
                  placeholder="Leave empty for no separator"
                  maxLength={3}
                />
                {!settings.separator && (
                  <p className="text-xs text-green-600 mt-1.5 flex items-center">
                    <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    No separator - compact format
                  </p>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Counter Digits
                  <span className="text-slate-500 font-normal ml-2">(1-8 digits)</span>
                </label>
                <div className="flex items-center space-x-3">
                  <input
                    type="range"
                    value={settings.counterDigits || 4}
                    onChange={(e) => onChange('counterDigits', parseInt(e.target.value))}
                    className="flex-1"
                    min="1"
                    max="8"
                  />
                  <input
                    type="number"
                    value={settings.counterDigits || 4}
                    onChange={(e) => onChange('counterDigits', parseInt(e.target.value) || 4)}
                    className="w-20 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors text-center font-bold"
                    min="1"
                    max="8"
                  />
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  Max capacity: {Math.pow(10, settings.counterDigits || 4).toLocaleString()} records per day
                </p>
              </div>
            </div>
          </div>

          <div className="border border-slate-200 rounded-xl p-6 bg-white">
            <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center space-x-2">
              <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>Reset Options</span>
            </h3>
            
            <div className="space-y-3">
              <label className="flex items-start p-3 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={settings.resetDaily || false}
                  onChange={(e) => onChange('resetDaily', e.target.checked)}
                  className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 mt-0.5"
                />
                <div className="ml-3">
                  <span className="text-slate-900 font-semibold block">Reset counter daily</span>
                  <span className="text-sm text-slate-600">Counter resets to 1 at the start of each day</span>
                </div>
              </label>
              
              <label className="flex items-start p-3 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={settings.resetMonthly || false}
                  onChange={(e) => onChange('resetMonthly', e.target.checked)}
                  className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 mt-0.5"
                />
                <div className="ml-3">
                  <span className="text-slate-900 font-semibold block">Reset counter monthly</span>
                  <span className="text-sm text-slate-600">Counter resets to 1 at the start of each month</span>
                </div>
              </label>
            </div>
          </div>
        </div>

        {/* Preview Panel */}
        <div className="space-y-6">
          <div className="border border-indigo-200 rounded-xl overflow-hidden bg-gradient-to-br from-indigo-50 to-blue-50">
            <div className="bg-indigo-600 px-6 py-4">
              <h3 className="text-lg font-bold text-white flex items-center space-x-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                <span>Live Preview</span>
              </h3>
            </div>
            <div className="p-6">
              <div className="bg-white rounded-lg p-6 border-2 border-indigo-300 mb-4">
                <p className="text-sm font-semibold text-slate-600 mb-3">Current Format:</p>
                <p className="text-3xl font-mono font-bold text-indigo-700 break-all">{generatePreview()}</p>
              </div>
              
              <div className="space-y-3">
                <p className="text-sm font-semibold text-slate-700">Examples:</p>
                {generateExamples().map((example, index) => (
                  <div key={index} className="bg-white rounded-lg p-4 border border-slate-200">
                    <p className="text-xs font-semibold text-slate-500 mb-1">{example.label}</p>
                    <p className="text-lg font-mono font-bold text-slate-700 break-all">{example.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="border border-amber-200 rounded-xl p-5 bg-amber-50">
            <div className="flex items-start space-x-3">
              <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="text-sm font-semibold text-amber-900 mb-1">Format Structure</p>
                <p className="text-sm text-amber-800">
                  <span className="font-mono font-bold">[PREFIX]</span>
                  {settings.separator && (
                    <>
                      <span className="mx-1">+</span>
                      <span className="font-mono font-bold">[SEPARATOR]</span>
                    </>
                  )}
                  <span className="mx-1">+</span>
                  <span className="font-mono font-bold">[DATE]</span>
                  {settings.separator && (
                    <>
                      <span className="mx-1">+</span>
                      <span className="font-mono font-bold">[SEPARATOR]</span>
                    </>
                  )}
                  <span className="mx-1">+</span>
                  <span className="font-mono font-bold">[COUNTER]</span>
                </p>
                {!settings.separator && (
                  <p className="text-xs text-amber-700 mt-2 italic">
                    Compact format: No separators between components
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Dashboard Settings Component  
const DashboardSettings: React.FC<{ settings: any; onChange: (key: string, value: any) => void }> = ({ settings, onChange }) => {
  const updateNestedSetting = (parent: string, key: string, value: boolean) => {
    const updated = { ...settings[parent], [key]: value };
    onChange(parent, updated);
  };

  const updateTargetLevel = (role: string, level: string, value: number) => {
    const currentTargetLevels = settings.targetLevels || {};
    const updated = {
      ...currentTargetLevels,
      [role]: {
        ...currentTargetLevels[role],
        [level]: value
      }
    };
    onChange('targetLevels', updated);
  };

  const updateLevelName = (role: string, level: string, value: string) => {
    const currentLevelNames = settings.levelNames || {};
    const updated = {
      ...currentLevelNames,
      [role]: {
        ...currentLevelNames[role],
        [level]: value
      }
    };
    onChange('levelNames', updated);
  };

  const levelColors = [
    { color: '#cd7f32', name: 'Bronze' },
    { color: '#c0c0c0', name: 'Silver' },
    { color: '#ffd700', name: 'Gold' },
    { color: '#e5e4e2', name: 'Platinum' }
  ];

  return (
    <div>
      <h2 className="text-2xl font-bold text-slate-900 mb-6">Dashboard Configuration</h2>
      <div className="space-y-8">
        {/* Agent Progress Bar Configuration */}
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <div className="bg-slate-50 px-6 py-4 border-b border-slate-200">
            <div className="flex items-center space-x-3">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Agent Progress Targets</h3>
                <p className="text-sm text-slate-600">Configure target levels and milestone names for Agent dashboard</p>
              </div>
            </div>
          </div>
          <div className="p-6 bg-white">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {['level1', 'level2', 'level3', 'level4'].map((level, index) => (
                <div key={level} className="bg-slate-50 p-5 rounded-lg border border-slate-200">
                  <div className="flex items-center space-x-2 mb-4">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: levelColors[index].color }}></div>
                    <label className="text-sm font-bold text-slate-900">Level {index + 1}</label>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5">Milestone Name</label>
                      <input
                        type="text"
                        value={settings.levelNames?.agent?.[level] || levelColors[index].name.toUpperCase()}
                        onChange={(e) => updateLevelName('agent', level, e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm font-medium transition-colors"
                        placeholder="Name"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5">Target Value</label>
                      <input
                        type="number"
                        value={settings.targetLevels?.agent?.[level] || (40 + index * 20)}
                        onChange={(e) => updateTargetLevel('agent', level, parseInt(e.target.value) || 0)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm font-medium transition-colors"
                        min="0"
                        placeholder="Target"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Senior Agent Progress Bar Configuration */}
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <div className="bg-slate-50 px-6 py-4 border-b border-slate-200">
            <div className="flex items-center space-x-3">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
              </svg>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Senior Agent Progress Targets</h3>
                <p className="text-sm text-slate-600">Configure target levels and milestone names for Senior Agent dashboard</p>
              </div>
            </div>
          </div>
          <div className="p-6 bg-white">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {['level1', 'level2', 'level3', 'level4'].map((level, index) => (
                <div key={level} className="bg-slate-50 p-5 rounded-lg border border-slate-200">
                  <div className="flex items-center space-x-2 mb-4">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: levelColors[index].color }}></div>
                    <label className="text-sm font-bold text-slate-900">Level {index + 1}</label>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5">Milestone Name</label>
                      <input
                        type="text"
                        value={settings.levelNames?.seniorAgent?.[level] || levelColors[index].name.toUpperCase()}
                        onChange={(e) => updateLevelName('seniorAgent', level, e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm font-medium transition-colors"
                        placeholder="Name"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5">Target Value</label>
                      <input
                        type="number"
                        value={settings.targetLevels?.seniorAgent?.[level] || (60 + index * 20)}
                        onChange={(e) => updateTargetLevel('seniorAgent', level, parseInt(e.target.value) || 0)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm font-medium transition-colors"
                        min="0"
                        placeholder="Target"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Visibility Settings */}
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <div className="bg-slate-50 px-6 py-4 border-b border-slate-200">
            <div className="flex items-center space-x-3">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Dashboard Visibility</h3>
                <p className="text-sm text-slate-600">Control which stat cards appear on agent dashboards</p>
              </div>
            </div>
          </div>
          <div className="p-6 bg-white">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Today's Performance */}
              <div>
                <h4 className="text-sm font-bold text-slate-900 mb-3">Today's Performance</h4>
                <div className="space-y-1">
                  {Object.keys(settings.todayPerformance).map(key => (
                    <label key={key} className="flex items-center p-2.5 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors group">
                      <input
                        type="checkbox"
                        checked={settings.todayPerformance[key]}
                        onChange={(e) => updateNestedSetting('todayPerformance', key, e.target.checked)}
                        className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                      />
                      <span className="ml-3 text-sm text-slate-700 font-medium capitalize group-hover:text-slate-900">
                        {key.replace('show', '').replace(/([A-Z])/g, ' $1').trim()}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
              
              {/* Monthly Overview */}
              <div>
                <h4 className="text-sm font-bold text-slate-900 mb-3">Monthly Overview</h4>
                <div className="space-y-1">
                  {Object.keys(settings.monthlyOverview).map(key => (
                    <label key={key} className="flex items-center p-2.5 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors group">
                      <input
                        type="checkbox"
                        checked={settings.monthlyOverview[key]}
                        onChange={(e) => updateNestedSetting('monthlyOverview', key, e.target.checked)}
                        className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                      />
                      <span className="ml-3 text-sm text-slate-700 font-medium capitalize group-hover:text-slate-900">
                        {key.replace('show', '').replace(/([A-Z])/g, ' $1').trim()}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Data Retention Settings Component
const DataRetentionSettings: React.FC<{ settings: any; onChange: (key: string, value: any) => void }> = ({ settings, onChange }) => (
  <div>
    <h2 className="text-2xl font-bold text-slate-900 mb-6">Data Retention Policy</h2>
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-2">Keep Qualified Leads (days)</label>
        <input
          type="number"
          value={settings.qualifiedDays}
          onChange={(e) => onChange('qualifiedDays', parseInt(e.target.value))}
          className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
        />
      </div>
      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-2">Keep Disqualified Leads (days)</label>
        <input
          type="number"
          value={settings.disqualifiedDays}
          onChange={(e) => onChange('disqualifiedDays', parseInt(e.target.value))}
          className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
        />
      </div>
      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-2">Keep Duplicate Leads (days)</label>
        <input
          type="number"
          value={settings.duplicateDays}
          onChange={(e) => onChange('duplicateDays', parseInt(e.target.value))}
          className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
        />
      </div>
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-800 font-medium">Note: 0 = Keep forever</p>
      </div>
      <label className="flex items-center p-3 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors">
        <input
          type="checkbox"
          checked={settings.autoArchive}
          onChange={(e) => onChange('autoArchive', e.target.checked)}
          className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
        />
        <span className="ml-3 text-slate-700 font-medium">Auto-archive old leads</span>
      </label>
    </div>
  </div>
);

// Company Settings Component
const CompanySettings: React.FC<{ settings: any; onChange: (key: string, value: any) => void }> = ({ settings, onChange }) => (
  <div>
    <h2 className="text-2xl font-bold text-slate-900 mb-6">Company Information</h2>
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-2">Company Name</label>
        <input
          type="text"
          value={settings.name}
          onChange={(e) => onChange('name', e.target.value)}
          className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
        />
      </div>
      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-2">Primary Color</label>
        <input
          type="color"
          value={settings.primaryColor}
          onChange={(e) => onChange('primaryColor', e.target.value)}
          className="w-full h-12 border border-slate-300 rounded-lg cursor-pointer"
        />
      </div>
      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-2">Email</label>
        <input
          type="email"
          value={settings.email}
          onChange={(e) => onChange('email', e.target.value)}
          className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
        />
      </div>
      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-2">Phone</label>
        <input
          type="tel"
          value={settings.phone}
          onChange={(e) => onChange('phone', e.target.value)}
          className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
        />
      </div>
      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-2">Currency</label>
        <select
          value={settings.currency}
          onChange={(e) => onChange('currency', e.target.value)}
          className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
        >
          <option value="EGP">Egyptian Pound (EGP)</option>
          <option value="USD">US Dollar (USD)</option>
          <option value="EUR">Euro (EUR)</option>
        </select>
      </div>
    </div>
  </div>
);

// Backup Settings Component
const BackupSettings: React.FC<{ settings: any; onChange: (key: string, value: any) => void }> = ({ settings, onChange }) => (
  <div>
    <h2 className="text-2xl font-bold text-slate-900 mb-6">Backup & Maintenance</h2>
    <div className="space-y-6">
      <label className="flex items-center p-3 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors">
        <input
          type="checkbox"
          checked={settings.autoBackup}
          onChange={(e) => onChange('autoBackup', e.target.checked)}
          className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
        />
        <span className="ml-3 text-slate-700 font-medium">Enable automatic daily backup</span>
      </label>
      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-2">Backup Time</label>
        <input
          type="time"
          value={settings.backupTime}
          onChange={(e) => onChange('backupTime', e.target.value)}
          className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
        />
      </div>
      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-2">Keep Backups (days)</label>
        <input
          type="number"
          value={settings.keepBackupDays}
          onChange={(e) => onChange('keepBackupDays', parseInt(e.target.value))}
          className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
        />
      </div>
      {settings.lastBackup && (
        <div className="p-5 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-sm font-semibold text-green-900 mb-1">Last Backup:</p>
          <p className="text-green-700 font-medium">{new Date(settings.lastBackup).toLocaleString()}</p>
        </div>
      )}
      <button className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium transition-colors flex items-center space-x-2">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
        </svg>
        <span>Backup Now</span>
      </button>
    </div>
  </div>
);

export default SystemSettings;
