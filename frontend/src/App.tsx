// App.tsx
import React from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { SocketProvider } from './contexts/SocketContext'
import { ToastProvider } from './contexts/ToastContext'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import TopAgents from './pages/TopAgents'
import SubmitLead from './pages/SubmitLead'
import QCDashboard from './pages/QCDashboard'
import CampaignQualifications from './pages/CampaignQualifications'
import AdminDashboard from './pages/AdminDashboard'
import LeaveRequests from './pages/LeaveRequests'
import ClientDashboard from './pages/ClientDashboard'
import ClientTeamMembers from './pages/ClientTeamMembers'
import ClientTeamMemberForm from './pages/ClientTeamMemberForm'
import ClientTasks from './pages/ClientTasks'
import ClientAutomationRules from './pages/ClientAutomationRules'

import LeadDetail from './pages/LeadDetail'
import TeamMemberDashboard from './pages/TeamMemberDashboard'
import TeamMemberSchedules from './pages/TeamMemberSchedules'
import TeamMemberPipeline from './pages/TeamMemberPipeline'
import ClientPipeline from './pages/ClientPipeline'
import ClientClosedLeads from './pages/ClientClosedLeads'
import ClientDeadLeads from './pages/ClientDeadLeads'
import ClientQualifiedLeads from './pages/ClientQualifiedLeads'
import ClientSchedules from './pages/ClientSchedules'
import UserManagement from './pages/UserManagement';
import CampaignManagement from './pages/CampaignManagement';
import TeamManagement from './pages/TeamManagement';
import LeadsList from './pages/LeadsList';
import Leaderboard from './pages/Leaderboard';
import SystemSettings from './pages/SystemSettings';
import PipelineStagesManagement from './pages/PipelineStagesManagement';
import ManagerAnalytics from './pages/ManagerAnalytics';
import QCAnalytics from './pages/QCAnalytics';
import TeamLeaderDashboard from './pages/TeamLeaderDashboard';
import TeamLeaderReports from './pages/TeamLeaderReports';
import CheckDuplicate from './pages/CheckDuplicate';
import SeniorAgentDashboard from './pages/SeniorAgentDashboard';
import AccountManagerDashboard from './pages/AccountManagerDashboard';
import AccountManagerManagement from './pages/AccountManagerManagement';
import AccountManagerReports from './pages/AccountManagerReports';
import AccountManagerAnalytics from './pages/AccountManagerAnalytics';
import ITDashboardHome from './pages/ITDashboardHome';
import ITNewTickets from './pages/ITNewTickets';
import ITTicketsList from './pages/ITTicketsList';
import SubmitITTicket from './pages/SubmitITTicket';
import MyITTickets from './pages/MyITTickets';
import ITTicketDetails from './pages/ITTicketDetails';
import FormBuilder from './pages/FormBuilder';
import BackupRestore from './pages/BackupRestore';

