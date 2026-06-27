import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { fetchRemotePortfolio, saveRemotePortfolio } from '../lib/authApi';
import {
  buildSyncSnapshot,
  defaultPortfolioState,
  needsSnapshotBackfill,
  pickSyncPayload,
  remoteSnapshotIsRicher,
  symbolsForPortfolio,
} from '../lib/portfolioStorage';
import { marketData } from '../marketData/marketData';
import { useAuth } from './AuthContext';
import { usePortfolioContext } from './PortfolioContext';

const PortfolioSyncContext = createContext(null);
const PULL_INTERVAL_MS = 15_000;

function seedMarketSnapshot(data, setQuote, setVolatility) {
  const snapshot = data?.marketSnapshot;
  if (!snapshot) return;

  Object.entries(snapshot.quotes || {}).forEach(([symbol, quote]) => {
    setQuote(symbol, {
      c: quote.c,
      d: 0,
      dp: quote.dp ?? 0,
      pc: quote.c,
    });
  });

  Object.entries(snapshot.volatility || {}).forEach(([symbol, sigma]) => {
    setVolatility(symbol, sigma);
  });
}

async function prepareSyncPayload(state, quotes, volatility, volatilityReliability, setQuote, setVolatility) {
  const mergedQuotes = { ...quotes };
  const mergedVol = { ...volatility };
  const mergedReliability = { ...volatilityReliability };
  const symbols = symbolsForPortfolio(state);

  for (const symbol of symbols) {
    const upper = symbol.toUpperCase();

    try {
      const quote = await marketData.getQuote(upper);
      if (!quote._simulated) {
        mergedQuotes[upper] = quote;
      }
      setQuote(upper, quote);
    } catch {
      // Keep any existing quote for this symbol.
    }

    try {
      const volResult = await marketData.getVolatility(upper);
      if (volResult.reliable) {
        mergedVol[upper] = volResult.sigma;
        mergedReliability[upper] = true;
      }
      setVolatility(upper, volResult);
    } catch {
      // Keep any existing volatility for this symbol.
    }
  }

  const snapshot = buildSyncSnapshot(state, mergedQuotes, mergedVol, mergedReliability);

  return {
    ...pickSyncPayload(state),
    marketSnapshot: snapshot,
  };
}

function fingerprint(state) {
  return JSON.stringify(pickSyncPayload(state));
}

