// Centralized route permissions configuration
// This defines which roles can access which routes

export type UserRole = 
  | 'Agent' 
  | 'SeniorAgent' 
  | 'QualityControl' 
  | 'TeamLeader' 
  | 'AccountManager' 
  | 'Manager' 
  | 'Client' 
  | 'TeamMember' 
  | 'IT';

export interface RoutePermission {
  path: string;
  allowedRoles: UserRole[];
  redirectTo?: string; // Where to redirect if unauthorized
}

// Define all route permissions
export const routePermissions: RoutePermission[] = [
  // Agent routes
  { path: '/', allowedRoles: ['Agent', 'SeniorAgent'], redirectTo: '/unauthorized' },
  { path: '/submit-lead', allowedRoles: ['Agent', 'SeniorAgent'], redirectTo: '/unauthorized' },
  { path: '/top-agents', allowedRoles: ['Agent', 'SeniorAgent', 'QualityControl', 'Manager', 'TeamLeader', 'AccountManager'], redirectTo: '/unauthorized' },
  { path: '/leaderboard', allowedRoles: ['Agent', 'SeniorAgent', 'QualityControl', 'Manager', 'TeamLeader', 'AccountManager', 'Client'], redirectTo: '/unauthorized' },
  { path: '/leave-requests', allowedRoles: ['Agent', 'SeniorAgent', 'QualityControl', 'Manager', 'TeamLeader', 'AccountManager', 'Client', 'IT'], redirectTo: '/unauthorized' },
  
  // Senior Agent routes
  { path: '/senior-agent-dashboard', allowedRoles: ['SeniorAgent'], redirectTo: '/unauthorized' },
  
  // QC routes
  { path: '/qc-dashboard', allowedRoles: ['QualityControl', 'Manager'], redirectTo: '/unauthorized' },
  { path: '/qc-analytics', allowedRoles: ['QualityControl', 'Manager'], redirectTo: '/unauthorized' },
  { path: '/leads/:id', allowedRoles: ['Agent', 'SeniorAgent', 'QualityControl', 'Manager', 'TeamLeader', 'AccountManager'], redirectTo: '/unauthorized' },
  
  // Team Leader routes
  { path: '/team-leader-dashboard', allowedRoles: ['TeamLeader'], redirectTo: '/unauthorized' },
  { path: '/team-leader-reports', allowedRoles: ['TeamLeader', 'Manager', 'AccountManager'], redirectTo: '/unauthorized' },
  
  // Account Manager routes
  { path: '/account-manager-dashboard', allowedRoles: ['AccountManager'], redirectTo: '/unauthorized' },
  { path: '/account-manager-management', allowedRoles: ['Manager'], redirectTo: '/unauthorized' },
  { path: '/account-manager-reports', allowedRoles: ['AccountManager', 'Manager'], redirectTo: '/unauthorized' },
  { path: '/account-manager-analytics', allowedRoles: ['AccountManager', 'Manager'], redirectTo: '/unauthorized' },
  
  // Manager/Admin routes
  { path: '/admin', allowedRoles: ['Manager'], redirectTo: '/unauthorized' },
  { path: '/admin-dashboard', allowedRoles: ['Manager'], redirectTo: '/unauthorized' },
  { path: '/admin/users', allowedRoles: ['Manager'], redirectTo: '/unauthorized' },
  { path: '/admin/teams', allowedRoles: ['Manager'], redirectTo: '/unauthorized' },
  { path: '/admin/campaigns', allowedRoles: ['Manager'], redirectTo: '/unauthorized' },
  { path: '/admin/campaigns/form-builder', allowedRoles: ['Manager'], redirectTo: '/unauthorized' },
  { path: '/campaign-management', allowedRoles: ['Manager', 'AccountManager'], redirectTo: '/unauthorized' },
  { path: '/campaign-qualifications', allowedRoles: ['Manager', 'AccountManager', 'TeamLeader', 'QualityControl'], redirectTo: '/unauthorized' },
  { path: '/campaign-qualifications/:id', allowedRoles: ['Manager', 'AccountManager', 'TeamLeader', 'QualityControl'], redirectTo: '/unauthorized' },
  { path: '/form-builder', allowedRoles: ['Manager'], redirectTo: '/unauthorized' },
  { path: '/leave-requests', allowedRoles: ['Manager', 'TeamLeader', 'AccountManager', 'Agent', 'SeniorAgent'], redirectTo: '/unauthorized' },
  { path: '/admin/settings', allowedRoles: ['Manager'], redirectTo: '/unauthorized' },
  { path: '/admin/analytics', allowedRoles: ['Manager'], redirectTo: '/unauthorized' },
  { path: '/admin/backup-restore', allowedRoles: ['Manager'], redirectTo: '/unauthorized' },
  
  // Client routes
  { path: '/client', allowedRoles: ['Client'], redirectTo: '/unauthorized' },
  { path: '/client/leads', allowedRoles: ['Client'], redirectTo: '/unauthorized' },
  { path: '/client/leads/:id', allowedRoles: ['Client', 'TeamMember'], redirectTo: '/unauthorized' },
  { path: '/client/lead/:id', allowedRoles: ['Client', 'TeamMember'], redirectTo: '/unauthorized' },
  { path: '/client/pipeline', allowedRoles: ['Client'], redirectTo: '/unauthorized' },
  { path: '/client/tasks', allowedRoles: ['Client'], redirectTo: '/unauthorized' },
  { path: '/client/schedules', allowedRoles: ['Client', 'TeamMember'], redirectTo: '/unauthorized' },
  { path: '/client/qualified-leads', allowedRoles: ['Client', 'TeamMember'], redirectTo: '/unauthorized' },
  { path: '/client/closed-leads', allowedRoles: ['Client'], redirectTo: '/unauthorized' },
  { path: '/client/dead-leads', allowedRoles: ['Client'], redirectTo: '/unauthorized' },
  { path: '/client/team-members', allowedRoles: ['Client'], redirectTo: '/unauthorized' },
  { path: '/client/team-members/create', allowedRoles: ['Client'], redirectTo: '/unauthorized' },
  { path: '/client/team-members/:id/edit', allowedRoles: ['Client'], redirectTo: '/unauthorized' },
  { path: '/client/positions', allowedRoles: ['Client'], redirectTo: '/unauthorized' },
  { path: '/client/automation-rules', allowedRoles: ['Client'], redirectTo: '/unauthorized' },
  { path: '/client/pipeline-stages', allowedRoles: ['Client'], redirectTo: '/unauthorized' },
  { path: '/client/activity', allowedRoles: ['Client'], redirectTo: '/unauthorized' },
  
  // Team Member routes
  { path: '/team-member/dashboard', allowedRoles: ['TeamMember'], redirectTo: '/unauthorized' },
  { path: '/team-member/leads/:id', allowedRoles: ['TeamMember'], redirectTo: '/unauthorized' },
  { path: '/team-member/tasks', allowedRoles: ['TeamMember'], redirectTo: '/unauthorized' },
  { path: '/team-member/schedules', allowedRoles: ['TeamMember'], redirectTo: '/unauthorized' },
  { path: '/team-member/pipeline', allowedRoles: ['TeamMember'], redirectTo: '/unauthorized' },
  
  // IT routes
  { path: '/it-dashboard', allowedRoles: ['IT'], redirectTo: '/unauthorized' },
  { path: '/it-new-tickets', allowedRoles: ['IT'], redirectTo: '/unauthorized' },
  { path: '/it-tickets-list', allowedRoles: ['IT'], redirectTo: '/unauthorized' },
  { path: '/submit-it-ticket', allowedRoles: ['IT', 'Manager', 'TeamLeader', 'AccountManager'], redirectTo: '/unauthorized' },
  { path: '/my-it-tickets', allowedRoles: ['IT', 'Manager', 'TeamLeader', 'AccountManager'], redirectTo: '/unauthorized' },
  { path: '/it-tickets/:id', allowedRoles: ['IT', 'Manager', 'TeamLeader', 'AccountManager'], redirectTo: '/unauthorized' },
  
  // Shared routes (accessible by multiple roles)
  { path: '/leads-list', allowedRoles: ['Agent', 'SeniorAgent', 'QualityControl', 'Manager', 'TeamLeader', 'AccountManager'], redirectTo: '/unauthorized' },
  { path: '/leaderboard', allowedRoles: ['Agent', 'SeniorAgent', 'Manager', 'TeamLeader', 'AccountManager'], redirectTo: '/unauthorized' },
  { path: '/check-duplicate', allowedRoles: ['QualityControl', 'Manager', 'TeamLeader', 'AccountManager'], redirectTo: '/unauthorized' },
];

