import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout/Layout';
import api from '../services/api';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

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
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-600"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="py-6 px-4 sm:px-6 lg:px-8" style={{ backgroundColor: '#F5F5F5' }}>
        {/* Date Range Selector */}
        <div className="bg-white rounded-lg p-6 mb-6 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">From Date</label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">To Date</label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
              />
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-sm mb-6">
          <div className="border-b border-gray-200">
            <div className="flex justify-between items-center px-6">
              <nav className="flex space-x-8" aria-label="Tabs">
                {[
                  { id: 'agents', label: 'Agent Performance' },
                  { id: 'attendance', label: 'Attendance' }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`py-4 px-1 border-b-2 font-medium text-sm ${
                      activeTab === tab.id
                        ? 'border-cyan-500 text-cyan-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </nav>
              
              {/* Export Buttons - Only show for agents and attendance tabs */}
              {(activeTab === 'agents' || activeTab === 'attendance') && (
                <div className="flex gap-2 py-2">
                  <button
                    onClick={exportToCSV}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Export CSV
                  </button>
                  <button
                    onClick={exportToPDF}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                    Export PDF
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-600"></div>
              </div>
            ) : (
              <>
                {/* Agent Performance Tab */}
                {activeTab === 'agents' && (
                  <>
                    {/* Toggle for All Teams */}
                    <div className="mb-4 flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <label className="flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={showAllTeams}
                            onChange={(e) => setShowAllTeams(e.target.checked)}
                            className="w-4 h-4 text-cyan-600 rounded focus:ring-cyan-500"
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
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead>
                        <tr>
                          <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Score</th>
                          <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Rank</th>
                          <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Agent</th>
                          <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Role</th>
                          <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Qualified</th>
                          <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Disqualified</th>
                          <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Callback</th>
                          <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Duplicate</th>
                          <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Total</th>
                          <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Pushed</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {agentReports
                          .sort((a, b) => b.score - a.score)
                          .map((agent, index) => (
                          <tr key={agent.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-black text-cyan-600">{agent.score}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-bold text-gray-900">{index + 1}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-center">
                              <div className="text-sm font-medium text-gray-900 text-center">{agent.fullName}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-center">
                              <span className={`role-badge inline-flex items-center justify-center px-3 py-1 text-xs font-medium rounded-full ${
                                agent.role === 'SeniorAgent' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
                              }`}>
                                {agent.role === 'SeniorAgent' ? 'Senior' : 'Agent'}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-semibold text-green-600">{agent.qualified}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-semibold text-red-600">{agent.disqualified}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-semibold text-blue-600">{agent.callback}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-semibold text-gray-600">{agent.duplicate}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-semibold text-gray-900">{agent.totalLeads}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-semibold text-purple-600">{agent.pushed}</td>
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
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead>
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Agent</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Days Present</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Days Late</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Lateness</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Avg Login Time</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {attendanceReports.map((record) => (
                          <tr key={record.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-medium text-gray-900">{record.fullName}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`role-badge inline-flex items-center justify-center px-3 py-1 text-xs font-medium rounded-full ${
                                record.role === 'SeniorAgent' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
                              }`}>
                                {record.role === 'SeniorAgent' ? 'Senior' : 'Agent'}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-green-600">{record.daysPresent}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-red-600">{record.daysLate}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-orange-600">
                              {Math.floor(record.totalLateness / 60)}h {record.totalLateness % 60}m
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{record.avgLoginTime}</td>
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