function snapshotHasMarks(snapshot) {
  return Object.keys(snapshot?.quotes || {}).length > 0;
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
  const { portfolioState, replacePortfolioState, quotes, volatility, volatilityReliability, setQuote, setVolatility, pauseQuoteRefresh, resumeQuoteRefresh, mergeMarketSnapshot } = usePortfolioContext();
  const [syncReady, setSyncReady] = useState(false);
  const [cloudUpdatedAt, setCloudUpdatedAt] = useState(null);
  const [syncMessage, setSyncMessage] = useState('');

  const saveTimerRef = useRef(null);
  const lastSavedRef = useRef('');
  const portfolioRef = useRef(portfolioState);
  const quotesRef = useRef(quotes);
  const volatilityRef = useRef(volatility);
  const volatilityReliabilityRef = useRef(volatilityReliability);
  const cloudUpdatedAtRef = useRef(null);
  const dirtyRef = useRef(false);
  const suppressDirtyRef = useRef(false);
  const hydratedRef = useRef(false);

  portfolioRef.current = portfolioState;
  quotesRef.current = quotes;
  volatilityRef.current = volatility;
  volatilityReliabilityRef.current = volatilityReliability;

  const applyRemoteState = useCallback((data, updatedAt) => {
    suppressDirtyRef.current = true;
    dirtyRef.current = false;
    replacePortfolioState(data);
    seedMarketSnapshot(data, setQuote, setVolatility);
    pauseQuoteRefresh(180_000);
    lastSavedRef.current = fingerprint(data);
    if (updatedAt) {
      cloudUpdatedAtRef.current = updatedAt;
      setCloudUpdatedAt(updatedAt);
    }
  }, [pauseQuoteRefresh, replacePortfolioState, setQuote, setVolatility]);

  const pushToCloud = useCallback(async (stateOverride = null) => {
    const state = stateOverride ?? portfolioRef.current;
    const payload = await prepareSyncPayload(
      state,
      quotesRef.current,
      volatilityRef.current,
      volatilityReliabilityRef.current,
      setQuote,
      setVolatility,
    );
    const serialized = JSON.stringify(payload);
    const forceSnapshotPush = snapshotHasMarks(payload.marketSnapshot)
      && needsSnapshotBackfill(state);

    if (serialized === lastSavedRef.current && !forceSnapshotPush) {
      dirtyRef.current = false;
      return { ok: true, skipped: true };
    }

    const result = await saveRemotePortfolio(payload);
    lastSavedRef.current = serialized;
    dirtyRef.current = false;
    if (payload.marketSnapshot) {
      mergeMarketSnapshot(payload.marketSnapshot);
      seedMarketSnapshot({ marketSnapshot: payload.marketSnapshot }, setQuote, setVolatility);
    }
    if (result?.updatedAt) {
      cloudUpdatedAtRef.current = result.updatedAt;
      setCloudUpdatedAt(result.updatedAt);
    }
    return { ok: true, updatedAt: result?.updatedAt };
  }, [mergeMarketSnapshot, setQuote, setVolatility]);

  const pullIfRemoteNewer = useCallback(async () => {
    const remote = await fetchRemotePortfolio();
    if (!remote?.updatedAt || isDefaultPortfolio(remote.data)) return remote;

    const shouldPull = !dirtyRef.current && (
      isRemoteNewer(remote.updatedAt, cloudUpdatedAtRef.current)
      || remoteSnapshotIsRicher(portfolioRef.current, remote.data)
    );

    if (shouldPull) {
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
        const result = await pushToCloud();
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
      const result = await pushToCloud();
      return { direction: 'push', ...result };
    }

    if (!serverEmpty) {
      applyRemoteState(remote.data, remote.updatedAt);
      if (needsSnapshotBackfill(remote.data)) {
        const result = await pushToCloud(remote.data);
        return { direction: 'backfill', ...result };
      }
      return { direction: 'pull', updatedAt: remote.updatedAt };
    }

    if (localHasData) {
      const result = await pushToCloud();
      return { direction: 'push', ...result };
    }

    lastSavedRef.current = fingerprint(local);
    return { direction: 'none' };
  }, [applyRemoteState, pushToCloud]);

  const syncNow = useCallback(async () => {
    setSyncMessage('Syncing…');
    try {
      if (dirtyRef.current) {
        await pushToCloud();
        setSyncMessage('Saved to cloud.');
        return;
      }

      const remote = await fetchRemotePortfolio();
      if (!remote) throw new Error('Could not reach cloud portfolio.');

      if (!isDefaultPortfolio(remote.data)) {
        const shouldApply = isRemoteNewer(remote.updatedAt, cloudUpdatedAtRef.current)
          || remoteSnapshotIsRicher(portfolioRef.current, remote.data);

        if (shouldApply) {
          applyRemoteState(remote.data, remote.updatedAt);
        }

        if (needsSnapshotBackfill(remote.data)) {
          await pushToCloud(remote.data);
          setSyncMessage('Synced prices to cloud.');
          return;
        }
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
    resumeQuoteRefresh();

    const payload = pickSyncPayload(portfolioState);
    const serialized = JSON.stringify(payload);
    if (serialized === lastSavedRef.current) return undefined;

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

    saveTimerRef.current = setTimeout(async () => {
      try {
        await pushToCloud();
        setSyncMessage('Saved to cloud.');
      } catch {
        setSyncMessage('Cloud save failed — tap Sync now to retry.');
      }
    }, 800);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [user, syncReady, portfolioState, pushToCloud, resumeQuoteRefresh]);

  useEffect(() => {
    if (!user || !syncReady) return undefined;

    async function flush() {
      if (!dirtyRef.current) return;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      try {
        await pushToCloud();
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
    pushToCloud,
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