// Helper function to check if a user can access a route
export const canAccessRoute = (path: string, userRole: UserRole | undefined): boolean => {
  if (!userRole) return false;
  
  // Find matching route permission (support wildcards)
  const permission = routePermissions.find(p => {
    // Exact match
    if (p.path === path) return true;
    
    // Wildcard match (e.g., /client/leads/:id matches /client/leads/123)
    const pathPattern = p.path.replace(/:[^/]+/g, '[^/]+');
    const regex = new RegExp(`^${pathPattern}$`);
    return regex.test(path);
  });
  
  // If no specific permission found, deny access (whitelist approach)
  if (!permission) return false;
  
  return permission.allowedRoles.includes(userRole);
};

// Get redirect path for unauthorized access
export const getUnauthorizedRedirect = (path: string, userRole: UserRole | undefined): string => {
  if (!userRole) return '/login';
  
  // Find matching route permission
  const permission = routePermissions.find(p => {
    const pathPattern = p.path.replace(/:[^/]+/g, '[^/]+');
    const regex = new RegExp(`^${pathPattern}$`);
    return regex.test(path);
  });
  
  // Return role-specific home page
  const roleHomePage: Record<UserRole, string> = {
    Agent: '/',
    SeniorAgent: '/senior-agent-dashboard',
    QualityControl: '/qc-analytics',
    TeamLeader: '/team-leader-dashboard',
    AccountManager: '/account-manager-dashboard',
    Manager: '/admin',
    Client: '/client',
    TeamMember: '/team-member/dashboard',
    IT: '/it-dashboard',
  };
  
  return permission?.redirectTo || roleHomePage[userRole] || '/unauthorized';
};

// Get home page for a role
export const getRoleHomePage = (role: UserRole): string => {
  const roleHomePage: Record<UserRole, string> = {
    Agent: '/',
    SeniorAgent: '/senior-agent-dashboard',
    QualityControl: '/qc-analytics',
    TeamLeader: '/team-leader-dashboard',
    AccountManager: '/account-manager-dashboard',
    Manager: '/admin',
    Client: '/client',
    TeamMember: '/team-member/dashboard',
    IT: '/it-dashboard',
  };
  
  return roleHomePage[role] || '/';
};
