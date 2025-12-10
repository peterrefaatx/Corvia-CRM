import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import Logo from '../Logo/Logo';

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isAdminDropdownOpen, setIsAdminDropdownOpen] = useState(false);
  const [isITTicketsDropdownOpen, setIsITTicketsDropdownOpen] = useState(false);
  const [isSettingsDropdownOpen, setIsSettingsDropdownOpen] = useState(false);
  const [isLeadsDropdownOpen, setIsLeadsDropdownOpen] = useState(false);
  const [isTasksDropdownOpen, setIsTasksDropdownOpen] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const hamburgerRef = useRef<HTMLButtonElement>(null);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navigation = (() => {
    if (!user) {
      return [] as Array<{ name: string; href: string; isDropdown?: boolean }>;
    }

    switch (user.role) {
      case 'Manager':
        return [
          { name: 'Admin Dashboard', href: '/admin' },
          { name: 'QC Dashboard', href: '/qc-dashboard' },
          { name: 'Leads List', href: '/leads-list' },
          { name: 'Top Agents', href: '/leaderboard' },
          { name: 'Leave Requests', href: '/leave-requests' }
        ];
      case 'QualityControl':
        return [
          { name: 'Dashboard', href: '/qc-analytics' },
          { name: 'Leads List', href: '/leads-list' },
          { name: 'QC Dashboard', href: '/qc-dashboard' },
          { name: 'Qualifications', href: '/campaign-qualifications' },
          { name: 'Top Agents', href: '/leaderboard' },
          { name: 'Check Dup', href: '/check-duplicate' },
          { name: 'Leave Requests', href: '/leave-requests' }
        ];
      case 'TeamLeader':
        return [
          { name: 'Dashboard', href: '/team-leader-dashboard' },
          { name: 'Leads List', href: '/leads-list' },
          { name: 'Qualifications', href: '/campaign-qualifications' },
          { name: 'Top Agents', href: '/leaderboard' },
          { name: 'Check Dup', href: '/check-duplicate' },
          { name: 'IT Tickets', href: '/it-tickets-menu', isDropdown: true },
          { name: 'Reports', href: '/team-leader-reports' },
          { name: 'Leave Requests', href: '/leave-requests' }
        ];
      case 'AccountManager':
        return [
          { name: 'Dashboard', href: '/account-manager-dashboard' },
          { name: 'Analytics', href: '/account-manager-analytics' },
          { name: 'Leads List', href: '/leads-list' },
          { name: 'Top Agents', href: '/leaderboard' },
          { name: 'IT Tickets', href: '/it-tickets-menu', isDropdown: true },
          { name: 'Leave Requests', href: '/leave-requests' }
        ];
      case 'IT':
        return [
          { name: 'Dashboard', href: '/it-dashboard' },
          { name: 'New Tickets', href: '/it-new-tickets' },
          { name: 'Tickets List', href: '/it-tickets-list' },
          { name: 'Leave Requests', href: '/leave-requests' }
        ];
      case 'Client':
        return [
          { name: 'Dashboard', href: '/client' },
          { name: 'Pipeline', href: '/client/pipeline' },
          { name: 'Leads', href: '/client/leads-menu', isDropdown: true },
          { name: 'Tasks', href: '/client/tasks-menu', isDropdown: true },
          { name: 'Settings', href: '/client/settings-menu', isDropdown: true }
        ];
      case 'TeamMember':
        const teamMemberNav = [
          { name: 'My Dashboard', href: '/team-member/dashboard' }
        ];
        
        // Add Qualified Leads if permission granted
        if (user.permissions?.leads?.view_all) {
          teamMemberNav.push({ name: 'Qualified Leads', href: '/client/qualified-leads' });
        }
        
        // Add Pipeline if permission granted
        if (user.permissions?.pipeline?.view_pipeline) {
          teamMemberNav.push({ name: 'Pipeline', href: '/team-member/pipeline' });
        }
        
        teamMemberNav.push({ name: 'Schedules', href: '/team-member/schedules' });
        
        return teamMemberNav;
      case 'Agent':
        return [
          { name: 'Dashboard', href: '/' },
          { name: 'Leads List', href: '/leads-list' },
          { name: 'Top Agents', href: '/leaderboard' },
          { name: 'Leave Requests', href: '/leave-requests' }
        ];
      case 'SeniorAgent':
        return [
          { name: 'Dashboard', href: '/' },
          { name: 'Leads List', href: '/leads-list' },
          { name: 'Top Agents', href: '/leaderboard' },
          { name: 'Leave Requests', href: '/leave-requests' }
        ];
      default:
        return [];
    }
  })();

  const isActiveRoute = (href: string) => {
    if (href === '/') {
      return location.pathname === '/';
    }
    // Exact match for routes to avoid highlighting parent routes
    return location.pathname === href;
  };

  // Close sidebar when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        sidebarRef.current && 
        !sidebarRef.current.contains(target) &&
        hamburgerRef.current &&
        !hamburgerRef.current.contains(target)
      ) {
        setIsSidebarOpen(false);
      }
    };

    if (isSidebarOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isSidebarOpen]);

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: '#f7f6f5' }}>
      {/* Sidebar */}
      <div
        ref={sidebarRef}
        className={`fixed top-0 left-0 h-full nav-sidebar border-r border-gray-300 transition-transform duration-300 ease-in-out z-20 shadow-lg flex flex-col ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{ width: '260px' }}
      >
        {/* Sidebar Header - Empty space for header height */}
        <div className="h-[57px] border-b border-gray-300"></div>

        {/* Navigation Links */}
        <nav className="p-4 space-y-1 flex-1 overflow-y-auto">
          {navigation.map((item) => {
            // Special handling for Admin Dashboard with dropdown
            if (item.name === 'Admin Dashboard' && user?.role === 'Manager') {
              return (
                <div key={item.name}>
                  <div className={`flex items-center overflow-hidden ${
                    isActiveRoute(item.href) || location.pathname.startsWith('/admin/')
                      ? 'bg-blue-50 text-blue-700 border-l-4 border-blue-600'
                      : 'text-gray-700 border-l-4 border-transparent'
                  }`}>
                    <Link
                      to={item.href}
                      onClick={() => setIsSidebarOpen(false)}
                      className="flex-1 px-4 py-3 text-sm font-medium hover:bg-gray-200 transition-colors"
                    >
                      {item.name}
                    </Link>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsAdminDropdownOpen(!isAdminDropdownOpen);
                      }}
                      className="px-3 py-3 hover:bg-gray-200 transition-colors"
                    >
                      <svg 
                        className={`w-4 h-4 transition-transform ${isAdminDropdownOpen ? 'rotate-180' : ''}`}
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>
                  
                  {/* Dropdown Menu */}
                  {isAdminDropdownOpen && (
                    <div className="mt-1 ml-4 space-y-1 border-l-2 border-gray-200 pl-4">
                      <Link
                        to="/admin/users"
                        onClick={() => setIsSidebarOpen(false)}
                        className={`block px-4 py-2 text-sm transition-colors ${
                          location.pathname === '/admin/users'
                            ? 'text-blue-700 font-medium'
                            : 'text-gray-600 hover:text-gray-900'
                        }`}
                      >
                        Users
                      </Link>
                      <Link
                        to="/admin/teams"
                        onClick={() => setIsSidebarOpen(false)}
                        className={`block px-4 py-2 text-sm transition-colors ${
                          location.pathname === '/admin/teams'
                            ? 'text-blue-700 font-medium'
                            : 'text-gray-600 hover:text-gray-900'
                        }`}
                      >
                        Teams
                      </Link>
                      <Link
                        to="/admin/campaigns"
                        onClick={() => setIsSidebarOpen(false)}
                        className={`block px-4 py-2 text-sm transition-colors ${
                          location.pathname === '/admin/campaigns'
                            ? 'text-blue-700 font-medium'
                            : 'text-gray-600 hover:text-gray-900'
                        }`}
                      >
                        Campaigns
                      </Link>
                      <Link
                        to="/account-manager-management"
                        onClick={() => setIsSidebarOpen(false)}
                        className={`block px-4 py-2 text-sm transition-colors ${
                          location.pathname === '/account-manager-management'
                            ? 'text-blue-700 font-medium'
                            : 'text-gray-600 hover:text-gray-900'
                        }`}
                      >
                        Account Managers
                      </Link>
                    </div>
                  )}
                </div>
              );
            }
            
            // IT Tickets dropdown for Team Leaders and Account Managers
            if (item.name === 'IT Tickets' && item.isDropdown) {
              const isITTicketsActive = location.pathname.startsWith('/submit-it-ticket') || 
                                        location.pathname.startsWith('/my-it-tickets') ||
                                        location.pathname.startsWith('/it-tickets/');
              
              return (
                <div key={item.name}>
                  <div 
                    className={`flex items-center ${
                      isITTicketsActive
                        ? 'text-gray-800'
                        : 'text-gray-700'
                    }`}
                  >
                    <button
                      onClick={() => setIsITTicketsDropdownOpen(!isITTicketsDropdownOpen)}
                      className="flex-1 px-4 py-3 text-sm font-medium transition-colors text-left flex items-center gap-3 hover:bg-gray-200"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                      </svg>
                      {item.name}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsITTicketsDropdownOpen(!isITTicketsDropdownOpen);
                      }}
                      className="px-3 py-3 hover:bg-white hover:bg-opacity-20 transition-colors"
                    >
                      <svg 
                        className={`w-4 h-4 transition-transform ${isITTicketsDropdownOpen ? 'rotate-180' : ''}`}
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>
                  
                  {/* IT Tickets Dropdown Menu */}
                  {isITTicketsDropdownOpen && (
                    <div className="ml-8 space-y-1 mt-1">
                      <Link
                        to="/submit-it-ticket"
                        onClick={() => setIsSidebarOpen(false)}
                        className={`block px-4 py-2 text-sm transition-colors ${
                          location.pathname === '/submit-it-ticket'
                            ? 'text-gray-800 font-medium nav-option-active'
                            : 'text-gray-600 hover:bg-gray-200 hover:text-gray-900'
                        }`}

                      >
                        Submit IT Ticket
                      </Link>
                      <Link
                        to="/my-it-tickets"
                        onClick={() => setIsSidebarOpen(false)}
                        className={`block px-4 py-2 text-sm transition-colors ${
                          location.pathname === '/my-it-tickets' || location.pathname.startsWith('/it-tickets/')
                            ? 'text-gray-800 font-medium nav-option-active'
                            : 'text-gray-600 hover:bg-gray-200 hover:text-gray-900'
                        }`}

                      >
                        Track Tickets
                      </Link>
                    </div>
                  )}
                </div>
              );
            }

            // Leads dropdown for Clients
            if (item.name === 'Leads' && item.isDropdown && user?.role === 'Client') {
              const isLeadsActive = location.pathname.startsWith('/client/qualified-leads') || 
                                   location.pathname.startsWith('/client/closed-leads') ||
                                   location.pathname.startsWith('/client/dead-leads');
              
              return (
                <div key={item.name}>
                  <div 
                    className={`flex items-center ${
                      isLeadsActive
                        ? 'text-gray-800 nav-active'
                        : 'text-gray-700'
                    }`}
                  >
                    <button
                      onClick={() => setIsLeadsDropdownOpen(!isLeadsDropdownOpen)}
                      className="flex-1 px-4 py-3 text-sm font-medium transition-colors text-left flex items-center gap-3 hover:bg-gray-200"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                      {item.name}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsLeadsDropdownOpen(!isLeadsDropdownOpen);
                      }}
                      className="px-3 py-3 hover:bg-white hover:bg-opacity-20 transition-colors"
                    >
                      <svg 
                        className={`w-4 h-4 transition-transform ${isLeadsDropdownOpen ? 'rotate-180' : ''}`}
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>
                  
                  {/* Leads Dropdown Menu */}
                  {isLeadsDropdownOpen && (
                    <div className="ml-8 space-y-1 mt-1">
                      <Link
                        to="/client/qualified-leads"
                        onClick={() => setIsSidebarOpen(false)}
                        className={`block px-4 py-2 text-sm transition-colors ${
                          location.pathname.startsWith('/client/qualified-leads')
                            ? 'text-gray-800 font-medium nav-option-active'
                            : 'text-gray-600 hover:bg-gray-200 hover:text-gray-900'
                        }`}

                      >
                        Qualified Leads
                      </Link>
                      <Link
                        to="/client/closed-leads"
                        onClick={() => setIsSidebarOpen(false)}
                        className={`block px-4 py-2 text-sm transition-colors ${
                          location.pathname === '/client/closed-leads'
                            ? 'text-gray-800 font-medium nav-option-active'
                            : 'text-gray-600 hover:bg-gray-200 hover:text-gray-900'
                        }`}

                      >
                        Closed Leads
                      </Link>
                      <Link
                        to="/client/dead-leads"
                        onClick={() => setIsSidebarOpen(false)}
                        className={`block px-4 py-2 text-sm transition-colors ${
                          location.pathname === '/client/dead-leads'
                            ? 'text-gray-800 font-medium nav-option-active'
                            : 'text-gray-600 hover:bg-gray-200 hover:text-gray-900'
                        }`}

                      >
                        Dead Leads
                      </Link>
                    </div>
                  )}
                </div>
              );
            }

            // Tasks dropdown for Clients
            if (item.name === 'Tasks' && item.isDropdown && user?.role === 'Client') {
              const isTasksActive = location.pathname.startsWith('/client/tasks') || 
                                   location.pathname.startsWith('/client/schedules');
              
              return (
                <div key={item.name}>
                  <div 
                    className={`flex items-center ${
                      isTasksActive
                        ? 'text-gray-800 nav-active'
                        : 'text-gray-700'
                    }`}
                  >
                    <button
                      onClick={() => setIsTasksDropdownOpen(!isTasksDropdownOpen)}
                      className="flex-1 px-4 py-3 text-sm font-medium transition-colors text-left flex items-center gap-3 hover:bg-gray-200"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                      </svg>
                      {item.name}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsTasksDropdownOpen(!isTasksDropdownOpen);
                      }}
                      className="px-3 py-3 hover:bg-white hover:bg-opacity-20 transition-colors"
                    >
                      <svg 
                        className={`w-4 h-4 transition-transform ${isTasksDropdownOpen ? 'rotate-180' : ''}`}
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>
                  
                  {/* Tasks Dropdown Menu */}
                  {isTasksDropdownOpen && (
                    <div className="ml-8 space-y-1 mt-1">
                      <Link
                        to="/client/tasks"
                        onClick={() => setIsSidebarOpen(false)}
                        className={`block px-4 py-2 text-sm transition-colors ${
                          location.pathname.startsWith('/client/tasks')
                            ? 'text-gray-800 font-medium nav-option-active'
                            : 'text-gray-600 hover:bg-gray-200 hover:text-gray-900'
                        }`}

                      >
                        Tasks
                      </Link>
                      <Link
                        to="/client/schedules"
                        onClick={() => setIsSidebarOpen(false)}
                        className={`block px-4 py-2 text-sm transition-colors ${
                          location.pathname === '/client/schedules'
                            ? 'text-gray-800 font-medium nav-option-active'
                            : 'text-gray-600 hover:bg-gray-200 hover:text-gray-900'
                        }`}

                      >
                        Schedules
                      </Link>
                    </div>
                  )}
                </div>
              );
            }

            // Settings dropdown for Clients
            if (item.name === 'Settings' && item.isDropdown && user?.role === 'Client') {
              const isSettingsActive = location.pathname.startsWith('/client/team-members') || 
                                       location.pathname.startsWith('/client/automation-rules') ||
                                       location.pathname.startsWith('/client/pipeline-stages');
              
              return (
                <div key={item.name}>
                  <div 
                    className={`flex items-center ${
                      isSettingsActive
                        ? 'text-gray-800 nav-active'
                        : 'text-gray-700'
                    }`}
                  >
                    <button
                      onClick={() => setIsSettingsDropdownOpen(!isSettingsDropdownOpen)}
                      className="flex-1 px-4 py-3 text-sm font-medium transition-colors text-left flex items-center gap-3 hover:bg-gray-200"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      {item.name}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsSettingsDropdownOpen(!isSettingsDropdownOpen);
                      }}
                      className="px-3 py-3 hover:bg-white hover:bg-opacity-20 transition-colors"
                    >
                      <svg 
                        className={`w-4 h-4 transition-transform ${isSettingsDropdownOpen ? 'rotate-180' : ''}`}
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>
                  
                  {/* Settings Dropdown Menu */}
                  {isSettingsDropdownOpen && (
                    <div className="ml-8 space-y-1 mt-1">
                      <Link
                        to="/client/team-members"
                        onClick={() => setIsSidebarOpen(false)}
                        className={`block px-4 py-2 text-sm transition-colors ${
                          location.pathname.startsWith('/client/team-members')
                            ? 'text-gray-800 font-medium'
                            : 'text-gray-600 hover:bg-gray-200 hover:text-gray-900'
                        }`}
                        style={location.pathname.startsWith('/client/team-members') ? { backgroundColor: '#f0f0eb' } : {}}
                      >
                        Team Members
                      </Link>
                      <Link
                        to="/client/automation-rules"
                        onClick={() => setIsSidebarOpen(false)}
                        className={`block px-4 py-2 text-sm transition-colors ${
                          location.pathname === '/client/automation-rules'
                            ? 'text-gray-800 font-medium'
                            : 'text-gray-600 hover:bg-gray-200 hover:text-gray-900'
                        }`}
                        style={location.pathname === '/client/automation-rules' ? { backgroundColor: '#f0f0eb' } : {}}
                      >
                        Automation Rules
                      </Link>
                      <Link
                        to="/client/pipeline-stages"
                        onClick={() => setIsSidebarOpen(false)}
                        className={`block px-4 py-2 text-sm transition-colors ${
                          location.pathname === '/client/pipeline-stages'
                            ? 'text-gray-800 font-medium'
                            : 'text-gray-600 hover:bg-gray-200 hover:text-gray-900'
                        }`}
                        style={location.pathname === '/client/pipeline-stages' ? { backgroundColor: '#f0f0eb' } : {}}
                      >
                        Pipeline Stages
                      </Link>
                    </div>
                  )}
                </div>
              );
            }
            
            // Function to get icon for navigation item
            const getNavigationIcon = (itemName: string) => {
              const iconProps = { className: "w-5 h-5", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor" };
              
              switch (itemName) {
                case 'Dashboard':
                case 'Admin Dashboard':
                case 'QC Dashboard':
                case 'My Dashboard':
                  return <svg {...iconProps}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2 2v0zM8 5a2 2 0 012-2h4a2 2 0 012 2v0M8 5a2 2 0 012-2h4a2 2 0 012 2v0" /></svg>;
                case 'Pipeline':
                  return <svg {...iconProps}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>;
                case 'Leads List':
                case 'Qualified Leads':
                  return <svg {...iconProps}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>;
                case 'Top Agents':
                  return <svg {...iconProps}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" /></svg>;
                case 'Leave Requests':
                  return <svg {...iconProps}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>;
                case 'Qualifications':
                  return <svg {...iconProps}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
                case 'Check Dup':
                  return <svg {...iconProps}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>;
                case 'Analytics':
                  return <svg {...iconProps}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>;
                case 'Reports':
                  return <svg {...iconProps}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>;
                case 'IT Tickets':
                  return <svg {...iconProps}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" /></svg>;
                case 'New Tickets':
                  return <svg {...iconProps}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>;
                case 'Tickets List':
                  return <svg {...iconProps}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>;
                case 'Schedules':
                  return <svg {...iconProps}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
                default:
                  return <svg {...iconProps}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>;
              }
            };

            // Regular navigation items
            return (
              <Link
                key={item.name}
                to={item.href}
                onClick={() => setIsSidebarOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors ${
                  isActiveRoute(item.href)
                    ? 'text-gray-800 nav-active'
                    : 'text-gray-700 hover:bg-gray-200 hover:text-gray-900'
                }`}
              >
                {getNavigationIcon(item.name)}
                {item.name}
              </Link>
            );
          })}
        </nav>

        {/* User Info and Logout - Bottom Section */}
        <div className="mt-auto border-t border-gray-300">
          {/* User Info with Logout Icon */}
          <div className="p-4 nav-user-section">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-gray-900">{user?.fullName || user?.name}</p>
              <button
                onClick={handleLogout}
                className="p-2 rounded-lg text-red-600 hover:bg-red-50 transition-colors"
                title="Logout"
              >
                <svg 
                  className="w-5 h-5" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" 
                  />
                </svg>
              </button>
            </div>
            {user?.role === 'AccountManager' && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                Account Manager
              </span>
            )}
            {user?.role === 'TeamMember' && (
              <div className="space-y-1">
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-cyan-800">
                  {user.positionTitle}
                </span>
                {user.clientName && (
                  <p className="text-xs text-gray-600">Client: {user.clientName}</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-30 z-10 transition-opacity duration-300"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
        {/* Top Bar with Hamburger and Logo */}
        <div className="sticky top-0 z-30 shadow-md" style={{ backgroundColor: '#20211A' }}>
          <div className="px-4 py-2 flex items-center space-x-4">
            <button
              ref={hamburgerRef}
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 rounded-lg text-white hover:bg-white/10 transition-colors"
            >
              <Menu size={24} />
            </button>
            <Logo size="lg" />
          </div>
        </div>

        {/* Main Content */}
        <main className="flex-1">
          {children}
        </main>

        {/* Footer */}
        <footer className="text-white py-4" style={{ backgroundColor: '#20211A' }}>
          <div className="px-4 sm:px-6 lg:px-8">
            <div className="text-center text-sm">
              <p>&copy; {new Date().getFullYear()} Lead Management System. All rights reserved.</p>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default Layout;
