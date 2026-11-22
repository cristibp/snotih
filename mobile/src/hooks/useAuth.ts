import { useEffect, useState } from 'react';

export type UserRole = 'admin' | 'user';

export interface AuthUser {
  email: string;
  role: UserRole;
}

const API_BASE_URL = 'https://snoti.onrender.com';

/**
 * Hook that checks the current session on mount by calling GET /api/auth/me.
 * Uses the browser's HttpOnly session cookie (credentials: 'include').
 */
export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    fetch(`${API_BASE_URL}/api/auth/me`, { credentials: 'include' })
      .then((res) => {
        if (!res.ok) throw new Error('unauthenticated');
        return res.json() as Promise<AuthUser>;
      })
      .then((data) => {
        if (!cancelled) setUser(data);
      })
      .catch(() => {
        if (!cancelled) setUser(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const logout = async () => {
    try {
      await fetch(`${API_BASE_URL}/api/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch {
      // best-effort
    }
    setUser(null);
    // On web reload to clear any state and redirect to login
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  return { user, loading, logout };
}
