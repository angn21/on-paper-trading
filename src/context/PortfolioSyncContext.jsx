import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { fetchRemotePortfolio, saveRemotePortfolio } from '../lib/authApi';
import {
  defaultPortfolioState,
  getLocalPortfolioUpdatedAt,
  pickSyncPayload,
} from '../lib/portfolioStorage';
import { useAuth } from './AuthContext';
import { usePortfolioContext } from './PortfolioContext';

const PortfolioSyncContext = createContext(null);

function fingerprint(state) {
  return JSON.stringify(pickSyncPayload(state));
}

function isDefaultPortfolio(state) {
  return fingerprint(state) === fingerprint(defaultPortfolioState);
}

export function PortfolioSyncProvider({ children }) {
  const { user, loading: authLoading } = useAuth();
  const { portfolioState, replacePortfolioState } = usePortfolioContext();
  const [syncReady, setSyncReady] = useState(false);
  const [cloudUpdatedAt, setCloudUpdatedAt] = useState(null);
  const [syncMessage, setSyncMessage] = useState('');

  const saveTimerRef = useRef(null);
  const lastSavedRef = useRef('');
  const portfolioRef = useRef(portfolioState);

  portfolioRef.current = portfolioState;

  const pushToCloud = useCallback(async (payload) => {
    const serialized = JSON.stringify(payload);
    if (serialized === lastSavedRef.current) return { ok: true };

    const result = await saveRemotePortfolio(payload);
    lastSavedRef.current = serialized;
    if (result?.updatedAt) setCloudUpdatedAt(result.updatedAt);
    return { ok: true, updatedAt: result?.updatedAt };
  }, []);

  const pullFromCloud = useCallback(async () => {
    const remote = await fetchRemotePortfolio();
    if (!remote) throw new Error('Could not reach cloud portfolio.');

    replacePortfolioState(remote.data);
    lastSavedRef.current = fingerprint(remote.data);
    if (remote.updatedAt) setCloudUpdatedAt(remote.updatedAt);
    return remote;
  }, [replacePortfolioState]);

  const reconcile = useCallback(async () => {
    const local = pickSyncPayload(portfolioRef.current);
    const localUpdated = getLocalPortfolioUpdatedAt();
    const localHasData = !isDefaultPortfolio(local);
    let remote = null;

    try {
      remote = await fetchRemotePortfolio();
    } catch {
      remote = null;
    }

    if (!remote) {
      if (localHasData) {
        const result = await pushToCloud(local);
        return { direction: 'push', ...result };
      }
      return { direction: 'none' };
    }

    const serverUpdated = remote.updatedAt ? new Date(remote.updatedAt).getTime() : 0;
    const serverEmpty = isDefaultPortfolio(remote.data);

    if (localHasData && serverEmpty) {
      const result = await pushToCloud(local);
      return { direction: 'push', ...result };
    }

    if (localUpdated > serverUpdated && localHasData) {
      const result = await pushToCloud(local);
      return { direction: 'push', ...result };
    }

    if (!serverEmpty) {
      replacePortfolioState(remote.data);
      lastSavedRef.current = fingerprint(remote.data);
      if (remote.updatedAt) setCloudUpdatedAt(remote.updatedAt);
      return { direction: 'pull', updatedAt: remote.updatedAt };
    }

    lastSavedRef.current = fingerprint(local);
    return { direction: 'none' };
  }, [pushToCloud, replacePortfolioState]);

  const syncNow = useCallback(async () => {
    setSyncMessage('Syncing…');
    try {
      await reconcile();
      setSyncMessage('Synced just now.');
    } catch (error) {
      setSyncMessage(error.message || 'Sync failed.');
      throw error;
    }
  }, [reconcile]);

  useEffect(() => {
    if (authLoading) return undefined;

    if (!user) {
      setSyncReady(false);
      setCloudUpdatedAt(null);
      lastSavedRef.current = '';
      return undefined;
    }

    let cancelled = false;

    async function hydrate() {
      setSyncReady(false);
      try {
        if (!cancelled) await reconcile();
      } catch {
        if (!cancelled) setSyncMessage('Could not sync with cloud.');
      } finally {
        if (!cancelled) setSyncReady(true);
      }
    }

    hydrate();

    return () => {
      cancelled = true;
    };
  }, [user, authLoading, reconcile]);

  useEffect(() => {
    if (!user || !syncReady) return undefined;

    const payload = pickSyncPayload(portfolioState);
    const serialized = JSON.stringify(payload);
    if (serialized === lastSavedRef.current) return undefined;

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

    saveTimerRef.current = setTimeout(async () => {
      try {
        await pushToCloud(payload);
        setSyncMessage('Saved to cloud.');
      } catch {
        setSyncMessage('Cloud save failed — tap Sync now to retry.');
      }
    }, 800);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [user, syncReady, portfolioState, pushToCloud]);

  useEffect(() => {
    if (!user || !syncReady) return undefined;

    async function flush() {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      try {
        await pushToCloud(pickSyncPayload(portfolioRef.current));
      } catch {
        // Retry on next change or manual sync.
      }
    }

    async function onVisible() {
      if (document.visibilityState !== 'visible') return;
      try {
        const remote = await fetchRemotePortfolio();
        if (!remote?.updatedAt) return;
        const serverUpdated = new Date(remote.updatedAt).getTime();
        const localUpdated = getLocalPortfolioUpdatedAt();
        if (serverUpdated > localUpdated) {
          replacePortfolioState(remote.data);
          lastSavedRef.current = fingerprint(remote.data);
          setCloudUpdatedAt(remote.updatedAt);
        }
      } catch {
        // Ignore background pull errors.
      }
    }

    function onHide() {
      flush();
    }

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') onHide();
      else onVisible();
    });
    window.addEventListener('pagehide', onHide);
    window.addEventListener('focus', onVisible);

    return () => {
      window.removeEventListener('pagehide', onHide);
      window.removeEventListener('focus', onVisible);
    };
  }, [user, syncReady, pushToCloud, replacePortfolioState]);

  const value = {
    syncReady,
    cloudUpdatedAt,
    syncMessage,
    syncNow,
    pullFromCloud,
    pushToCloud: () => pushToCloud(pickSyncPayload(portfolioRef.current)),
  };

  return (
    <PortfolioSyncContext.Provider value={value}>
      {children}
    </PortfolioSyncContext.Provider>
  );
}

export function usePortfolioSync() {
  const ctx = useContext(PortfolioSyncContext);
  if (!ctx) throw new Error('usePortfolioSync requires PortfolioSyncProvider');
  return ctx;
}
