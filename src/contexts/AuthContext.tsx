import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { AppRole, StaffWithRoles, hasPermission, getDefaultRoute, isAdmin } from '@/types/auth';

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  pendingVerification: boolean;
  currentStaff: StaffWithRoles | null;
  roles: AppRole[];
  pendingStaffId: string | null;
  requestLogin: (username: string, password: string) => Promise<{ error: string | null; staffId?: string }>;
  verifyCode: (code: string) => Promise<{ error: string | null }>;
  logout: () => void;
  hasPermission: (route: string) => boolean;
  isAdminUser: () => boolean;
  getDefaultRoute: () => string;
}

const AuthContext = createContext<AuthContextType | null>(null);
const AUTH_KEY = 'dejavu_verified_auth';
const STAFF_KEY = 'dejavu_current_staff';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [currentStaff, setCurrentStaff] = useState<StaffWithRoles | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [pendingVerification, setPendingVerification] = useState(false);
  const [pendingStaffId, setPendingStaffId] = useState<string | null>(null);

  // Initialize auth state from localStorage
  useEffect(() => {
    const savedAuth = localStorage.getItem(AUTH_KEY) === 'true';
    const savedStaff = localStorage.getItem(STAFF_KEY);
    
    if (savedAuth && savedStaff) {
      try {
        const parsed = JSON.parse(savedStaff);
        setCurrentStaff(parsed);
        setRoles(parsed.roles || []);
        setIsAuthenticated(true);
      } catch (e) {
        // Invalid data, clear it
        localStorage.removeItem(AUTH_KEY);
        localStorage.removeItem(STAFF_KEY);
      }
    }
    setIsInitialized(true);
  }, []);

  useEffect(() => {
    if (!isInitialized) return;
    
    localStorage.setItem(AUTH_KEY, String(isAuthenticated));
    if (currentStaff) {
      localStorage.setItem(STAFF_KEY, JSON.stringify(currentStaff));
    } else {
      localStorage.removeItem(STAFF_KEY);
    }
  }, [isAuthenticated, currentStaff, isInitialized]);

  const requestLogin = async (username: string, password: string): Promise<{ error: string | null; staffId?: string }> => {
    try {
      setIsLoading(true);
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-login-code?action=request`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            username,
            password,
            userAgent: navigator.userAgent,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        return { error: data.error || 'Error al iniciar sesión' };
      }

      setPendingVerification(true);
      setPendingStaffId(data.staffId);
      
      // Store pending staff info temporarily
      setRoles(data.roles || []);
      
      return { error: null, staffId: data.staffId };
    } catch (error: any) {
      return { error: error.message || 'Error de conexión' };
    } finally {
      setIsLoading(false);
    }
  };

  const verifyCode = async (code: string): Promise<{ error: string | null }> => {
    try {
      setIsLoading(true);
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-login-code?action=verify`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ 
            code,
            staffId: pendingStaffId 
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        return { error: data.error || 'Código inválido' };
      }

      // Set authenticated state with staff data
      const staffWithRoles: StaffWithRoles = {
        ...data.staff,
        roles: data.roles,
        is_active: true,
        phone: null,
        created_at: new Date(),
        updated_at: new Date()
      };
      
      setCurrentStaff(staffWithRoles);
      setRoles(data.roles);
      setIsAuthenticated(true);
      setPendingVerification(false);
      setPendingStaffId(null);
      
      return { error: null };
    } catch (error: any) {
      return { error: error.message || 'Error de conexión' };
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setIsAuthenticated(false);
    setCurrentStaff(null);
    setRoles([]);
    setPendingVerification(false);
    setPendingStaffId(null);
    localStorage.removeItem(AUTH_KEY);
    localStorage.removeItem(STAFF_KEY);
  };

  const checkPermission = (route: string): boolean => {
    if (!isAuthenticated || roles.length === 0) return false;
    return hasPermission(roles, route);
  };

  const isAdminUser = (): boolean => {
    return isAdmin(roles);
  };

  const getUserDefaultRoute = (): string => {
    return getDefaultRoute(roles);
  };

  // Show loading while initializing
  if (!isInitialized) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <AuthContext.Provider 
      value={{ 
        isAuthenticated,
        isLoading,
        pendingVerification,
        currentStaff,
        roles,
        pendingStaffId,
        requestLogin,
        verifyCode,
        logout,
        hasPermission: checkPermission,
        isAdminUser,
        getDefaultRoute: getUserDefaultRoute,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    return {
      isAuthenticated: false,
      isLoading: false,
      pendingVerification: false,
      currentStaff: null,
      roles: [] as AppRole[],
      pendingStaffId: null,
      requestLogin: async () => ({ error: 'Auth context not available' }),
      verifyCode: async () => ({ error: 'Auth context not available' }),
      logout: () => {},
      hasPermission: () => false,
      isAdminUser: () => false,
      getDefaultRoute: () => '/login',
    };
  }
  return context;
}
