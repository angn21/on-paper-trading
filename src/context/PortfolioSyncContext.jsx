import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { fetchRemotePortfolio, saveRemotePortfolio } from '../lib/authApi';
import {
  defaultPortfolioState,
  pickSyncPayload,
} from '../lib/portfolioStorage';
import { marketData } from '../marketData/marketData';
import { useAuth } from './AuthContext';
import { usePortfolioContext } from './PortfolioContext';

const PortfolioSyncContext = createContext(null);
const PULL_INTERVAL_MS = 15_000;

function portfolioSymbols(state) {
  const symbols = new Set([
    ...Object.keys(state?.positions || {}),
    ...(state?.options || []).map((o) => o.symbol),
    ...(state?.watchlist || []),
    ...(state?.pendingOrders || []).map((o) => o.symbol),
    'SPY',
  ]);
  return [...symbols];
}

function refreshMarketDataForPortfolio(state) {
  marketData.invalidateQuotes(portfolioSymbols(state));
}

function fingerprint(state) {
  return JSON.stringify(pickSyncPayload(state));
}

function isDefaultPortfolio(state) {
  return fingerprint(state) === fingerprint(defaultPortfolioState);
}

function isRemoteNewer(remoteUpdatedAt, knownUpdatedAt) {
  if (!remoteUpdatedAt) return false;
  if (!knownUpdatedAt) return true;
  return new Date(remoteUpdatedAt).getTime() > new Date(knownUpdatedAt).getTime();
}

export function PortfolioSyncProvider({ children }) {
  const { user, loading: authLoading } = useAuth();
  const { portfolioState, replacePortfolioState, invalidateMarketQuotes } = usePortfolioContext();
  const [syncReady, setSyncReady] = useState(false);
  const [cloudUpdatedAt, setCloudUpdatedAt] = useState(null);
  const [syncMessage, setSyncMessage] = useState('');

  const saveTimerRef = useRef(null);
  const lastSavedRef = useRef('');
  const portfolioRef = useRef(portfolioState);
  const cloudUpdatedAtRef = useRef(null);
  const dirtyRef = useRef(false);
  const suppressDirtyRef = useRef(false);
  const hydratedRef = useRef(false);

  portfolioRef.current = portfolioState;

  const applyRemoteState = useCallback((data, updatedAt) => {
    suppressDirtyRef.current = true;
    dirtyRef.current = false;
    invalidateMarketQuotes();
    refreshMarketDataForPortfolio(data);
    replacePortfolioState(data);
    lastSavedRef.current = fingerprint(data);
    if (updatedAt) {
      cloudUpdatedAtRef.current = updatedAt;
      setCloudUpdatedAt(updatedAt);
    }
  }, [invalidateMarketQuotes, replacePortfolioState]);

  const pushToCloud = useCallback(async (payload) => {
    const serialized = JSON.stringify(payload);
    if (serialized === lastSavedRef.current) {
      dirtyRef.current = false;
      return { ok: true, skipped: true };
    }

    const result = await saveRemotePortfolio(payload);
    lastSavedRef.current = serialized;
    dirtyRef.current = false;
    if (result?.updatedAt) {
      cloudUpdatedAtRef.current = result.updatedAt;
      setCloudUpdatedAt(result.updatedAt);
    }
    return { ok: true, updatedAt: result?.updatedAt };
  }, []);

  const pullIfRemoteNewer = useCallback(async () => {
    const remote = await fetchRemotePortfolio();
    if (!remote?.updatedAt || isDefaultPortfolio(remote.data)) return remote;

    if (isRemoteNewer(remote.updatedAt, cloudUpdatedAtRef.current)) {
      applyRemoteState(remote.data, remote.updatedAt);
    }
    return remote;
  }, [applyRemoteState]);

  const reconcile = useCallback(async () => {
    const local = pickSyncPayload(portfolioRef.current);
    const localHasData = !isDefaultPortfolio(local);
    let remote = null;

    try {
      remote = await fetchRemotePortfolio();
    } catch {
      remote = null;
    }

    if (!remote) {
      if (localHasData && dirtyRef.current) {
        const result = await pushToCloud(local);
        return { direction: 'push', ...result };
      }
      return { direction: 'none' };
    }

    const serverEmpty = isDefaultPortfolio(remote.data);

    if (remote.updatedAt) {
      cloudUpdatedAtRef.current = remote.updatedAt;
      setCloudUpdatedAt(remote.updatedAt);
    }

    if (dirtyRef.current) {
      const result = await pushToCloud(local);
      return { direction: 'push', ...result };
    }

    if (!serverEmpty) {
      applyRemoteState(remote.data, remote.updatedAt);
      return { direction: 'pull', updatedAt: remote.updatedAt };
    }

    if (localHasData) {
      const result = await pushToCloud(local);
      return { direction: 'push', ...result };
    }

    lastSavedRef.current = fingerprint(local);
    return { direction: 'none' };
  }, [applyRemoteState, pushToCloud]);

  const syncNow = useCallback(async () => {
    setSyncMessage('Syncing…');
    try {
      if (dirtyRef.current) {
        await pushToCloud(pickSyncPayload(portfolioRef.current));
        setSyncMessage('Saved to cloud.');
        return;
      }

      const remote = await fetchRemotePortfolio();
      if (!remote) throw new Error('Could not reach cloud portfolio.');

      if (!isDefaultPortfolio(remote.data)) {
        applyRemoteState(remote.data, remote.updatedAt);
      } else {
        lastSavedRef.current = fingerprint(remote.data);
        if (remote.updatedAt) {
          cloudUpdatedAtRef.current = remote.updatedAt;
          setCloudUpdatedAt(remote.updatedAt);
        }
      }
      setSyncMessage('Synced just now.');
    } catch (error) {
      setSyncMessage(error.message || 'Sync failed.');
      throw error;
    }
  }, [applyRemoteState, pushToCloud]);

  useEffect(() => {
    if (authLoading) return undefined;

    if (!user) {
      setSyncReady(false);
      setCloudUpdatedAt(null);
      cloudUpdatedAtRef.current = null;
      lastSavedRef.current = '';
      dirtyRef.current = false;
      hydratedRef.current = false;
      return undefined;
    }

    let cancelled = false;

    async function hydrate() {
      setSyncReady(false);
      suppressDirtyRef.current = true;
      dirtyRef.current = false;
      try {
        if (!cancelled) await reconcile();
      } catch {
        if (!cancelled) setSyncMessage('Could not sync with cloud.');
      } finally {
        hydratedRef.current = true;
        if (!cancelled) setSyncReady(true);
      }
    }

    hydrate();

    return () => {
      cancelled = true;
    };
  }, [user, authLoading, reconcile]);

  useEffect(() => {
    if (!user || !syncReady || !hydratedRef.current) return undefined;

    if (suppressDirtyRef.current) {
      suppressDirtyRef.current = false;
      return undefined;
    }

    dirtyRef.current = true;

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
      if (!dirtyRef.current) return;
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
        await pullIfRemoteNewer();
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

    const pollId = setInterval(() => {
      if (dirtyRef.current) return;
      pullIfRemoteNewer().catch(() => {});
    }, PULL_INTERVAL_MS);

    return () => {
      clearInterval(pollId);
      window.removeEventListener('pagehide', onHide);
      window.removeEventListener('focus', onVisible);
    };
  }, [user, syncReady, pushToCloud, pullIfRemoteNewer]);

  const value = {
    syncReady,
    cloudUpdatedAt,
    syncMessage,
    syncNow,
    pullFromCloud: pullIfRemoteNewer,
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
