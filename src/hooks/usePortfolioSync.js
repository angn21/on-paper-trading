import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchRemotePortfolio, saveRemotePortfolio } from '../lib/authApi';
import {
  getLocalPortfolioUpdatedAt,
  hasPortfolioActivity,
  loadLocalPortfolio,
  pickSyncPayload,
} from '../lib/portfolioStorage';
import { useAuth } from '../context/AuthContext';
import { usePortfolioContext } from '../context/PortfolioContext';

export function usePortfolioSync() {
  const { user, loading: authLoading } = useAuth();
  const { portfolioState, replacePortfolioState } = usePortfolioContext();
  const [syncReady, setSyncReady] = useState(false);
  const saveTimerRef = useRef(null);
  const lastSavedRef = useRef('');
  const portfolioRef = useRef(portfolioState);

  portfolioRef.current = portfolioState;

  const pushToCloud = useCallback(async (payload) => {
    const serialized = JSON.stringify(payload);
    if (serialized === lastSavedRef.current) return true;

    const ok = await saveRemotePortfolio(payload);
    if (ok) lastSavedRef.current = serialized;
    return ok;
  }, []);

  useEffect(() => {
    if (authLoading) return undefined;

    if (!user) {
      setSyncReady(false);
      lastSavedRef.current = '';
      return undefined;
    }

    let cancelled = false;

    async function hydrate() {
      setSyncReady(false);

      try {
        const remote = await fetchRemotePortfolio();
        if (cancelled) return;

        if (!remote) {
          setSyncReady(true);
          return;
        }

        const serverData = remote.data;
        const local = loadLocalPortfolio();
        const serverHasData = hasPortfolioActivity(serverData);
        const localHasData = hasPortfolioActivity(local);
        const serverUpdated = remote.updatedAt ? new Date(remote.updatedAt).getTime() : 0;
        const localUpdated = getLocalPortfolioUpdatedAt();

        const localIsNewer = localUpdated > serverUpdated;

        if (serverHasData && !localIsNewer) {
          replacePortfolioState(serverData);
          lastSavedRef.current = JSON.stringify(pickSyncPayload(serverData));
        } else if (localHasData) {
          replacePortfolioState(local);
          const payload = pickSyncPayload(local);
          await pushToCloud(payload);
        } else if (serverHasData) {
          replacePortfolioState(serverData);
          lastSavedRef.current = JSON.stringify(pickSyncPayload(serverData));
        } else {
          lastSavedRef.current = JSON.stringify(pickSyncPayload(local));
        }
      } catch {
        // Stay on local data if cloud fetch fails.
      }

      if (!cancelled) setSyncReady(true);
    }

    hydrate();

    return () => {
      cancelled = true;
    };
  }, [user, authLoading, replacePortfolioState, pushToCloud]);

  useEffect(() => {
    if (!user || !syncReady) return undefined;

    const payload = pickSyncPayload(portfolioState);
    const serialized = JSON.stringify(payload);
    if (serialized === lastSavedRef.current) return undefined;

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

    saveTimerRef.current = setTimeout(() => {
      pushToCloud(payload);
    }, 1500);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [user, syncReady, portfolioState, pushToCloud]);

  useEffect(() => {
    if (!user || !syncReady) return undefined;

    function flush() {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      const payload = pickSyncPayload(portfolioRef.current);
      pushToCloud(payload);
    }

    function onVisibilityChange() {
      if (document.visibilityState === 'hidden') flush();
    }

    window.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('pagehide', flush);

    return () => {
      window.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('pagehide', flush);
    };
  }, [user, syncReady, pushToCloud]);
}

export function PortfolioSync() {
  usePortfolioSync();
  return null;
}
