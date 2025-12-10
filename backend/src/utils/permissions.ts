/**
 * Centralized Permission Management
 * Defines all permission constants and utility functions
 */

/**
 * Permission Constants
 * Use these instead of hardcoded strings throughout the application
 */
export const PERMISSIONS = {
  // Pipeline Permissions
  PIPELINE: {
    VIEW: 'pipeline.view_pipeline',
    FULL_ACCESS: 'pipeline.full_access',
    MARK_CLOSED: 'pipeline.mark_closed',
    MARK_DEAD: 'pipeline.mark_dead'
  },
  
  // Lead Permissions
  LEADS: {
    VIEW_ALL: 'leads.view_all'
  },
  
  // Task Permissions
  TASKS: {
    VIEW_OWN: 'tasks.view_own',
    VIEW_ALL: 'tasks.view_all',
    CREATE: 'tasks.create',
    EDIT: 'tasks.edit',
    DELETE: 'tasks.delete'
  },
  
  // Note Permissions
  NOTES: {
    VIEW: 'notes.view',
    CREATE: 'notes.create',
    EDIT: 'notes.edit',
    DELETE: 'notes.delete'
  },
  
  // Schedule Permissions
  SCHEDULES: {
    VIEW: 'schedules.view',
    CREATE: 'schedules.create',
    EDIT: 'schedules.edit',
    DELETE: 'schedules.delete'
  }
} as const;

/**
 * Check if a user has a specific permission
 * @param permissions - User's permission object from position
 * @param permissionPath - Dot-notation permission path (e.g., 'pipeline.view_pipeline')
 * @returns boolean indicating if user has the permission
 */
export function hasPermission(permissions: any, permissionPath: string): boolean {
  if (!permissions) return false;
  
  const keys = permissionPath.split('.');
  let value: any = permissions;
  
  for (const key of keys) {
    value = value?.[key];
    if (value === undefined) return false;
  }
  
  return value === true;
}

/**
 * Check if user has ANY of the specified permissions
 * @param permissions - User's permission object
 * @param permissionPaths - Array of permission paths
 * @returns boolean indicating if user has at least one permission
 */
export function hasAnyPermission(permissions: any, permissionPaths: string[]): boolean {
  return permissionPaths.some(path => hasPermission(permissions, path));
}

/**
 * Check if user has ALL of the specified permissions
 * @param permissions - User's permission object
 * @param permissionPaths - Array of permission paths
 * @returns boolean indicating if user has all permissions
 */
export function hasAllPermissions(permissions: any, permissionPaths: string[]): boolean {
  return permissionPaths.every(path => hasPermission(permissions, path));
}

/**
 * Get a user-friendly error message for missing permissions
 * @param permissionPath - The permission that was denied
 * @returns User-friendly error message
 */
export function getPermissionErrorMessage(permissionPath: string): string {
  const messages: Record<string, string> = {
    'pipeline.view_pipeline': 'You do not have permission to view the pipeline',
    'pipeline.full_access': 'You do not have full pipeline access',
    'pipeline.mark_closed': 'You do not have permission to mark leads as closed',
    'pipeline.mark_dead': 'You do not have permission to mark leads as dead',
    'leads.view_all': 'You do not have permission to view all leads',
    'tasks.view_own': 'You do not have permission to view tasks',
    'tasks.create': 'You do not have permission to create tasks',
    'notes.create': 'You do not have permission to add notes',
    'schedules.create': 'You do not have permission to create schedules'
  };
  
  return messages[permissionPath] || 'You do not have permission to perform this action';
}

/**
 * Default permission set for new positions
 * Can be used as a template when creating new positions
 */
export const DEFAULT_PERMISSIONS = {
  pipeline: {
    view_pipeline: true,
    full_access: false,
    mark_closed: false,
    mark_dead: false
  },
  leads: {
    view_all: false
  },
  tasks: {
    view_own: true,
    view_all: false,
    create: false,
    edit: false,
    delete: false
  },
  notes: {
    view: true,
    create: true,
    edit: true,
    delete: false
  },
  schedules: {
    view: true,
    create: true,
    edit: true,
    delete: false
  }
};

/**
 * Full access permission set (for managers/admins)
 */
export const FULL_ACCESS_PERMISSIONS = {
  pipeline: {
    view_pipeline: true,
    full_access: true,
    mark_closed: true,
    mark_dead: true
  },
  leads: {
    view_all: true
  },
  tasks: {
    view_own: true,
    view_all: true,
    create: true,
    edit: true,
    delete: true
  },
  notes: {
    view: true,
    create: true,
    edit: true,
    delete: true
  },
  schedules: {
    view: true,
    create: true,
    edit: true,
    delete: true
  }
};

/**
 * Read-only permission set
 */
export const READ_ONLY_PERMISSIONS = {
  pipeline: {
    view_pipeline: true,
    full_access: false,
    mark_closed: false,
    mark_dead: false
  },
  leads: {
    view_all: false
  },
  tasks: {
    view_own: true,
    view_all: false,
    create: false,
    edit: false,
    delete: false
  },
  notes: {
    view: true,
    create: false,
    edit: false,
    delete: false
  },
  schedules: {
    view: true,
    create: false,
    edit: false,
    delete: false
  }
};
