'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import * as api from '@/lib/api';

interface User {
  id: string;
  email: string;
  role: string;
  tenantId: string;
}

interface Tenant {
  id: string;
  name: string;
  role: string;
}

interface AuthState {
  user: User | null;
  tenants: Tenant[];
  accessToken: string | null;
  refreshToken: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

interface AuthContextValue extends AuthState {
  login: (email: string, otp: string) => Promise<{ success: boolean; message: string; recoveryCodes?: string[] }>;
  register: (email: string, password: string, tenantName?: string) => Promise<{ success: boolean; message: string; recoveryCodes?: string[] }>;
  logout: () => void;
  switchTenant: (tenantId: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const AUTH_STORAGE_KEY = 'bastion_vault_auth';
const AUTH_STORAGE_LEGACY_KEY = 'kvx_auth';

function readAuthFromStorage(): string | null {
  if (typeof window === 'undefined') return null;
  const next = localStorage.getItem(AUTH_STORAGE_KEY);
  if (next) return next;
  const legacy = localStorage.getItem(AUTH_STORAGE_LEGACY_KEY);
  if (legacy) {
    localStorage.setItem(AUTH_STORAGE_KEY, legacy);
    localStorage.removeItem(AUTH_STORAGE_LEGACY_KEY);
  }
  return legacy;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    tenants: [],
    accessToken: null,
    refreshToken: null,
    isLoading: true,
    isAuthenticated: false,
  });

  // Hydrate from localStorage on mount
  useEffect(() => {
    const stored = readAuthFromStorage();
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setState({
          ...parsed,
          isLoading: false,
          isAuthenticated: !!parsed.accessToken,
        });
      } catch {
        setState(prev => ({ ...prev, isLoading: false }));
      }
    } else {
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, []);

  // Persist to localStorage on change
  useEffect(() => {
    if (!state.isLoading) {
      if (state.accessToken) {
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({
          user: state.user,
          tenants: state.tenants,
          accessToken: state.accessToken,
          refreshToken: state.refreshToken,
        }));
        localStorage.removeItem(AUTH_STORAGE_LEGACY_KEY);
      } else {
        localStorage.removeItem(AUTH_STORAGE_KEY);
        localStorage.removeItem(AUTH_STORAGE_LEGACY_KEY);
      }
    }
  }, [state.user, state.accessToken, state.refreshToken, state.tenants, state.isLoading]);

  const loginFn = useCallback(async (email: string, otp: string) => {
    const result = await api.login(email, otp);
    if (result.success && result.accessToken && result.user) {
      setState({
        user: result.user,
        tenants: result.tenants || [],
        accessToken: result.accessToken,
        refreshToken: result.refreshToken || null,
        isLoading: false,
        isAuthenticated: true,
      });
    }
    return { success: result.success, message: result.message };
  }, []);

  const registerFn = useCallback(async (email: string, password: string, tenantName?: string) => {
    const result = await api.register(email, password, tenantName);
    return {
      success: result.success,
      message: result.message,
      recoveryCodes: result.recoveryCodes,
    };
  }, []);

  const logout = useCallback(() => {
    setState({
      user: null,
      tenants: [],
      accessToken: null,
      refreshToken: null,
      isLoading: false,
      isAuthenticated: false,
    });
    localStorage.removeItem(AUTH_STORAGE_KEY);
    localStorage.removeItem(AUTH_STORAGE_LEGACY_KEY);
  }, []);

  const switchTenantFn = useCallback(async (tenantId: string) => {
    if (!state.accessToken) return;
    const result = await api.switchTenant(state.accessToken, tenantId);
    if (result.success && result.accessToken) {
      const tenant = state.tenants.find(t => t.id === tenantId);
      setState(prev => ({
        ...prev,
        accessToken: result.accessToken!,
        refreshToken: result.refreshToken || prev.refreshToken,
        user: prev.user ? {
          ...prev.user,
          tenantId,
          role: tenant?.role?.toLowerCase() || prev.user.role,
        } : null,
      }));
    }
  }, [state.accessToken, state.tenants]);

  return (
    <AuthContext.Provider value={{
      ...state,
      login: loginFn,
      register: registerFn,
      logout,
      switchTenant: switchTenantFn,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
