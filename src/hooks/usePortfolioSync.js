import { useEffect, useRef } from 'react';
import { fetchRemotePortfolio, saveRemotePortfolio } from '../lib/authApi';
import {
  hasPortfolioActivity,
  loadLocalPortfolio,
  pickSyncPayload,
} from '../lib/portfolioStorage';
import { useAuth } from '../context/AuthContext';
import { usePortfolioContext } from '../context/PortfolioContext';

export function usePortfolioSync() {
  const { user, loading: authLoading } = useAuth();
  const { portfolioState, replacePortfolioState } = usePortfolioContext();
  const hydratedRef = useRef(false);
  const saveTimerRef = useRef(null);
  const lastSavedRef = useRef('');

  useEffect(() => {
    if (authLoading) return undefined;

    if (!user) {
      hydratedRef.current = false;
      return undefined;
    }

    let cancelled = false;

    async function hydrate() {
      try {
        const remote = await fetchRemotePortfolio();
        if (cancelled || !remote) return;

        const serverData = remote.data;
        const local = loadLocalPortfolio();
        const serverHasData = hasPortfolioActivity(serverData);
        const localHasData = hasPortfolioActivity(local);

        if (serverHasData) {
          replacePortfolioState(serverData);
        } else if (localHasData) {
          replacePortfolioState(local);
          await saveRemotePortfolio(pickSyncPayload(local));
        }

        hydratedRef.current = true;
        lastSavedRef.current = JSON.stringify(pickSyncPayload(serverHasData ? serverData : local));
      } catch {
        hydratedRef.current = true;
      }
    }

    hydrate();

    return () => {
      cancelled = true;
    };
  }, [user, authLoading, replacePortfolioState]);

  useEffect(() => {
    if (!user || !hydratedRef.current) return undefined;

    const payload = pickSyncPayload(portfolioState);
    const serialized = JSON.stringify(payload);
    if (serialized === lastSavedRef.current) return undefined;

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

    saveTimerRef.current = setTimeout(async () => {
      try {
        const ok = await saveRemotePortfolio(payload);
        if (ok) lastSavedRef.current = serialized;
      } catch {
        // Keep local copy; will retry on next change.
      }
    }, 2000);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [user, portfolioState]);
}

export function PortfolioSync() {
  usePortfolioSync();
  return null;
}
