import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import api from '@/services/api';
import type { User, LoginRequest, LoginResponse, TwoFactorMethod } from '@/types';

const MUST_CHANGE_PASSWORD_KEY = 'elidune_must_change_password';

function readMustChangePasswordFlag(): boolean {
  return localStorage.getItem(MUST_CHANGE_PASSWORD_KEY) === '1';
}

function setMustChangePasswordFlag(on: boolean) {
  if (on) {
    localStorage.setItem(MUST_CHANGE_PASSWORD_KEY, '1');
  } else {
    localStorage.removeItem(MUST_CHANGE_PASSWORD_KEY);
  }
}

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
  mustChangePassword: boolean;
  pending2FA: Pending2FA | null;
  login: (credentials: LoginRequest) => Promise<{ requires2FA: boolean; mustChangePassword?: boolean }>;
  verify2FA: (code: string, trustDevice?: boolean) => Promise<{ mustChangePassword?: boolean }>;
  verifyRecovery: (code: string) => Promise<{ mustChangePassword?: boolean }>;
  cancel2FA: () => void;
  logout: () => void;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pending2FA, setPending2FA] = useState<Pending2FA | null>(null);
  const [mustChangePassword, setMustChangePassword] = useState(false);

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
        if (readMustChangePasswordFlag()) {
          setMustChangePassword(true);
        } else {
          await refreshProfile();
        }
      }
      setIsLoading(false);
    };
    initAuth();
  }, []);

  const login = async (
    credentials: LoginRequest
  ): Promise<{ requires2FA: boolean; mustChangePassword?: boolean }> => {
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

    if (response.must_change_password) {
      setMustChangePassword(true);
      setMustChangePasswordFlag(true);
      return { requires2FA: false, mustChangePassword: true };
    }

    setMustChangePassword(false);
    setMustChangePasswordFlag(false);

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
    const pending = pending2FA;

    const res = await api.verify2FA({
      user_id: pending.userId,
      code,
      trust_device: trustDevice,
      device_id: api.getDeviceId() ?? undefined,
    });

    setPending2FA(null);

    if (res.must_change_password) {
      setMustChangePassword(true);
      setMustChangePasswordFlag(true);
      return { mustChangePassword: true };
    }

    setMustChangePassword(false);
    setMustChangePasswordFlag(false);

    // Set user from pending state
    setUser({
      id: pending.user.id,
      username: pending.user.login,
      login: pending.user.login,
      firstname: pending.user.firstname,
      lastname: pending.user.lastname,
      account_type: pending.user.account_type,
      language: pending.user.language,
    });

    // Refresh profile to get complete user data
    await refreshProfile();
    return { mustChangePassword: false };
  };

  const verifyRecovery = async (code: string) => {
    if (!pending2FA) throw new Error('No pending 2FA verification');
    const pending = pending2FA;

    const res = await api.verifyRecovery({
      user_id: pending.userId,
      code,
    });

    setPending2FA(null);

    if (res.must_change_password) {
      setMustChangePassword(true);
      setMustChangePasswordFlag(true);
      return { mustChangePassword: true };
    }

    setMustChangePassword(false);
    setMustChangePasswordFlag(false);

    // Set user from pending state
    setUser({
      id: pending.user.id,
      username: pending.user.login,
      login: pending.user.login,
      firstname: pending.user.firstname,
      lastname: pending.user.lastname,
      account_type: pending.user.account_type,
      language: pending.user.language,
    });

    // Refresh profile to get complete user data
    await refreshProfile();
    return { mustChangePassword: false };
  };

  const cancel2FA = () => {
    setPending2FA(null);
  };

  const logout = () => {
    api.logout();
    setUser(null);
    setPending2FA(null);
    setMustChangePassword(false);
    setMustChangePasswordFlag(false);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        mustChangePassword,
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


