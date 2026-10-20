import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';

import { setUnauthorizedHandler } from '@/services/api';
import { authService } from '@/services/auth.service';
import { clearSessionStorage, tokenStorage, userStorage } from '@/services/storage';
import type { RegisterPayload, User } from '@/types/models';
import { pickToken, pickUser } from '@/utils/payload';

interface AuthContextValue {
  isLoading: boolean;
  isAuthenticated: boolean;
  user: User | null;
  signIn: (email: string, password: string) => Promise<User | null>;
  signUp: (payload: RegisterPayload) => Promise<{ user: User | null; message: string | null }>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useSession(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error('useSession debe usarse dentro de <SessionProvider />');
  }
  return value;
}

export function SessionProvider({ children }: PropsWithChildren) {
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);

  const refreshUser = useCallback(async () => {
    try {
      const { data } = await authService.me();
      const fresh = pickUser(data);
      if (fresh) {
        setUser(fresh);
        await userStorage.set(fresh);
      }
    } catch {
      // El interceptor de 401 limpia la sesión y notifica al provider.
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    setUnauthorizedHandler(() => {
      if (!cancelled) setUser(null);
    });

    (async () => {
      try {
        const [token, cachedUser] = await Promise.all([tokenStorage.get(), userStorage.get()]);
        if (cancelled) return;
        if (!token) {
          setUser(null);
          return;
        }
        setUser(cachedUser);
        if (cachedUser) void refreshUser();
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      setUnauthorizedHandler(null);
    };
  }, [refreshUser]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { data } = await authService.login(email, password);
    const token = pickToken(data);
    if (!token) {
      throw new Error('La respuesta del servidor no incluye un token de acceso.');
    }
    await tokenStorage.set(token);

    const nextUser = pickUser(data);
    if (nextUser) {
      await userStorage.set(nextUser);
      setUser(nextUser);
    } else {
      await refreshUser();
    }
    return nextUser;
  }, [refreshUser]);

  const signUp = useCallback(async (payload: RegisterPayload) => {
    const { data } = await authService.register(payload);
    const message = (data as { message?: string } | undefined)?.message ?? null;

    const token = pickToken(data);
    if (token) {
      await tokenStorage.set(token);
      const nextUser = pickUser(data);
      if (nextUser) {
        await userStorage.set(nextUser);
        setUser(nextUser);
        return { user: nextUser, message };
      }
    }

    // El backend de MicroMaster crea cuentas PENDING sin token: el usuario
    // deberá iniciar sesión cuando el administrador lo apruebe.
    return { user: null, message };
  }, []);

  const signOut = useCallback(async () => {
    try {
      await authService.logout();
    } catch {
      // Cierre de sesión optimista: aunque falle el backend, limpiamos el locale.
    }
    await clearSessionStorage();
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      isLoading,
      isAuthenticated: !!user,
      user,
      signIn,
      signUp,
      signOut,
      refreshUser,
    }),
    [isLoading, user, signIn, signUp, signOut, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
