// Standardized role badge colors across the entire system
export const getRoleBadgeColor = (role: string): string => {
  switch (role) {
    case 'Admin':
      return 'bg-red-100 text-red-800 border border-red-200';
    case 'Manager':
      return 'bg-indigo-100 text-indigo-800 border border-indigo-200';
    case 'AccountManager':
      return 'bg-pink-100 text-pink-800 border border-pink-200';
    case 'TeamLeader':
      return 'bg-blue-100 text-blue-800 border border-blue-200';
    case 'SeniorAgent':
      return 'bg-green-100 text-green-800 border border-green-200';
    case 'Agent':
      return 'bg-green-100 text-green-800 border border-green-200';
    case 'QualityControl':
      return 'bg-orange-100 text-orange-800 border border-orange-200';
    case 'IT':
      return 'bg-teal-100 text-teal-800 border border-teal-200';
    case 'Client':
      return 'bg-gray-100 text-gray-800 border border-gray-200';
    case 'TeamMember':
      return 'bg-cyan-100 text-cyan-800 border border-cyan-200';
    default:
      return 'bg-gray-100 text-gray-800 border border-gray-200';
  }
};

export const getRoleLabel = (role: string): string => {
  switch (role) {
    case 'Admin':
      return 'Admin';
    case 'Manager':
      return 'Manager';
    case 'AccountManager':
      return 'Account Manager';
    case 'TeamLeader':
      return 'Team Leader';
    case 'SeniorAgent':
      return 'Senior Agent';
    case 'Agent':
      return 'Agent';
    case 'QualityControl':
      return 'Quality Control';
    case 'IT':
      return 'IT';
    case 'Client':
      return 'Client';
    default:
      return role;
  }
};

// Short labels for compact displays
export const getRoleShortLabel = (role: string): string => {
  switch (role) {
    case 'Admin':
      return 'Admin';
    case 'Manager':
      return 'Manager';
    case 'AccountManager':
      return 'ACM';
    case 'TeamLeader':
      return 'TL';
    case 'SeniorAgent':
      return 'Senior';
    case 'Agent':
      return 'Agent';
    case 'QualityControl':
      return 'QC';
    case 'IT':
      return 'IT';
    case 'Client':
      return 'Client';
    default:
      return role;
  }
};
