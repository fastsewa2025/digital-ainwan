import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from './api.js';

const SessionContext = createContext(null);
const HINT = 'ainwan-signed-in';

// The session cookie is invisible to JavaScript (httpOnly). This harmless flag only tells us whether it
// is worth asking the server "who am I?", so most visitors make no extra request at all.
const hint = {
  get: () => {
    try {
      return localStorage.getItem(HINT) === '1';
    } catch {
      return true;
    }
  },
  set: (on) => {
    try {
      if (on) localStorage.setItem(HINT, '1');
      else localStorage.removeItem(HINT);
    } catch {
      /* ignore */
    }
  },
};

const RANK = { villager: 1, admin: 2, superadmin: 3 };

/** Who is signed in, for the whole site. `status`: 'loading' | 'in' | 'out'. */
export function SessionProvider({ children }) {
  const mustAsk = hint.get() || /^\/(?:en\/)?(?:admin|account)/.test(window.location.pathname);
  const [state, setState] = useState({ status: mustAsk ? 'loading' : 'out', user: null });

  useEffect(() => {
    let alive = true;
    if (mustAsk) {
      api.get('/auth/me').then(
        ({ user }) => alive && setState({ status: 'in', user }),
        () => {
          hint.set(false);
          if (alive) setState({ status: 'out', user: null });
        },
      );
    }
    const onOut = () => {
      hint.set(false);
      setState({ status: 'out', user: null });
    };
    window.addEventListener('ainwan:signed-out', onOut);
    return () => {
      alive = false;
      window.removeEventListener('ainwan:signed-out', onOut);
    };
    // asked once, when the site opens
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signedIn = useCallback((user) => {
    hint.set(true);
    setState({ status: 'in', user });
    return user;
  }, []);

  const login = useCallback(async (login, password) => signedIn((await api.post('/auth/login', { login, password })).user), [signedIn]);
  const register = useCallback(async (data) => {
    const { user } = await api.post('/auth/register', data);
    return user ? signedIn(user) : null;
  }, [signedIn]);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      hint.set(false);
      setState({ status: 'out', user: null });
    }
  }, []);

  const value = useMemo(() => {
    const rank = RANK[state.user?.role] ?? 0;
    return {
      ...state,
      login,
      register,
      logout,
      setUser: signedIn,
      isSuper: rank >= 3,
      isStaff: rank >= 2,
      // members-only things: staff, or a villager the Panchayat has verified
      isVerified: rank >= 2 || (rank === 1 && state.user?.status === 'active'),
    };
  }, [state, login, register, logout, signedIn]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export const useSession = () => useContext(SessionContext);
