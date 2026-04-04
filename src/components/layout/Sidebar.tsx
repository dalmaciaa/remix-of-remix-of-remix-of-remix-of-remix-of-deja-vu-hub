import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Package, ShoppingCart, Receipt, Menu, X, Wine, LogOut, PartyPopper, ChefHat, Users, UtensilsCrossed, Coffee, Bell, ClipboardList, History, Banknote, DollarSign, ShoppingBasket, Bot, Ticket, ScanLine, ListChecks, FileImage, ChevronDown, FlaskConical } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { getAllowedMenuItems, ROLE_PERMISSIONS } from '@/types/auth';
import { Badge } from '@/components/ui/badge';
import { useNotifications } from '@/hooks/useNotifications';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface NavItem {
  id: string;
  path: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface NavGroup {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  items: NavItem[];
}

const allNavItems: NavItem[] = [
  { id: 'dashboard', path: '/', label: 'Panel', icon: LayoutDashboard },
  { id: 'my-orders', path: '/my-orders', label: 'Mis Pedidos', icon: ClipboardList },
  { id: 'my-history', path: '/my-history', label: 'Mi Historial', icon: History },
  { id: 'cash-register', path: '/cash-register', label: 'Caja', icon: Banknote },
  { id: 'cashier-collect', path: '/cashier-collect', label: 'Cobrar', icon: DollarSign },
  { id: 'staff-history', path: '/staff-history', label: 'Historial Personal', icon: Users },
  { id: 'inventory', path: '/inventory', label: 'Inventario', icon: Package },
  { id: 'catalog', path: '/catalog', label: 'Catálogo de Venta', icon: UtensilsCrossed },
  { id: 'sales', path: '/sales', label: 'Ventas', icon: ShoppingCart },
  { id: 'expenses', path: '/expenses', label: 'Gastos', icon: Receipt },
  { id: 'events', path: '/events', label: 'Eventos', icon: PartyPopper },
  { id: 'kitchen', path: '/kitchen', label: 'Pedidos de Cocina', icon: ChefHat },
  { id: 'bartender', path: '/bartender', label: 'Pedidos de Barra', icon: Wine },
  { id: 'staff', path: '/staff', label: 'Personal', icon: Users },
  { id: 'internal-consumption', path: '/internal-consumption', label: 'Consumo Interno', icon: Coffee },
  { id: 'purchase-history', path: '/purchase-history', label: 'Historial Compras', icon: ShoppingBasket },
  { id: 'admin-assistant', path: '/admin-assistant', label: 'Asistente IA', icon: Bot },
  { id: 'ticket-create', path: '/ticket-create', label: 'Crear Entradas', icon: Ticket },
  { id: 'ticket-verify', path: '/ticket-verify', label: 'Verificar Entradas', icon: ScanLine },
  { id: 'ticket-admin', path: '/ticket-admin', label: 'Admin Entradas', icon: ListChecks },
  { id: 'menu-generator', path: '/menu-generator', label: 'Generar Menú', icon: FileImage },
];

// Group definitions with the item IDs they contain
const navGroups: { label: string; icon: React.ComponentType<{ className?: string }>; itemIds: string[] }[] = [
  {
    label: 'General',
    icon: LayoutDashboard,
    itemIds: ['dashboard'],
  },
  {
    label: 'Pedidos',
    icon: ClipboardList,
    itemIds: ['my-orders', 'my-history', 'kitchen', 'bartender'],
  },
  {
    label: 'Caja & Finanzas',
    icon: Banknote,
    itemIds: ['cash-register', 'cashier-collect', 'sales', 'expenses', 'staff-history'],
  },
  {
    label: 'Productos & Stock',
    icon: Package,
    itemIds: ['catalog', 'inventory', 'purchase-history', 'internal-consumption', 'menu-generator'],
  },
  {
    label: 'Entradas',
    icon: Ticket,
    itemIds: ['ticket-create', 'ticket-verify', 'ticket-admin'],
  },
  {
    label: 'Administración',
    icon: Users,
    itemIds: ['staff', 'events', 'admin-assistant'],
  },
];

function getVisibleGroups(allowedIds: string[]): NavGroup[] {
  const itemMap = new Map(allNavItems.map(i => [i.id, i]));
  const groups: NavGroup[] = [];

  for (const group of navGroups) {
    const items = group.itemIds
      .filter(id => allowedIds.includes(id))
      .map(id => itemMap.get(id)!)
      .filter(Boolean);

    if (items.length > 0) {
      groups.push({ label: group.label, icon: group.icon, items });
    }
  }

  return groups;
}

export function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout, currentStaff, roles } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const allowedMenuIds = getAllowedMenuItems(roles);
  const visibleGroups = getVisibleGroups(allowedMenuIds);
  const roleLabels = roles.map(role => ROLE_PERMISSIONS[role].label);

  return (
    <>
      {/* Mobile menu button */}
      <Button variant="ghost" size="icon" className="fixed top-4 left-4 z-50 lg:hidden" onClick={() => setIsOpen(!isOpen)}>
        {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
      </Button>

      {/* Overlay */}
      {isOpen && <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 lg:hidden" onClick={() => setIsOpen(false)} />}

      {/* Sidebar */}
      <aside className={cn("fixed left-0 top-0 h-full w-64 bg-sidebar border-r border-sidebar-border z-40 transition-transform duration-300 lg:translate-x-0", isOpen ? "translate-x-0" : "-translate-x-full")}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-6 border-b border-sidebar-border">
            <Link to="/" className="flex items-center gap-3" onClick={() => setIsOpen(false)}>
              <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                <Wine className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h1 className="font-display text-xl font-semibold gradient-text">Deja-Vu</h1>
                <p className="text-xs text-muted-foreground">Retro Pub</p>
              </div>
            </Link>
          </div>

          {/* User info */}
          {currentStaff && (
            <div className="px-4 py-3 border-b border-sidebar-border bg-muted/30">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm truncate">{currentStaff.full_name}</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {roleLabels.map((label, idx) => (
                      <Badge key={idx} variant="secondary" className="text-xs">{label}</Badge>
                    ))}
                  </div>
                </div>

                {/* Notifications */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" size="icon" className="relative">
                      <Bell className="w-5 h-5" />
                      {unreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-xs w-5 h-5 rounded-full flex items-center justify-center">
                          {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80 p-0" align="end">
                    <div className="p-3 border-b flex justify-between items-center">
                      <h4 className="font-semibold">Notificaciones</h4>
                      {unreadCount > 0 && (
                        <Button variant="ghost" size="sm" onClick={markAllAsRead}>Marcar todas</Button>
                      )}
                    </div>
                    <ScrollArea className="h-64">
                      {notifications.length === 0 ? (
                        <div className="p-4 text-center text-muted-foreground text-sm">No hay notificaciones</div>
                      ) : (
                        <div className="divide-y">
                          {notifications.map(notification => (
                            <div key={notification.id} className="p-3 hover:bg-muted/50 cursor-pointer" onClick={() => markAsRead(notification.id)}>
                              <p className="font-medium text-sm">{notification.title}</p>
                              <p className="text-xs text-muted-foreground mt-1">{notification.message}</p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {new Date(notification.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </ScrollArea>
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          )}

          {/* Navigation grouped */}
          <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
            {visibleGroups.map((group) => {
              const groupHasActiveRoute = group.items.some(item => location.pathname === item.path);

              // If group has only 1 item, render it directly without collapsible
              if (group.items.length === 1) {
                const item = group.items[0];
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setIsOpen(false)}
                    className={cn("nav-link", isActive && "nav-link-active")}
                  >
                    <item.icon className="w-5 h-5" />
                    <span className="font-medium">{item.label}</span>
                  </Link>
                );
              }

              return (
                <Collapsible key={group.label} defaultOpen={groupHasActiveRoute}>
                  <CollapsibleTrigger className="flex items-center w-full px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors group">
                    <group.icon className="w-4 h-4 mr-2 shrink-0" />
                    <span className="font-semibold text-xs uppercase tracking-wider flex-1 text-left">{group.label}</span>
                    <ChevronDown className="w-4 h-4 shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="ml-3 pl-3 border-l border-sidebar-border space-y-0.5 mt-1 mb-2">
                      {group.items.map(item => {
                        const isActive = location.pathname === item.path;
                        return (
                          <Link
                            key={item.path}
                            to={item.path}
                            onClick={() => setIsOpen(false)}
                            className={cn(
                              "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                              isActive
                                ? "bg-primary/10 text-primary font-medium"
                                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                            )}
                          >
                            <item.icon className="w-4 h-4 shrink-0" />
                            <span>{item.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              );
            })}
          </nav>

          {/* Footer */}
          <div className="p-4 border-t border-sidebar-border space-y-3">
            <Button variant="ghost" className="w-full justify-start text-muted-foreground hover:text-destructive" onClick={handleLogout}>
              <LogOut className="w-4 h-4 mr-2" />
              Cerrar Sesión
            </Button>
            <p className="text-xs text-muted-foreground text-center">Sistema de Gestión v35.7.0</p>
          </div>
        </div>
      </aside>
    </>
  );
}
