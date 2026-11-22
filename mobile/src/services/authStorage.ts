import AsyncStorage from '@react-native-async-storage/async-storage';

export const AUTH_TOKEN_KEY = '@snotih_session_token';

/**
 * Extracts session_token from URL hash (#session_token=...) or query (?session_token=...).
 * If found, removes it from window.history so it does not persist in the browser address bar.
 */
export function extractTokenFromUrl(): string | null {
  if (typeof window === 'undefined') return null;

  try {
    // 1. Check hash fragment first: #session_token=...
    if (window.location.hash) {
      const hashStr = window.location.hash.replace(/^#/, '');
      const hashParams = new URLSearchParams(hashStr);
      const token = hashParams.get('session_token');
      if (token) {
        hashParams.delete('session_token');
        const remaining = hashParams.toString();
        const newHash = remaining ? `#${remaining}` : '';
        const newUrl = window.location.pathname + window.location.search + newHash;
        window.history.replaceState(null, '', newUrl);
        return token;
      }
    }

    // 2. Check query param fallback: ?session_token=...
    if (window.location.search) {
      const searchParams = new URLSearchParams(window.location.search);
      const token = searchParams.get('session_token');
      if (token) {
        searchParams.delete('session_token');
        const remaining = searchParams.toString();
        const newSearch = remaining ? `?${remaining}` : '';
        const newUrl = window.location.pathname + newSearch + window.location.hash;
        window.history.replaceState(null, '', newUrl);
        return token;
      }
    }
  } catch (err) {
    console.warn('[authStorage] Failed to extract token from URL:', err);
  }
  return null;
}

/**
 * Persists the session token in both localStorage (if on web) and AsyncStorage.
 */
export async function saveAuthToken(token: string): Promise<void> {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(AUTH_TOKEN_KEY, token);
    }
    await AsyncStorage.setItem(AUTH_TOKEN_KEY, token);
  } catch (err) {
    console.warn('[authStorage] Failed to save token:', err);
  }
}

/**
 * Retrieves the stored session token.
 */
export async function getAuthToken(): Promise<string | null> {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const token = window.localStorage.getItem(AUTH_TOKEN_KEY);
      if (token) return token;
    }
    return await AsyncStorage.getItem(AUTH_TOKEN_KEY);
  } catch (err) {
    console.warn('[authStorage] Failed to get token:', err);
    return null;
  }
}

/**
 * Clears the stored session token from both localStorage and AsyncStorage.
 */
export async function clearAuthToken(): Promise<void> {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(AUTH_TOKEN_KEY);
    }
    await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
  } catch (err) {
    console.warn('[authStorage] Failed to clear token:', err);
  }
}

/**
 * Returns an Authorization header object with Bearer token if available.
 */
export async function getAuthHeaders(): Promise<Record<string, string>> {
  const token = await getAuthToken();
  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}
