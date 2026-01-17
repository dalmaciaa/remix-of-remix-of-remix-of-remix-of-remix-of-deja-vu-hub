export type AppRole = 'admin' | 'mozo' | 'cocina' | 'bartender' | 'cajero';

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
    allowedRoutes: ['/', '/inventory', '/catalog', '/sales', '/expenses', '/events', '/kitchen', '/bartender', '/staff', '/internal-consumption', '/my-orders', '/my-history', '/cash-register'],
    defaultRoute: '/',
    menuItems: ['dashboard', 'inventory', 'catalog', 'sales', 'expenses', 'events', 'kitchen', 'bartender', 'staff', 'internal-consumption', 'my-orders', 'my-history', 'cash-register']
  },
  mozo: {
    label: 'Mozo',
    allowedRoutes: ['/sales', '/kitchen', '/bartender', '/my-orders', '/my-history'],
    defaultRoute: '/my-orders',
    menuItems: ['sales', 'kitchen', 'bartender', 'my-orders', 'my-history']
  },
  cocina: {
    label: 'Cocina',
    allowedRoutes: ['/kitchen'],
    defaultRoute: '/kitchen',
    menuItems: ['kitchen']
  },
  bartender: {
    label: 'Bartender',
    allowedRoutes: ['/sales', '/bartender'],
    defaultRoute: '/bartender',
    menuItems: ['sales', 'bartender']
  },
  cajero: {
    label: 'Cajero',
    allowedRoutes: ['/cash-register', '/sales', '/expenses', '/staff-history'],
    defaultRoute: '/cash-register',
    menuItems: ['cash-register', 'sales', 'expenses', 'staff-history']
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
  // Priority: admin > cajero > mozo > bartender > cocina
  const priorityOrder: AppRole[] = ['admin', 'cajero', 'mozo', 'bartender', 'cocina'];
  
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

export function isCashier(roles: AppRole[]): boolean {
  return roles.includes('cajero') || roles.includes('admin');
}
