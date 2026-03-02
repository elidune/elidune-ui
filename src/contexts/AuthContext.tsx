import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import api from '@/services/api';
import type { User, LoginRequest, LoginResponse, TwoFactorMethod } from '@/types';

// Pending 2FA state when login requires verification
interface Pending2FA {
  userId: string;
  method: TwoFactorMethod;
  user: LoginResponse['user'];
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  pending2FA: Pending2FA | null;
  login: (credentials: LoginRequest) => Promise<{ requires2FA: boolean }>;
  verify2FA: (code: string, trustDevice?: boolean) => Promise<void>;
  verifyRecovery: (code: string) => Promise<void>;
  cancel2FA: () => void;
  logout: () => void;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pending2FA, setPending2FA] = useState<Pending2FA | null>(null);

  const refreshProfile = async () => {
    try {
      const profile = await api.getProfile();
      setUser(profile);
    } catch {
      setUser(null);
      api.logout();
    }
  };

  useEffect(() => {
    const initAuth = async () => {
      if (api.isAuthenticated()) {
        await refreshProfile();
      }
      setIsLoading(false);
    };
    initAuth();
  }, []);

  const login = async (credentials: LoginRequest): Promise<{ requires2FA: boolean }> => {
    const response = await api.login(credentials);
    
    // If 2FA is required, store pending state
    if (response.requires_2fa) {
      setPending2FA({
        userId: response.user.id,
        method: (response.two_factor_method || 'totp') as TwoFactorMethod,
        user: response.user,
      });
      return { requires2FA: true };
    }
    
    // No 2FA required, set user directly
    setUser({
      id: response.user.id,
      username: response.user.login,
      login: response.user.login,
      firstname: response.user.firstname,
      lastname: response.user.lastname,
      account_type: response.user.account_type,
      language: response.user.language,
    });
    // Refresh profile to get complete user data
    await refreshProfile();
    return { requires2FA: false };
  };

  const verify2FA = async (code: string, trustDevice = false) => {
    if (!pending2FA) throw new Error('No pending 2FA verification');
    
    await api.verify2FA({
      user_id: pending2FA.userId,
      code,
      trust_device: trustDevice,
      device_id: api.getDeviceId() ?? undefined,
    });
    
    // Set user from pending state
    setUser({
      id: pending2FA.user.id,
      username: pending2FA.user.login,
      login: pending2FA.user.login,
      firstname: pending2FA.user.firstname,
      lastname: pending2FA.user.lastname,
      account_type: pending2FA.user.account_type,
      language: pending2FA.user.language,
    });
    setPending2FA(null);
    
    // Refresh profile to get complete user data
    await refreshProfile();
  };

  const verifyRecovery = async (code: string) => {
    if (!pending2FA) throw new Error('No pending 2FA verification');
    
    await api.verifyRecovery({
      user_id: pending2FA.userId,
      code,
    });
    
    // Set user from pending state
    setUser({
      id: pending2FA.user.id,
      username: pending2FA.user.login,
      login: pending2FA.user.login,
      firstname: pending2FA.user.firstname,
      lastname: pending2FA.user.lastname,
      account_type: pending2FA.user.account_type,
      language: pending2FA.user.language,
    });
    setPending2FA(null);
    
    // Refresh profile to get complete user data
    await refreshProfile();
  };

  const cancel2FA = () => {
    setPending2FA(null);
  };

  const logout = () => {
    api.logout();
    setUser(null);
    setPending2FA(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        pending2FA,
        login,
        verify2FA,
        verifyRecovery,
        cancel2FA,
        logout,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}


