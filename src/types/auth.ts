export type AppRole = 'admin' | 'mozo' | 'cocina' | 'bartender';

export interface Staff {
  id: string;
  username: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface StaffWithRoles extends Staff {
  roles: AppRole[];
}

// Permissions by role
export const ROLE_PERMISSIONS: Record<AppRole, {
  label: string;
  allowedRoutes: string[];
  defaultRoute: string;
  menuItems: string[];
}> = {
  admin: {
    label: 'Administrador',
    allowedRoutes: ['/', '/inventory', '/catalog', '/sales', '/expenses', '/events', '/kitchen', '/staff', '/internal-consumption'],
    defaultRoute: '/',
    menuItems: ['dashboard', 'inventory', 'catalog', 'sales', 'expenses', 'events', 'kitchen', 'staff', 'internal-consumption']
  },
  mozo: {
    label: 'Mozo',
    allowedRoutes: ['/sales', '/kitchen'],
    defaultRoute: '/sales',
    menuItems: ['sales', 'kitchen']
  },
  cocina: {
    label: 'Cocina',
    allowedRoutes: ['/kitchen'],
    defaultRoute: '/kitchen',
    menuItems: ['kitchen']
  },
  bartender: {
    label: 'Bartender',
    allowedRoutes: ['/sales'],
    defaultRoute: '/sales',
    menuItems: ['sales']
  }
};

export function hasPermission(roles: AppRole[], route: string): boolean {
  return roles.some(role => {
    const permissions = ROLE_PERMISSIONS[role];
    return permissions.allowedRoutes.some(allowed => 
      route === allowed || route.startsWith(allowed + '/')
    );
  });
}

export function getDefaultRoute(roles: AppRole[]): string {
  // Priority: admin > mozo > bartender > cocina
  const priorityOrder: AppRole[] = ['admin', 'mozo', 'bartender', 'cocina'];
  
  for (const role of priorityOrder) {
    if (roles.includes(role)) {
      return ROLE_PERMISSIONS[role].defaultRoute;
    }
  }
  
  return '/login';
}

export function getAllowedMenuItems(roles: AppRole[]): string[] {
  const items = new Set<string>();
  
  roles.forEach(role => {
    ROLE_PERMISSIONS[role].menuItems.forEach(item => items.add(item));
  });
  
  return Array.from(items);
}

export function isAdmin(roles: AppRole[]): boolean {
  return roles.includes('admin');
}
