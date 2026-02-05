import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  ClipboardList, 
  Package, 
  ChefHat,
  Menu,
  Wine,
  DollarSign,
  Banknote
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { getAllowedMenuItems } from '@/types/auth';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Sidebar } from './Sidebar';

interface QuickNavItem {
  id: string;
  path: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

// Quick access items for bottom nav (most used)
const quickNavItems: QuickNavItem[] = [
  { id: 'dashboard', path: '/', label: 'Panel', icon: LayoutDashboard },
  { id: 'my-orders', path: '/my-orders', label: 'Pedidos', icon: ClipboardList },
  { id: 'catalog', path: '/catalog', label: 'Catálogo', icon: Package },
  { id: 'kitchen', path: '/kitchen', label: 'Cocina', icon: ChefHat },
  { id: 'bartender', path: '/bartender', label: 'Barra', icon: Wine },
  { id: 'cashier-collect', path: '/cashier-collect', label: 'Cobrar', icon: DollarSign },
  { id: 'cash-register', path: '/cash-register', label: 'Caja', icon: Banknote },
];

export function MobileNav() {
  const location = useLocation();
  const { roles } = useAuth();
  
  // Get allowed menu items based on roles
  const allowedMenuIds = getAllowedMenuItems(roles);
  
  // Filter quick nav items to only show allowed ones, max 4 + menu button
  const visibleQuickItems = quickNavItems
    .filter(item => allowedMenuIds.includes(item.id))
    .slice(0, 4);

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-sidebar/95 backdrop-blur-lg border-t border-sidebar-border z-50 lg:hidden safe-area-bottom">
      <div className="flex items-center justify-around px-2 py-1">
        {visibleQuickItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex flex-col items-center justify-center min-w-[64px] py-2 px-3 rounded-lg transition-all",
                isActive 
                  ? "text-primary bg-primary/10" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <item.icon className={cn("w-6 h-6", isActive && "text-primary")} />
              <span className="text-[10px] mt-1 font-medium truncate max-w-[60px]">
                {item.label}
              </span>
            </Link>
          );
        })}
        
        {/* More menu button */}
        <Sheet>
          <SheetTrigger asChild>
            <Button 
              variant="ghost" 
              className="flex flex-col items-center justify-center min-w-[64px] h-auto py-2 px-3 text-muted-foreground hover:text-foreground"
            >
              <Menu className="w-6 h-6" />
              <span className="text-[10px] mt-1 font-medium">Más</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-72">
            <Sidebar isMobileSheet />
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  );
}
