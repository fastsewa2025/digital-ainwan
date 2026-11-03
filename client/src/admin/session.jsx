import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api.js';

const SessionContext = createContext(null);

/** Knows who is signed in. `status` is 'loading' until the server has answered, then 'in' or 'out'. */
export function SessionProvider({ children }) {
  const [state, setState] = useState({ status: 'loading', user: null });

  useEffect(() => {
    let alive = true;
    api.get('/auth/me').then(
      ({ user }) => alive && setState({ status: 'in', user }),
      () => alive && setState({ status: 'out', user: null }),
    );
    const onOut = () => setState({ status: 'out', user: null });
    window.addEventListener('ainwan:signed-out', onOut);
    return () => {
      alive = false;
      window.removeEventListener('ainwan:signed-out', onOut);
    };
  }, []);

  const login = useCallback(async (email, password) => {
    const { user } = await api.post('/auth/login', { email, password });
    setState({ status: 'in', user });
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      setState({ status: 'out', user: null });
    }
  }, []);

  const setUser = useCallback((user) => setState({ status: 'in', user }), []);

  const value = useMemo(() => ({ ...state, login, logout, setUser, isSuper: state.user?.role === 'superadmin' }), [state, login, logout, setUser]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export const useSession = () => useContext(SessionContext);
