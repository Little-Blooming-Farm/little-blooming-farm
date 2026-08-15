import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { adminLogin, adminLogout, adminMe } from '../lib/api.js';

const AdminAuthContext = createContext(null);

/**
 * Admin session state.
 *
 * There is deliberately no token in JavaScript here: the JWT lives in an
 * httpOnly cookie the browser attaches automatically, so XSS cannot read it.
 * "Am I signed in?" is answered by asking the server, not by inspecting storage.
 */
export function AdminAuthProvider({ children }) {
  const [admin, setAdmin] = useState(null);
  const [checking, setChecking] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const result = await adminMe();
      setAdmin(result.admin);
      return result.admin;
    } catch {
      setAdmin(null);
      return null;
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = useCallback(async (email, password) => {
    const result = await adminLogin(email, password);
    setAdmin(result.admin);
    return result.admin;
  }, []);

  const logout = useCallback(async () => {
    try {
      await adminLogout();
    } finally {
      setAdmin(null);
    }
  }, []);

  const value = useMemo(
    () => ({ admin, checking, login, logout, refresh }),
    [admin, checking, login, logout, refresh]
  );

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}

export function useAdminAuth() {
  const context = useContext(AdminAuthContext);
  if (!context) throw new Error('useAdminAuth must be used inside AdminAuthProvider');
  return context;
}