import './index.css'

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={
        <ProtectedRoute>
          <Dashboard />
        </ProtectedRoute>
      } />
      <Route path="/top-agents" element={
        <ProtectedRoute>
          <TopAgents />
        </ProtectedRoute>
      } />
      <Route path="/submit-lead" element={
        <ProtectedRoute>
          <SubmitLead />
        </ProtectedRoute>
      } />
      <Route path="/qc-dashboard" element={
        <ProtectedRoute>
          <QCDashboard />
        </ProtectedRoute>
      } />
      <Route path="/campaign-qualifications" element={
        <ProtectedRoute>
          <CampaignQualifications />
        </ProtectedRoute>
      } />
      <Route path="/admin" element={
        <ProtectedRoute>
          <AdminDashboard />
        </ProtectedRoute>
      } />
      <Route path="/leave-requests" element={
        <ProtectedRoute>
          <LeaveRequests />
        </ProtectedRoute>
      } />
      <Route path="/client" element={
        <ProtectedRoute>
          <ClientDashboard />
        </ProtectedRoute>
      } />
      <Route path="/client/pipeline" element={
        <ProtectedRoute>
          <ClientPipeline />
        </ProtectedRoute>
      } />
      <Route path="/client/qualified-leads" element={
        <ProtectedRoute>
          <ClientQualifiedLeads />
        </ProtectedRoute>
      } />
      <Route path="/client/closed-leads" element={
        <ProtectedRoute>
          <ClientClosedLeads />
        </ProtectedRoute>
      } />
      <Route path="/client/dead-leads" element={
        <ProtectedRoute>
          <ClientDeadLeads />
        </ProtectedRoute>
      } />
      <Route path="/client/schedules" element={
        <ProtectedRoute>
          <ClientSchedules />
        </ProtectedRoute>
      } />
      <Route path="/client/team-members" element={
        <ProtectedRoute>
          <ClientTeamMembers />
        </ProtectedRoute>
      } />
      <Route path="/client/team-members/create" element={
        <ProtectedRoute>
          <ClientTeamMemberForm />
        </ProtectedRoute>
      } />
      <Route path="/client/team-members/:id/edit" element={
        <ProtectedRoute>
          <ClientTeamMemberForm />
        </ProtectedRoute>
      } />
      <Route path="/client/tasks" element={
        <ProtectedRoute>
          <ClientTasks />
        </ProtectedRoute>
      } />
      <Route path="/client/automation-rules" element={
        <ProtectedRoute>
          <ClientAutomationRules />
        </ProtectedRoute>
      } />

      <Route path="/client/lead/:id" element={
        <ProtectedRoute>
          <LeadDetail />
        </ProtectedRoute>
      } />
      <Route path="/team-member/dashboard" element={
        <ProtectedRoute>
          <TeamMemberDashboard />
        </ProtectedRoute>
      } />
      <Route path="/team-member/schedules" element={
        <ProtectedRoute>
          <TeamMemberSchedules />
        </ProtectedRoute>
      } />
      <Route path="/team-member/pipeline" element={
        <ProtectedRoute>
          <TeamMemberPipeline />
        </ProtectedRoute>
      } />
      <Route path="/team-member/leads/:id" element={
        <ProtectedRoute>
          <LeadDetail />
        </ProtectedRoute>
      } />
      <Route path="/admin/users" element={
       <ProtectedRoute>
        <UserManagement />
       </ProtectedRoute>
      } />
      <Route path="/admin/campaigns" element={
       <ProtectedRoute>
        <CampaignManagement />
      </ProtectedRoute>
      } />
      <Route path="/admin/campaigns/form-builder" element={
       <ProtectedRoute>
        <FormBuilder />
      </ProtectedRoute>
      } />
      <Route path="/admin/teams" element={
       <ProtectedRoute>
        <TeamManagement />
      </ProtectedRoute>
      } />	
      <Route path="/leads-list" element={
        <ProtectedRoute>
          <LeadsList />
        </ProtectedRoute>
      } />
      <Route path="/leads/:id" element={
        <ProtectedRoute>
          <LeadDetail />
        </ProtectedRoute>
      } />
      <Route path="/leaderboard" element={
        <ProtectedRoute>
          <Leaderboard />
        </ProtectedRoute>
      } />
      <Route path="/admin/settings" element={
        <ProtectedRoute>
          <SystemSettings />
        </ProtectedRoute>
      } />
      <Route path="/admin/backup-restore" element={
        <ProtectedRoute>
          <BackupRestore />
        </ProtectedRoute>
      } />
      <Route path="/admin/pipeline-stages" element={
        <ProtectedRoute>
          <PipelineStagesManagement />
        </ProtectedRoute>
      } />
      <Route path="/client/pipeline-stages" element={
        <ProtectedRoute>
          <PipelineStagesManagement />
        </ProtectedRoute>
      } />
      <Route path="/admin/analytics" element={
        <ProtectedRoute>
          <ManagerAnalytics />
        </ProtectedRoute>
      } />
      <Route path="/qc-analytics" element={
        <ProtectedRoute>
          <QCAnalytics />
        </ProtectedRoute>
      } />
      <Route path="/team-leader-dashboard" element={
        <ProtectedRoute>
          <TeamLeaderDashboard />
        </ProtectedRoute>
      } />
      <Route path="/senior-agent-dashboard" element={
        <ProtectedRoute>
          <SeniorAgentDashboard />
        </ProtectedRoute>
      } />
      <Route path="/team-leader-reports" element={
        <ProtectedRoute>
          <TeamLeaderReports />
        </ProtectedRoute>
      } />
      <Route path="/check-duplicate" element={
        <ProtectedRoute>
          <CheckDuplicate />
        </ProtectedRoute>
      } />
      <Route path="/account-manager-dashboard" element={
        <ProtectedRoute>
          <AccountManagerDashboard />
        </ProtectedRoute>
      } />
      <Route path="/account-manager-management" element={
        <ProtectedRoute>
          <AccountManagerManagement />
        </ProtectedRoute>
      } />
      <Route path="/account-manager-reports" element={
        <ProtectedRoute>
          <AccountManagerReports />
        </ProtectedRoute>
      } />
      <Route path="/account-manager-analytics" element={
        <ProtectedRoute>
          <AccountManagerAnalytics />
        </ProtectedRoute>
      } />
      <Route path="/it-dashboard" element={
        <ProtectedRoute>
          <ITDashboardHome />
        </ProtectedRoute>
      } />
      <Route path="/it-new-tickets" element={
        <ProtectedRoute>
          <ITNewTickets />
        </ProtectedRoute>
      } />
      <Route path="/it-tickets-list" element={
        <ProtectedRoute>
          <ITTicketsList />
        </ProtectedRoute>
      } />
      <Route path="/submit-it-ticket" element={
        <ProtectedRoute>
          <SubmitITTicket />
        </ProtectedRoute>
      } />
      <Route path="/my-it-tickets" element={
        <ProtectedRoute>
          <MyITTickets />
        </ProtectedRoute>
      } />
      <Route path="/it-tickets/:id" element={
        <ProtectedRoute>
          <ITTicketDetails />
        </ProtectedRoute>
      } />

    </Routes>
  )
}

function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <SocketProvider>
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </SocketProvider>
      </ToastProvider>
    </AuthProvider>
  )
}

export default App