import { useEffect, useState } from 'react';
import {
  extractTokenFromUrl,
  saveAuthToken,
  getAuthToken,
  clearAuthToken,
  getAuthHeaders,
} from '../services/authStorage';

export type UserRole = 'admin' | 'user';

export interface AuthUser {
  email: string;
  role: UserRole;
}

const API_BASE_URL = 'https://snoti.onrender.com';

/**
 * Hook that checks the current session on mount by calling GET /api/auth/me.
 * Supports:
 *  1. Bearer token extracted from URL fragment after OAuth callback and stored in AsyncStorage / localStorage
 *     (bypasses 3rd-party cookie blocking on iOS Brave / Safari / ITP).
 *  2. HttpOnly session cookie (credentials: 'include') as fallback.
 */
export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function checkSession() {
      try {
        // Check if returning from OAuth redirect with token in URL (#session_token=...)
        const urlToken = extractTokenFromUrl();
        if (urlToken) {
          await saveAuthToken(urlToken);
        }

        const headers = await getAuthHeaders();
        const res = await fetch(`${API_BASE_URL}/api/auth/me`, {
          headers,
          credentials: 'include',
        });

        if (!res.ok) {
          throw new Error(`unauthenticated: ${res.status}`);
        }

        const data = (await res.json()) as AuthUser;
        if (!cancelled) {
          setUser(data);
        }
      } catch {
        // Clear invalid or expired token
        await clearAuthToken();
        if (!cancelled) {
          setUser(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    checkSession();

    return () => {
      cancelled = true;
    };
  }, []);

  const logout = async () => {
    try {
      const headers = await getAuthHeaders();
      await fetch(`${API_BASE_URL}/api/auth/logout`, {
        method: 'POST',
        headers,
        credentials: 'include',
      });
    } catch {
      // best-effort
    }
    await clearAuthToken();
    setUser(null);
    // On web reload to clear any state and redirect to login
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  return { user, loading, logout };
}

export { getAuthHeaders, getAuthToken, clearAuthToken };
