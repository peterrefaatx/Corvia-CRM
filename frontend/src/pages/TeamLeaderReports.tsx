import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout/Layout';
import api from '../services/api';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { usePageTitle } from '../hooks/usePageTitle';
import { getRoleBadgeColor, getRoleShortLabel } from '../utils/roleBadgeColors';

interface AgentReport {
  id: string;
  fullName: string;
  role: string;
  score: number;
  totalLeads: number;
  qualified: number;
  disqualified: number;
  callback: number;
  duplicate: number;
  pushed: number;
}

interface AttendanceRecord {
  id: string;
  fullName: string;
  role: string;
  daysPresent: number;
  daysLate: number;
  totalLateness: number; // in minutes
  avgLoginTime: string;
}

const TeamLeaderReports: React.FC = () => {
  usePageTitle('Reports');
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'agents' | 'attendance'>('agents');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [loading, setLoading] = useState(false);
  
  const [agentReports, setAgentReports] = useState<AgentReport[]>([]);
  const [attendanceReports, setAttendanceReports] = useState<AttendanceRecord[]>([]);
  const [showAllTeams, setShowAllTeams] = useState(false);

  useEffect(() => {
    if (user?.role !== 'TeamLeader') {
      navigate('/');
    }
    // Set default date range to current month
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    setFromDate(firstDay.toISOString().split('T')[0]);
    setToDate(today.toISOString().split('T')[0]);
  }, [user, navigate]);

  useEffect(() => {
    if (fromDate && toDate) {
      loadReports();
    }
  }, [fromDate, toDate, activeTab, showAllTeams]);

  const loadReports = async () => {
    try {
      setLoading(true);
      const params = { from: fromDate, to: toDate };

      if (activeTab === 'agents') {
        const response = await api.get('/team-leader/reports/agents', { 
          params: { ...params, allTeams: showAllTeams ? 'true' : 'false' }
        });
        setAgentReports(response.data.agents || []);
      } else if (activeTab === 'attendance') {
        const response = await api.get('/team-leader/reports/attendance', { params });
        setAttendanceReports(response.data.attendance || []);
      }
    } catch (error) {
      console.error('Failed to load reports:', error);
    } finally {
      setLoading(false);
    }
  };

  const setQuickDate = (range: string) => {
    const today = new Date();
    let from = new Date();
    
    switch (range) {
      case 'today':
        from = today;
        break;
      case 'yesterday':
        from = new Date(today);
        from.setDate(from.getDate() - 1);
        setToDate(from.toISOString().split('T')[0]);
        break;
      case 'last7':
        from = new Date(today);
        from.setDate(from.getDate() - 7);
        break;
      case 'last30':
        from = new Date(today);
        from.setDate(from.getDate() - 30);
        break;
      case 'thisMonth':
        from = new Date(today.getFullYear(), today.getMonth(), 1);
        break;
    }
    
    setFromDate(from.toISOString().split('T')[0]);
    if (range !== 'yesterday') {
      setToDate(today.toISOString().split('T')[0]);
    }
  };

  const exportToCSV = () => {
    let csvContent = '';
    let filename = '';

    if (activeTab === 'agents') {
      // Agent Performance CSV
      csvContent = 'Score,Rank,Agent,Role,Qualified,Disqualified,Callback,Duplicate,Total,Pushed\n';
      const sortedAgents = [...agentReports].sort((a, b) => b.score - a.score);
      sortedAgents.forEach((agent, index) => {
        csvContent += `${agent.score},${index + 1},"${agent.fullName}",${agent.role},${agent.qualified},${agent.disqualified},${agent.callback},${agent.duplicate},${agent.totalLeads},${agent.pushed}\n`;
      });
      filename = `agent-performance-${fromDate}-to-${toDate}.csv`;
    } else if (activeTab === 'attendance') {
      // Attendance CSV
      csvContent = 'Agent,Role,Days Present,Days Late,Total Lateness (minutes),Avg Login Time\n';
      attendanceReports.forEach((record) => {
        csvContent += `"${record.fullName}",${record.role},${record.daysPresent},${record.daysLate},${record.totalLateness},"${record.avgLoginTime}"\n`;
      });
      filename = `attendance-${fromDate}-to-${toDate}.csv`;
    }

    // Create download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Title
    doc.setFontSize(16);
    doc.text('Team Leader Report', pageWidth / 2, 15, { align: 'center' });
    
    // Date range
    doc.setFontSize(10);
    doc.text(`Period: ${fromDate} to ${toDate}`, pageWidth / 2, 22, { align: 'center' });
    
    let filename = '';

    if (activeTab === 'agents') {
      // Agent Performance PDF
      doc.setFontSize(14);
      doc.text('Agent Performance Report', 14, 32);
      
      const sortedAgents = [...agentReports].sort((a, b) => b.score - a.score);
      const tableData = sortedAgents.map((agent, index) => [
        agent.score,
        index + 1,
        agent.fullName,
        agent.role === 'SeniorAgent' ? 'Senior' : 'Agent',
        agent.qualified,
        agent.disqualified,
        agent.callback,
        agent.duplicate,
        agent.totalLeads,
        agent.pushed
      ]);

      (doc as any).autoTable({
        startY: 38,
        head: [['Score', 'Rank', 'Agent', 'Role', 'Qualified', 'Disqualified', 'Callback', 'Duplicate', 'Total', 'Pushed']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [6, 182, 212] },
        styles: { fontSize: 8 }
      });
      
      filename = `agent-performance-${fromDate}-to-${toDate}.pdf`;
    } else if (activeTab === 'attendance') {
      // Attendance PDF
      doc.setFontSize(14);
      doc.text('Attendance Report', 14, 32);
      
      const tableData = attendanceReports.map((record) => [
        record.fullName,
        record.role === 'SeniorAgent' ? 'Senior' : 'Agent',
        record.daysPresent,
        record.daysLate,
        `${Math.floor(record.totalLateness / 60)}h ${record.totalLateness % 60}m`,
        record.avgLoginTime
      ]);

      (doc as any).autoTable({
        startY: 38,
        head: [['Agent', 'Role', 'Days Present', 'Days Late', 'Total Lateness', 'Avg Login Time']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [6, 182, 212] },
        styles: { fontSize: 9 }
      });
      
      filename = `attendance-${fromDate}-to-${toDate}.pdf`;
    }

    doc.save(filename);
  };

  if (loading && !agentReports.length && !attendanceReports.length) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#fafafa' }}><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="py-6 px-4 sm:px-6 lg:px-8" style={{ backgroundColor: '#F5F5F5' }}>
        {/* Date Range Selector with Export Buttons */}
        <div className="bg-white rounded-lg p-6 mb-6 shadow-sm">
          <div className="flex items-center justify-between">
            {/* Page Title */}
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">Reports</h1>
              <p className="text-sm text-gray-500 mt-1">Team performance and attendance analytics</p>
            </div>

            {/* Date Filter and Export Controls */}
            <div className="flex items-center gap-4">
              {/* Date Range Filter */}
            <div className="flex items-center gap-2 bg-gray-50 px-4 py-2 rounded-lg border border-gray-200">
              <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="bg-transparent border-none text-sm focus:outline-none focus:ring-0 p-0 w-[130px]"
              />
              <span className="text-gray-400">—</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="bg-transparent border-none text-sm focus:outline-none focus:ring-0 p-0 w-[130px]"
              />
            </div>

            {/* Export Buttons */}
            <div className="flex gap-2">
              <button
                onClick={exportToCSV}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-sm font-medium flex items-center gap-2 shadow-sm"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                CSV
              </button>
              <button
                onClick={exportToPDF}
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors text-sm font-medium flex items-center gap-2 shadow-sm"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                PDF
              </button>
            </div>
            </div>
          </div>
        </div>

        {/* Integrated Tabs and Content */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
          {/* Tab Headers */}
          <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
            <nav className="flex space-x-2" aria-label="Tabs">
              {[
                { id: 'agents', label: 'Agent Performance' },
                { id: 'attendance', label: 'Attendance' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`px-5 py-2 rounded-md font-medium text-sm transition-colors ${
                    activeTab === tab.id
                      ? 'bg-primary text-white'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Tab Content */}
          <div>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : (
              <>
                {/* Agent Performance Tab */}
                {activeTab === 'agents' && (
                  <>
                    {/* Toggle for All Teams */}
                    <div className="px-6 py-4 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <label className="flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={showAllTeams}
                            onChange={(e) => setShowAllTeams(e.target.checked)}
                            className="w-4 h-4 text-primary rounded focus:ring-blue-500"
                          />
                          <span className="ml-2 text-sm font-medium text-gray-700">
                            Show all teams
                          </span>
                        </label>
                        {showAllTeams && (
                          <span className="text-xs text-gray-500 italic">
                            (Showing agents from all teams)
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-100">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">Score</th>
                          <th className="px-6 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">Rank</th>
                          <th className="px-6 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">Agent</th>
                          <th className="px-6 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">Role</th>
                          <th className="px-6 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">Qualified</th>
                          <th className="px-6 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">Disqualified</th>
                          <th className="px-6 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">Callback</th>
                          <th className="px-6 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">Duplicate</th>
                          <th className="px-6 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">Total</th>
                          <th className="px-6 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">Pushed</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-100">
                        {agentReports
                          .sort((a, b) => b.score - a.score)
                          .map((agent, index) => (
                          <tr key={agent.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-black text-primary">{agent.score}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-bold text-gray-900">{index + 1}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-center">
                              <div className="text-sm font-medium text-gray-900 text-center">{agent.fullName}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-center">
                              <span className={`inline-flex items-center justify-center px-3 py-1 text-xs font-semibold rounded-full ${getRoleBadgeColor(agent.role)}`}>
                                {getRoleShortLabel(agent.role)}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-semibold text-green-600">{agent.qualified}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-semibold text-red-600">{agent.disqualified}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-semibold text-primary">{agent.callback}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-semibold text-gray-600">{agent.duplicate}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-semibold text-gray-900">{agent.totalLeads}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-semibold text-primary">{agent.pushed}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {agentReports.length === 0 && (
                      <div className="text-center py-12 text-gray-500">No data available for selected period</div>
                    )}
                    </div>
                  </>
                )}

                {/* Attendance Tab */}
                {activeTab === 'attendance' && (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-100">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">Agent</th>
                          <th className="px-6 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">Role</th>
                          <th className="px-6 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">Days Present</th>
                          <th className="px-6 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">Days Late</th>
                          <th className="px-6 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">Total Lateness</th>
                          <th className="px-6 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">Avg Login Time</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-100">
                        {attendanceReports.map((record) => (
                          <tr key={record.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap text-center">
                              <div className="text-sm font-medium text-gray-900">{record.fullName}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-center">
                              <span className={`inline-flex items-center justify-center px-3 py-1 text-xs font-semibold rounded-full ${getRoleBadgeColor(record.role)}`}>
                                {getRoleShortLabel(record.role)}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-semibold text-green-600">{record.daysPresent}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-semibold text-red-600">{record.daysLate}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-semibold text-orange-600">
                              {Math.floor(record.totalLateness / 60)}h {record.totalLateness % 60}m
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium text-gray-900">{record.avgLoginTime}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {attendanceReports.length === 0 && (
                      <div className="text-center py-12 text-gray-500">No attendance data available</div>
                    )}
                  </div>
                )}

              </>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default TeamLeaderReports;





