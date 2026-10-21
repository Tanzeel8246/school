import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from 'react';
import { api, setAccessToken } from '../lib/api';

interface User {
  id: string;
  name: string;
  role: string;
  schoolId?: string;
  theme?: string;
}

interface RegisterPayload {
  schoolName: string;
  schoolCode: string;
  adminName: string;
  email: string;
  password: string;
}

interface AuthState {
  user: User | null;
  permissions: string[];
  /** True until the initial silent refresh attempt has completed (avoids redirect flicker). */
  bootstrapping: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => void;
  can: (perm: string) => boolean;
  /** Set when the server requires 2FA verification before issuing a full access token. */
  pendingChallenge: { challengeToken: string; userId: string } | null;
  /** Clears pending states (call after a 2FA flow completes or is cancelled). */
  clearPending: () => void;
  /** Expose setUser so 2FA pages can finalise the session after verifying. */
  setUser: (user: User) => void;
  /** Apply a fresh token to set permissions */
  applyToken: (accessToken: string) => void;
  updateTheme: (theme: string) => Promise<void>;
}

const AuthCtx = createContext<AuthState | null>(null);

/** Safely decode the `permissions` claim from a JWT access token. */
function decodePermissions(accessToken: string): string[] {
  try {
    const claims = JSON.parse(atob(accessToken.split('.')[1]));
    return claims.permissions ?? [];
  } catch {
    return [];
  }
}

// Union of all possible POST /auth/login response shapes.
type LoginResponse =
  | { accessToken: string; user: User }
  | { requiresTwoFaChallenge: true; userId: string; challengeToken: string };

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [bootstrapping, setBootstrapping] = useState(true);
  const [pendingChallenge, setPendingChallenge] = useState<{
    challengeToken: string;
    userId: string;
  } | null>(null);

  // Apply theme side-effect whenever user changes
  useEffect(() => {
    if (user?.theme) {
      document.documentElement.setAttribute('data-theme', user.theme);
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  }, [user]);

  // Apply a freshly issued access token: store it and derive client-side permissions.
  const applyToken = useCallback((accessToken: string) => {
    setAccessToken(accessToken);
    setPermissions(decodePermissions(accessToken));
  }, []);

  const clearPending = useCallback(() => {
    setPendingChallenge(null);
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const { data } = await api.post<LoginResponse>('/auth/login', {
        loginId: email,
        password,
      });

      if ('requiresTwoFaChallenge' in data && data.requiresTwoFaChallenge) {
        // Store challenge info; do NOT issue an access token yet.
        setPendingChallenge({ challengeToken: data.challengeToken, userId: data.userId });
        return;
      }

      // Normal login: apply token and set user.
      const normalData = data as { accessToken: string; user: User };
      applyToken(normalData.accessToken);
      setUser(normalData.user);
    },
    [applyToken],
  );

  const register = useCallback(
    async (payload: RegisterPayload) => {
      const { data } = await api.post<{ accessToken: string; user: User }>(
        '/auth/register',
        payload,
      );
      applyToken(data.accessToken);
      setUser(data.user);
    },
    [applyToken],
  );

  const logout = useCallback(() => {
    // Best-effort server-side logout (revokes refresh cookie); ignore failures.
    api.post('/auth/logout', {}).catch(() => undefined);
    setAccessToken(null);
    setUser(null);
    setPermissions([]);
    setPendingChallenge(null);
  }, []);

  const can = useCallback(
    (perm: string) => permissions.includes('*') || permissions.includes(perm),
    [permissions],
  );

  const updateTheme = useCallback(async (theme: string) => {
    try {
      await api.patch('/auth/theme', { theme });
      setUser((prev) => prev ? { ...prev, theme } : prev);
      document.documentElement.setAttribute('data-theme', theme);
    } catch (err) {
      console.error('Failed to update theme', err);
    }
  }, []);

  // On mount: try a single silent refresh; if it yields a token, restore the session via /auth/me.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.post<{ accessToken: string }>('/auth/refresh', {});
        if (cancelled || !data?.accessToken) return;
        applyToken(data.accessToken);
        const me = await api.get<User & Record<string, unknown>>('/auth/me');
        if (cancelled) return;
        const claims = me.data;
        setUser({
          id: String(claims.id ?? claims.sub ?? ''),
          name: String(claims.name ?? ''),
          role: String(claims.role ?? ''),
          schoolId: claims.schoolId ? String(claims.schoolId) : undefined,
          theme: claims.theme ? String(claims.theme) : 'emerald',
        });
      } catch {
        // No valid refresh cookie — remain logged out.
      } finally {
        if (!cancelled) setBootstrapping(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [applyToken]);

  return (
    <AuthCtx.Provider
      value={{
        user,
        permissions,
        bootstrapping,
        login,
        register,
        logout,
        can,
        pendingChallenge,
        clearPending,
        setUser,
        applyToken,
        updateTheme,
      }}
    >
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}
