import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout/Layout';
import api from '../services/api';
import { useToast } from '../contexts/ToastContext';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import * as XLSX from 'xlsx';
import { getRoleBadgeColor, getRoleShortLabel } from '../utils/roleBadgeColors';

interface AgentReport {
  id: string;
  fullName: string;
  role: string;
  teamName: string;
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
  teamName: string;
  daysPresent: number;
  daysLate: number;
  totalLateness: number;
  avgLoginTime: string;
}

const ManagerAnalytics: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState('overview');
  const [teamsComparison, setTeamsComparison] = useState<any[]>([]);
  const [selectedTeamDetails, setSelectedTeamDetails] = useState<any>(null);
  const [selectedAgent, setSelectedAgent] = useState<any>(null);
  const [teams, setTeams] = useState<any[]>([]);
  const [agents, setAgents] = useState<any[]>([]);
  const [campaignProgress, setCampaignProgress] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  // Date filtering state
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  // Agent Performance and Attendance state
  const [agentReports, setAgentReports] = useState<AgentReport[]>([]);
  const [attendanceReports, setAttendanceReports] = useState<AttendanceRecord[]>([]);
  
  // Attendance filters
  const [selectedTeam, setSelectedTeamFilter] = useState('all');
  const [selectedRole, setSelectedRoleFilter] = useState('all');

  // Calculate date range
  const getDateRange = (): { start: string; end: string } | null => {
    if (startDate && endDate) {
      return {
        start: new Date(startDate).toISOString(),
        end: new Date(endDate + 'T23:59:59').toISOString()
      };
    }
    return null;
  };

  // Scroll to top when component mounts
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    // Set default dates if not set
    if (!startDate || !endDate) {
      const today = new Date();
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      setStartDate(firstDay.toISOString().split('T')[0]);
      setEndDate(today.toISOString().split('T')[0]);
    } else {
      loadInitialData();
    }
  }, [startDate, endDate, activeTab, selectedTeam, selectedRole]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      
      if (activeTab === 'performance') {
        // Load agent performance from analytics endpoint
        const params = { from: startDate, to: endDate };
        const response = await api.get('/analytics/agents/performance', { params });
        setAgentReports(response.data.agents || []);
      } else if (activeTab === 'attendance') {
        // Load attendance from analytics endpoint with filters
        const params = { 
          from: startDate, 
          to: endDate,
          teamId: selectedTeam,
          role: selectedRole
        };
        const response = await api.get('/analytics/agents/attendance', { params });
        setAttendanceReports(response.data.attendance || []);
      } else {
        // Load teams comparison
        const dateRange = getDateRange();
        const teamsResponse = await api.get('/analytics/teams/compare', {
          params: dateRange ? { from: dateRange.start, to: dateRange.end } : {}
        });
        setTeamsComparison(teamsResponse.data);
        
        // Load all teams
        const teamsListResponse = await api.get('/teams');
        setTeams(teamsListResponse.data);
        
        // Load all agents (including senior agents)
        const [agentsResponse, seniorAgentsResponse] = await Promise.all([
          api.get('/users?role=Agent'),
          api.get('/users?role=SeniorAgent')
        ]);
        setAgents([...agentsResponse.data, ...seniorAgentsResponse.data]);
      }
    } catch (error) {
      console.error('Failed to load analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const getDateRangeLabel = (): string => {
    if (startDate && endDate) {
      return `${startDate} to ${endDate}`;
    }
    return 'All Time';
  };

  // Export to CSV
  const exportToCSV = () => {
    try {
      let csvContent = '';
      let fileName = `analytics_${activeTab}_${new Date().toISOString().split('T')[0]}.csv`;
      
      if (activeTab === 'agentPerformance' && agentReports.length > 0) {
        // Export agent performance
        csvContent = 'Agent Name,Role,Team,Score,Total Leads,Qualified,Disqualified,Callback,Duplicate,Pushed\n';
        agentReports.forEach(agent => {
          csvContent += `"${agent.fullName}","${agent.role}","${agent.teamName}",${agent.score},${agent.totalLeads},${agent.qualified},${agent.disqualified},${agent.callback},${agent.duplicate},${agent.pushed}\n`;
        });
        fileName = `agent_performance_${new Date().toISOString().split('T')[0]}.csv`;
      } else if (activeTab === 'attendance' && attendanceReports.length > 0) {
        // Export attendance
        csvContent = 'Agent Name,Role,Team,Days Present,Days Late,Total Lateness (min),Avg Login Time\n';
        attendanceReports.forEach((record: AttendanceRecord) => {
          csvContent += `"${record.fullName}","${record.role}","${record.teamName}",${record.daysPresent},${record.daysLate},${record.totalLateness},"${record.avgLoginTime}"\n`;
        });
        fileName = `attendance_${new Date().toISOString().split('T')[0]}.csv`;
      } else if (activeTab === 'overview' && teamsComparison.length > 0) {
        // Export teams comparison
        csvContent = 'Team Name,Agents,Total Leads,Qualified,Quality Rate,Avg per Agent\n';
        teamsComparison.forEach(team => {
          csvContent += `"${team.teamName}",${team.agentCount},${team.total},${team.qualified},${team.qualificationRate}%,${team.avgPerAgent}\n`;
        });
        fileName = `teams_comparison_${new Date().toISOString().split('T')[0]}.csv`;
      } else if (activeTab === 'teams' && selectedTeamDetails) {
        // Export selected team data
        csvContent = 'Agent Name,Total Leads,Qualified\n';
        selectedTeamDetails.agentData.forEach((agent: any) => {
          csvContent += `"${agent.agentName}",${agent.total},${agent.qualified}\n`;
        });
        fileName = `team_${selectedTeamDetails.teamName}_${new Date().toISOString().split('T')[0]}.csv`;
      } else if (activeTab === 'agents' && selectedAgent) {
        // Export selected agent data
        csvContent = 'Date,Total,Qualified\n';
        selectedAgent.dailyData.forEach((day: any) => {
          csvContent += `${day.date},${day.total},${day.qualified}\n`;
        });
        fileName = `agent_${selectedAgent.name}_${new Date().toISOString().split('T')[0]}.csv`;
      } else {
        showToast('No data available to export', 'warning');
        return;
      }

      // Create download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', fileName);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      showToast('CSV file exported successfully!', 'success');
    } catch (error) {
      console.error('Export failed:', error);
      showToast('Export failed. Please try again.', 'error');
    }
  };

  // Export to Excel using xlsx library
  const exportToExcel = () => {
    try {
      let data: any[] = [];
      let sheetName = 'Analytics';
      let fileName = `analytics_${activeTab}_${new Date().toISOString().split('T')[0]}.xlsx`;

      if (activeTab === 'agentPerformance' && agentReports.length > 0) {
        data = agentReports.map(agent => ({
          'Agent Name': agent.fullName,
          'Role': agent.role,
          'Team': agent.teamName,
          'Score': agent.score,
          'Total Leads': agent.totalLeads,
          'Qualified': agent.qualified,
          'Disqualified': agent.disqualified,
          'Callback': agent.callback,
          'Duplicate': agent.duplicate,
          'Pushed': agent.pushed
        }));
        sheetName = 'Agent Performance';
        fileName = `agent_performance_${new Date().toISOString().split('T')[0]}.xlsx`;
      } else if (activeTab === 'attendance' && attendanceReports.length > 0) {
        data = attendanceReports.map((record: AttendanceRecord) => ({
          'Agent Name': record.fullName,
          'Role': record.role,
          'Team': record.teamName,
          'Days Present': record.daysPresent,
          'Days Late': record.daysLate,
          'Total Lateness (min)': record.totalLateness,
          'Avg Login Time': record.avgLoginTime
        }));
        sheetName = 'Attendance';
        fileName = `attendance_${new Date().toISOString().split('T')[0]}.xlsx`;
      } else if (activeTab === 'teams' && teamsComparison.length > 0) {
        data = teamsComparison.map(team => ({
          'Team Name': team.name,
          'Total Leads': team.totalLeads,
          'Qualified': team.qualified,
          'Disqualified': team.disqualified,
          'Callback': team.callback,
          'Duplicate': team.duplicate,
          'Pushed': team.pushed
        }));
        sheetName = 'Teams Comparison';
        fileName = `teams_comparison_${new Date().toISOString().split('T')[0]}.xlsx`;
      } else if (selectedAgent && selectedAgent.dailyData) {
        data = selectedAgent.dailyData.map((day: any) => ({
          'Date': day.date,
          'Total': day.total,
          'Qualified': day.qualified
        }));
        sheetName = 'Agent Daily Data';
        fileName = `agent_${selectedAgent.name}_${new Date().toISOString().split('T')[0]}.xlsx`;
      }

      if (data.length === 0) {
        showToast('No data available to export', 'warning');
        return;
      }

      // Create workbook and worksheet
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(data);

      // Auto-size columns
      const colWidths = Object.keys(data[0]).map(key => ({
        wch: Math.max(key.length, ...data.map(row => String(row[key]).length)) + 2
      }));
      ws['!cols'] = colWidths;

      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(wb, ws, sheetName);

      // Generate and download file
      XLSX.writeFile(wb, fileName);
      
      showToast('Excel file exported successfully!', 'success');
    } catch (error) {
      console.error('Excel export failed:', error);
      showToast('Excel export failed. Please try again.', 'error');
    }
  };

  const loadTeamDetails = async (teamId: string) => {
    try {
      const dateRange = getDateRange();
      const [teamResponse, campaignResponse] = await Promise.all([
        api.get(`/analytics/team/${teamId}`, {
          params: dateRange ? { from: dateRange.start, to: dateRange.end } : {}
        }),
        api.get(`/analytics/team/${teamId}/campaigns`, {
          params: dateRange ? { from: dateRange.start, to: dateRange.end } : {}
        })
      ]);
      setSelectedTeamDetails(teamResponse.data);
      setCampaignProgress(campaignResponse.data);
    } catch (error) {
      console.error('Failed to load team details:', error);
    }
  };

  const loadAgentDetails = async (agentId: string) => {
    try {
      const dateRange = getDateRange();
      const response = await api.get(`/analytics/user/${agentId}`, {
        params: dateRange ? { from: dateRange.start, to: dateRange.end } : {}
      });
      setSelectedAgent(response.data);
    } catch (error) {
      console.error('Failed to load agent details:', error);
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
      <div className="min-h-screen py-6 px-4 sm:px-6 lg:px-8" style={{ backgroundColor: '#f7f6f5' }}>
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
        {/* Date Range Picker with Export */}
        <div className="mb-6">
          <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              {/* Page Title */}
              <div>
                <h1 className="text-2xl font-semibold text-gray-900">Analytics</h1>
                <p className="text-sm text-gray-500 mt-1">Manager performance and team insights</p>
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
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="bg-transparent border-none text-sm focus:outline-none focus:ring-0 p-0 w-[130px]"
                  />
                  <span className="text-gray-400">—</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="bg-transparent border-none text-sm focus:outline-none focus:ring-0 p-0 w-[130px]"
                  />
                </div>

                {/* Export Buttons */}
                <div className="flex gap-2">
                  <button
                    onClick={exportToCSV}
                    className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-2 shadow-sm"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span className="font-medium text-sm">CSV</span>
                  </button>
                  <button
                    onClick={exportToExcel}
                    className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors flex items-center gap-2 shadow-sm"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span className="font-medium text-sm">Excel</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-6">
          <nav className="flex space-x-2 bg-white p-1 rounded-lg shadow-sm border border-gray-200 inline-flex">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-5 py-2 rounded-md font-medium text-sm transition-colors ${
                activeTab === 'overview'
                  ? 'bg-primary text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab('teams')}
              className={`px-5 py-2 rounded-md font-medium text-sm transition-colors ${
                activeTab === 'teams'
                  ? 'bg-primary text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              Teams
            </button>
            <button
              onClick={() => setActiveTab('agents')}
              className={`px-5 py-2 rounded-md font-medium text-sm transition-colors ${
                activeTab === 'agents'
                  ? 'bg-primary text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              Agents
            </button>
            <button
              onClick={() => setActiveTab('performance')}
              className={`px-5 py-2 rounded-md font-medium text-sm transition-colors ${
                activeTab === 'performance'
                  ? 'bg-primary text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              Performance
            </button>
            <button
              onClick={() => setActiveTab('attendance')}
              className={`px-5 py-2 rounded-md font-medium text-sm transition-colors ${
                activeTab === 'attendance'
                  ? 'bg-primary text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              Attendance
            </button>
          </nav>
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Company Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard 
                title="Total Teams" 
                value={teams.length} 
                color="border-blue-500" 
              />
              <StatCard 
                title="Total Agents" 
                value={agents.length} 
                color="border-green-500" 
              />
              <StatCard 
                title="Total Leads" 
                value={teamsComparison.reduce((sum, t) => sum + parseInt(t.total), 0)} 
                color="border-blue-500" 
              />
              <StatCard 
                title="Avg Quality" 
                value={`${(teamsComparison.reduce((sum, t) => sum + parseFloat(t.qualificationRate), 0) / teamsComparison.length || 0).toFixed(1)}%`}
                color="border-blue-500" 
              />
            </div>

            {/* Teams Comparison Chart */}
            <div className="bg-white p-6 rounded-lg shadow-sm border-l-4 border-gray-300">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Teams Performance Comparison</h3>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={teamsComparison} barGap={8}>
                  <defs>
                    <linearGradient id="totalGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.8}/>
                      <stop offset="100%" stopColor="#0891b2" stopOpacity={0.6}/>
                    </linearGradient>
                    <linearGradient id="qualifiedGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity={0.8}/>
                      <stop offset="100%" stopColor="#059669" stopOpacity={0.6}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="teamName" tick={{ fill: '#6b7280', fontSize: 12 }} />
                  <YAxis tick={{ fill: '#6b7280', fontSize: 12 }} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#fff', 
                      border: '1px solid #e5e7eb', 
                      borderRadius: '12px',
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                    }}
                  />
                  <Legend wrapperStyle={{ paddingTop: '20px' }} />
                  <Bar dataKey="total" fill="url(#totalGradient)" name="Total Leads" radius={[8, 8, 0, 0]} />
                  <Bar dataKey="qualified" fill="url(#qualifiedGradient)" name="Qualified" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Teams Table */}
            <div className="bg-white rounded-lg shadow-sm border-l-4 border-gray-300 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-800">Teams Overview</h3>
              </div>
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Team</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Agents</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Total</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Qualified</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Quality %</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Avg/Agent</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {teamsComparison.map((team) => (
                    <tr key={team.teamId} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">{team.teamName}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-700">{team.agentCount}</td>
                      <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">{team.total}</td>
                      <td className="px-6 py-4 whitespace-nowrap font-medium text-green-600">{team.qualified}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2.5 py-1 rounded-md text-xs font-semibold ${
                          parseFloat(team.qualificationRate) >= 60 ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                        }`}>
                          {team.qualificationRate}%
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-700">{team.avgPerAgent}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Teams Tab */}
        {activeTab === 'teams' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Team List */}
            <div className="bg-white rounded-lg shadow-sm border-l-4 border-gray-300 p-5">
              <h3 className="font-semibold text-gray-800 mb-4">Select Team</h3>
              <div className="space-y-2">
                {teams.map((team) => (
                  <button
                    key={team.id}
                    onClick={() => loadTeamDetails(team.id)}
                    className={`w-full text-left px-4 py-3 rounded-lg transition-colors ${
                      selectedTeamDetails?.team?.id === team.id
                        ? 'bg-primary text-white'
                        : 'bg-gray-50 hover:bg-gray-100'
                    }`}
                  >
                    <div className="font-medium">{team.name}</div>
                    <div className="text-sm opacity-75">
                      {teamsComparison.find(t => t.teamId === team.id)?.agentCount || 0} agents
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Team Details */}
            <div className="lg:col-span-2">
              {selectedTeamDetails ? (
                <div className="space-y-6">
                  <div className="bg-white p-6 rounded-lg shadow-sm border-l-4 border-gray-300">
                    <h3 className="text-lg font-semibold text-gray-800 mb-5">{selectedTeamDetails.team.name}</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-blue-50 p-4 rounded-lg">
                        <p className="text-sm text-gray-600 mb-1">Total Leads</p>
                        <p className="text-3xl font-bold text-gray-900">{selectedTeamDetails.summary.total}</p>
                        <p className="text-xs text-gray-500 mt-1">↗ +12% Since last week</p>
                      </div>
                      <div className="bg-green-50 p-4 rounded-lg">
                        <p className="text-sm text-gray-600 mb-1">Qualified</p>
                        <p className="text-3xl font-bold text-green-600">{selectedTeamDetails.summary.qualified}</p>
                        <p className="text-xs text-gray-500 mt-1">↗ +8% Since last week</p>
                      </div>
                      <div className="bg-blue-50 p-4 rounded-lg">
                        <p className="text-sm text-gray-600 mb-1">Quality Rate</p>
                        <p className="text-3xl font-bold text-blue-600">{selectedTeamDetails.summary.qualificationRate}%</p>
                        <p className="text-xs text-gray-500 mt-1">↗ +5% Since last week</p>
                      </div>
                      <div className="bg-blue-50 p-4 rounded-lg">
                        <p className="text-sm text-gray-600 mb-1">Avg per Agent</p>
                        <p className="text-3xl font-bold text-gray-900">{selectedTeamDetails.summary.avgPerAgent}</p>
                        <p className="text-xs text-gray-500 mt-1">→ 0% Since last week</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white p-6 rounded-lg shadow-sm border-l-4 border-gray-300">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">Agent Performance</h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={selectedTeamDetails.agentData} barGap={8}>
                        <defs>
                          <linearGradient id="totalGradientTeam" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.8}/>
                            <stop offset="100%" stopColor="#0891b2" stopOpacity={0.6}/>
                          </linearGradient>
                          <linearGradient id="qualifiedGradientTeam" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#10b981" stopOpacity={0.8}/>
                            <stop offset="100%" stopColor="#059669" stopOpacity={0.6}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis dataKey="agentName" tick={{ fill: '#6b7280', fontSize: 12 }} />
                        <YAxis tick={{ fill: '#6b7280', fontSize: 12 }} />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: '#fff', 
                            border: '1px solid #e5e7eb', 
                            borderRadius: '12px',
                            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                          }}
                        />
                        <Legend wrapperStyle={{ paddingTop: '20px' }} />
                        <Bar dataKey="total" fill="url(#totalGradientTeam)" name="Total" radius={[8, 8, 0, 0]} />
                        <Bar dataKey="qualified" fill="url(#qualifiedGradientTeam)" name="Qualified" radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Campaign Progress Table */}
                  {campaignProgress && campaignProgress.campaigns && (
                    <div className="bg-white rounded-lg shadow-sm border-l-4 border-gray-300 overflow-hidden">
                      <div className="px-6 py-4 border-b border-gray-200">
                        <h3 className="text-lg font-semibold text-gray-800">
                          Campaign Progress - {campaignProgress.teamName}
                        </h3>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="min-w-full">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Campaign</th>
                              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Timezone</th>
                              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Target</th>
                              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Pending</th>
                              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Callback</th>
                              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Achieved</th>
                              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Duplicate</th>
                              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Disqualified</th>
                              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Missed</th>
                              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Total</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200">
                            {campaignProgress.campaigns.map((campaign: any) => (
                              <tr 
                                key={campaign.campaignId}
                                className={`${campaign.targetReached ? 'bg-green-50' : 'bg-white'} hover:bg-gray-50 transition`}
                              >
                                <td className="px-4 py-4 whitespace-nowrap font-medium">{campaign.campaignName}</td>
                                <td className="px-4 py-4 whitespace-nowrap text-center text-sm text-gray-600">{campaign.timezone}</td>
                                <td className="px-4 py-4 whitespace-nowrap text-center font-semibold">{campaign.target}</td>
                                <td className="px-4 py-4 whitespace-nowrap text-center">
                                  <span className="campaign-badge px-3 py-1.5 bg-yellow-100 text-yellow-800 text-xs font-semibold inline-block rounded-full">
                                    {campaign.pending}
                                  </span>
                                </td>
                                <td className="px-4 py-4 whitespace-nowrap text-center">
                                  <span className="campaign-badge px-3 py-1.5 bg-black text-white text-xs font-semibold inline-block">
                                    {campaign.callback}
                                  </span>
                                </td>
                                <td className="px-4 py-4 whitespace-nowrap text-center">
                                  <span className={`campaign-badge px-3 py-1.5 text-xs font-semibold inline-block ${
                                    campaign.targetReached ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-700'
                                  }`}>
                                    {campaign.achieved}
                                  </span>
                                </td>
                                <td className="px-4 py-4 whitespace-nowrap text-center">
                                  <span className="campaign-badge px-3 py-1.5 bg-blue-100 text-blue-800 text-xs font-semibold inline-block rounded-full">
                                    {campaign.duplicate}
                                  </span>
                                </td>
                                <td className="px-4 py-4 whitespace-nowrap text-center">
                                  <span className="campaign-badge px-3 py-1.5 bg-red-100 text-red-800 text-xs font-semibold inline-block rounded-full">
                                    {campaign.disqualified}
                                  </span>
                                </td>
                                <td className="px-4 py-4 whitespace-nowrap text-center text-gray-600">{campaign.missed}</td>
                                <td className="px-4 py-4 whitespace-nowrap text-center font-bold">{campaign.total}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-white p-12 rounded-lg shadow text-center text-gray-500">
                  Select a team to view details
                </div>
              )}
            </div>
          </div>
        )}

        {/* Agents Tab */}
        {activeTab === 'agents' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Agent List */}
            <div className="bg-white rounded-lg shadow-sm border-l-4 border-gray-300 p-5">
              <h3 className="font-semibold text-gray-800 mb-4">Select Agent</h3>
              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {agents.map((agent) => (
                  <button
                    key={agent.id}
                    onClick={() => loadAgentDetails(agent.id)}
                    className={`w-full text-left px-4 py-3 rounded-lg transition-colors ${
                      selectedAgent?.period && agent.id === selectedAgent.agentId
                        ? 'bg-primary text-white'
                        : 'bg-gray-50 hover:bg-gray-100'
                    }`}
                  >
                    <div className="font-medium">{agent.fullName}</div>
                    <div className="text-sm opacity-75">{agent.team?.name || 'No Team'}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Agent Details */}
            <div className="lg:col-span-2">
              {selectedAgent ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <StatCard title="Total" value={selectedAgent.summary.total} color="border-blue-500" />
                    <StatCard title="Qualified" value={selectedAgent.summary.qualified} color="border-green-500" />
                    <StatCard title="Quality" value={`${selectedAgent.summary.qualificationRate}%`} color="border-blue-500" />
                    <StatCard title="Duplicates" value={selectedAgent.summary.duplicate} color="border-red-500" />
                  </div>

                  <div className="bg-white p-6 rounded-lg shadow-sm border-l-4 border-gray-300">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">Daily Performance</h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={selectedAgent.dailyData}>
                        <defs>
                          <linearGradient id="totalLineGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.8}/>
                            <stop offset="100%" stopColor="#0891b2" stopOpacity={0.3}/>
                          </linearGradient>
                          <linearGradient id="qualifiedLineGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#10b981" stopOpacity={0.8}/>
                            <stop offset="100%" stopColor="#059669" stopOpacity={0.3}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 12 }} />
                        <YAxis tick={{ fill: '#6b7280', fontSize: 12 }} />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: '#fff', 
                            border: '1px solid #e5e7eb', 
                            borderRadius: '12px',
                            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                          }}
                        />
                        <Legend wrapperStyle={{ paddingTop: '20px' }} />
                        <Line type="monotone" dataKey="total" stroke="#06b6d4" strokeWidth={3} name="Total" dot={{ fill: '#06b6d4', r: 4 }} />
                        <Line type="monotone" dataKey="qualified" stroke="#10b981" strokeWidth={3} name="Qualified" dot={{ fill: '#10b981', r: 4 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="bg-white p-6 rounded-lg shadow-sm border-l-4 border-gray-300">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">Status Distribution</h3>
                    <div className="grid grid-cols-2 gap-6">
                      {/* Pie Chart */}
                      <div>
                        <ResponsiveContainer width="100%" height={300}>
                          <PieChart>
                            <Pie
                              data={selectedAgent.statusDistribution}
                              cx="50%"
                              cy="50%"
                              labelLine={false}
                              label={false}
                              outerRadius={100}
                              innerRadius={60}
                              fill="#8884d8"
                              dataKey="value"
                              strokeWidth={3}
                              stroke="#fff"
                              paddingAngle={2}
                            >
                              {selectedAgent.statusDistribution.map((entry: any, index: number) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip 
                              contentStyle={{ 
                                backgroundColor: '#fff', 
                                border: '1px solid #e5e7eb', 
                                borderRadius: '12px',
                                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                              }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      
                      {/* Legend with Stats */}
                      <div className="flex flex-col justify-center space-y-3">
                        {selectedAgent.statusDistribution.map((entry: any, index: number) => (
                          <div key={index} className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 transition-colors">
                            <div className="flex items-center gap-3">
                              <div 
                                className="w-4 h-4 rounded-full" 
                                style={{ backgroundColor: entry.color }}
                              ></div>
                              <span className="text-sm font-medium text-gray-700">{entry.name}</span>
                            </div>
                            <div className="text-right">
                              <div className="text-lg font-bold text-gray-900">{entry.value}</div>
                              <div className="text-xs text-gray-500">
                                {((entry.value / selectedAgent.statusDistribution.reduce((sum: number, e: any) => sum + e.value, 0)) * 100).toFixed(1)}%
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-white p-12 rounded-lg shadow-sm border-l-4 border-gray-300 text-center">
                  <div className="text-gray-400 mb-4">
                    <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <p className="text-gray-500">Select an agent to view details</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Agent Performance Tab */}
        {activeTab === 'performance' && (
          <div className="bg-white rounded-lg shadow-sm border-l-4 border-gray-300 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-800">Agent Performance Report</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Score</th>
                    <th className="px-6 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Rank</th>
                    <th className="px-6 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Agent</th>
                    <th className="px-6 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Role</th>
                    <th className="px-6 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Team</th>
                    <th className="px-6 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Qualified</th>
                    <th className="px-6 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Disqualified</th>
                    <th className="px-6 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Callback</th>
                    <th className="px-6 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Duplicate</th>
                    <th className="px-6 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Total</th>
                    <th className="px-6 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Pushed</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {agentReports
                    .sort((a, b) => b.score - a.score)
                    .map((agent, index) => (
                    <tr key={agent.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-black text-primary">{agent.score}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-bold text-gray-900">{index + 1}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <div className="text-sm font-medium text-gray-900">{agent.fullName}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className={`px-3 py-1 text-xs font-semibold rounded-full ${getRoleBadgeColor(agent.role)}`}>
                          {getRoleShortLabel(agent.role)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-600">{agent.teamName}</td>
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
          </div>
        )}

        {/* Attendance Tab */}
        {activeTab === 'attendance' && (
          <div className="bg-white rounded-lg shadow-sm border-l-4 border-gray-300 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-800">Attendance Report</h3>
              </div>
              
              {/* Filters */}
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Filter by Team</label>
                  <select
                    value={selectedTeam}
                    onChange={(e) => setSelectedTeamFilter(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="all">All Teams</option>
                    {teams.map((team) => (
                      <option key={team.id} value={team.id}>{team.name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Filter by Role</label>
                  <select
                    value={selectedRole}
                    onChange={(e) => setSelectedRoleFilter(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="all">All Roles</option>
                    <option value="IT">IT</option>
                    <option value="AccountManager">Account Manager</option>
                    <option value="TeamLeader">Team Leader</option>
                    <option value="QualityControl">Quality Control</option>
                    <option value="SeniorAgent">Senior Agent</option>
                    <option value="Agent">Agent</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Role</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Team</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Days Present</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Days Late</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Total Lateness</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Avg Login Time</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {attendanceReports.map((record) => (
                    <tr key={record.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{record.fullName}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-3 py-1 text-xs font-semibold rounded-full ${getRoleBadgeColor(record.role)}`}>
                          {getRoleShortLabel(record.role)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{record.teamName}</td>
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
          </div>
        )}
      </div>
    </Layout>
  );
};

const StatCard: React.FC<{ title: string; value: string | number; color: string }> = ({ title, value }) => (
  <div className="bg-white p-5 rounded-lg shadow-sm border-l-4 border-gray-300 hover:shadow-md transition-shadow">
    <p className="text-sm text-gray-600 mb-1">{title}</p>
    <p className="text-3xl font-bold text-gray-900 mb-1">{value}</p>
    <p className="text-xs text-gray-500">↗ +12% Since last week</p>
  </div>
);

export default ManagerAnalytics;




