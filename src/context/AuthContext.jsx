import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  fetchMe,
  loginAccount,
  logoutAccount,
  registerAccount,
} from '../lib/authApi';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const me = await fetchMe();
      setUser(me);
      return me;
    } catch {
      setUser(null);
      return null;
    }
  }, []);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  const register = useCallback(async (username, pin, options = {}) => {
    const account = await registerAccount({
      username,
      pin,
      importLocal: options.importLocal,
      portfolio: options.portfolio,
    });
    setUser(account);
    return account;
  }, []);

  const login = useCallback(async (username, pin) => {
    const account = await loginAccount({ username, pin });
    setUser(account);
    return account;
  }, []);

  const logout = useCallback(async () => {
    await logoutAccount();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, register, login, logout, refresh }),
    [user, loading, register, login, logout, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth requires AuthProvider');
  return ctx;
}
