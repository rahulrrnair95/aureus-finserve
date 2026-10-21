import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getToken, onUnauthorized, setToken } from '../api/client';
import { authApi } from '../api/endpoints';
import Modal from '../components/Modal';
import Button from '../components/Button';
import { STATIC_SITE } from '../utils/siteMode';

const AuthContext = createContext(null);
const FLASH_KEY = 'af.flash';

export function setFlash(msg) {
  try {
    sessionStorage.setItem(FLASH_KEY, msg);
  } catch {
    /* ignore */
  }
}
export function takeFlash() {
  try {
    const m = sessionStorage.getItem(FLASH_KEY);
    sessionStorage.removeItem(FLASH_KEY);
    return m;
  } catch {
    return null;
  }
}

export function homeForRole(role) {
  return role === 'INVESTOR' ? '/app' : role === 'RM' || role === 'ADMIN' ? '/console' : '/';
}

export function AuthProvider({ children }) {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  // The static site has no sign-in: never restore a session (and never call /auth/me).
  const [ready, setReady] = useState(STATIC_SITE || !getToken());

  // Restore session from token
  useEffect(() => {
    if (STATIC_SITE || !getToken()) return;
    authApi
      .me()
      .then((u) => setUser(u))
      .catch(() => setToken(null))
      .finally(() => setReady(true));
  }, []);

  const expire = useCallback(
    (msg = 'Your session expired. Please log in again.') => {
      setToken(null);
      setUser(null);
      setFlash(msg);
      navigate('/login', { replace: true });
    },
    [navigate],
  );

  useEffect(() => onUnauthorized(() => expire()), [expire]);

  const signIn = useCallback((token, u) => {
    setToken(token);
    setUser(u);
  }, []);

  const signOut = useCallback(
    async (msg) => {
      try {
        if (getToken()) await authApi.logout();
      } catch {
        /* ignore */
      }
      setToken(null);
      setUser(null);
      if (msg) setFlash(msg);
      navigate('/login', { replace: true });
    },
    [navigate],
  );

  const value = useMemo(() => ({ user, ready, signIn, signOut, setUser }), [user, ready, signIn, signOut]);

  return (
    <AuthContext.Provider value={value}>
      {children}
      {user && <IdleTimer minutes={user.idleTimeoutMinutes || (user.role === 'INVESTOR' ? 15 : 30)} onTimeout={() => signOut('You were signed out after a period of inactivity.')} />}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

/** Client-side idle timer with 1-minute warning. */
function IdleTimer({ minutes, onTimeout }) {
  const [warning, setWarning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(60);
  const lastActivity = useRef(Date.now());
  const warningRef = useRef(false);
  warningRef.current = warning;

  useEffect(() => {
    const mark = () => {
      if (!warningRef.current) lastActivity.current = Date.now();
    };
    const events = ['mousedown', 'keydown', 'touchstart', 'scroll', 'mousemove'];
    events.forEach((e) => window.addEventListener(e, mark, { passive: true }));
    const timer = setInterval(() => {
      const idleMs = Date.now() - lastActivity.current;
      const limit = minutes * 60 * 1000;
      const warnAt = Math.max(limit - 60 * 1000, limit * 0.5);
      if (idleMs >= limit) {
        clearInterval(timer);
        onTimeout();
      } else if (idleMs >= warnAt) {
        setWarning(true);
        setSecondsLeft(Math.max(0, Math.ceil((limit - idleMs) / 1000)));
      }
    }, 1000);
    return () => {
      events.forEach((e) => window.removeEventListener(e, mark));
      clearInterval(timer);
    };
  }, [minutes, onTimeout]);

  const stay = async () => {
    try {
      await authApi.me();
      lastActivity.current = Date.now();
      setWarning(false);
    } catch {
      /* 401 handler will redirect */
    }
  };

  return (
    <Modal
      open={warning}
      onClose={stay}
      title="Are you still there?"
      footer={
        <>
          <Button variant="ghost" onClick={onTimeout}>
            Log out now
          </Button>
          <Button onClick={stay}>Stay signed in</Button>
        </>
      }
    >
      <p>
        For your security you will be signed out in{' '}
        <strong aria-live="polite">
          {secondsLeft} second{secondsLeft === 1 ? '' : 's'}
        </strong>{' '}
        due to inactivity.
      </p>
    </Modal>
  );
}
