'use client';

import { useEffect, useState } from 'react';

export type Role = 'super_admin' | 'admin' | 'rider';

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  role: Role;
  fullName?: string | null;
  status?: string;
  mustChangePassword?: boolean;
}

const TOKEN_KEY = 'token';
const USER_KEY = 'user';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function getUser(): AuthUser | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

export function setSession(token: string, user: AuthUser) {
  try {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    window.dispatchEvent(new Event('nize:auth'));
  } catch {
    /* storage unavailable — session lasts for this page only */
  }
}

export function clearSession() {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    window.dispatchEvent(new Event('nize:auth'));
  } catch {
    /* nothing to clear */
  }
}

export function isAdmin(user: AuthUser | null): boolean {
  return user?.role === 'admin' || user?.role === 'super_admin';
}

/** Where a role lands after signing in. */
export function homeForRole(role?: Role | null): string {
  if (role === 'admin' || role === 'super_admin') return '/admin';
  if (role === 'rider') return '/rider';
  return '/';
}

/**
 * Reads the cached session. `loading` stays true until the first client read,
 * so guards don't redirect during SSR/hydration.
 */
export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const sync = () => setUser(getUser());
    sync();
    setLoading(false);
    // Keep tabs and components in sync on login/logout.
    window.addEventListener('nize:auth', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('nize:auth', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  return { user, loading, isAuthenticated: !!user };
}
