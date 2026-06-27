import { useCallback, useEffect, useRef, useState } from 'react';
import { generateOptionsChain } from '../lib/blackScholes';
import {
  fetchExpiryEodPrices,
  fetchLiveOptionsChain,
  getOptionsChainErrorMessage,
} from '../marketData/massiveOptions';

/**
 * Massive options chain — snapshot (Starter+) or reference+EOD (Basic).
 */
export function useOptionsChain(symbol, underlyingPrice, sigma) {
  const [state, setState] = useState({
    chains: [],
    expiries: [],
    source: 'loading',
    message: '',
    fromCache: false,
  });

  const contractsRef = useRef(null);
  const pricedExpiriesRef = useRef(new Set());
  const sourceRef = useRef('loading');

  useEffect(() => {
    const upper = symbol?.toUpperCase();
    if (!upper) return undefined;

    let cancelled = false;
    contractsRef.current = null;
    pricedExpiriesRef.current = new Set();

    async function load() {
      setState({ chains: [], expiries: [], source: 'loading', message: '', fromCache: false });

      try {
        const live = await fetchLiveOptionsChain(upper, underlyingPrice || 0);
        if (cancelled) return;

        contractsRef.current = live.contracts;
        live.chains.forEach((c) => pricedExpiriesRef.current.add(c.expiry));

        setState({
          chains: live.chains,
          expiries: live.expiries || live.chains.map((c) => c.expiry),
          source: live.source,
          message: live.fromCache ? 'Using cached chain (refreshes every 20 min).' : '',
          fromCache: live.fromCache,
        });
        sourceRef.current = live.source;
      } catch (error) {
        if (cancelled) return;
        const model = generateOptionsChain(upper, underlyingPrice || 100, sigma);
        setState({
          chains: model,
          expiries: model.map((c) => c.expiry),
          source: 'model',
          message: getOptionsChainErrorMessage(error),
          fromCache: false,
        });
        sourceRef.current = 'model';
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [symbol, underlyingPrice, sigma]);

  const loadExpiry = useCallback(async (expiry) => {
    if (!expiry || sourceRef.current !== 'eod' || pricedExpiriesRef.current.has(expiry)) {
      return;
    }

    try {
      const chains = await fetchExpiryEodPrices(
        symbol,
        expiry,
        underlyingPrice || 0,
        contractsRef.current,
      );
      pricedExpiriesRef.current.add(expiry);
      setState((prev) => {
        const merged = new Map(prev.chains.map((c) => [c.expiry, c]));
        chains.forEach((c) => merged.set(c.expiry, c));
        return {
          ...prev,
          chains: [...merged.values()].sort((a, b) => a.expiry.localeCompare(b.expiry)),
          message: 'Additional expiries load on demand (5 API calls/min).',
        };
      });
    } catch {
      // Keep existing chain visible.
    }
  }, [symbol, underlyingPrice]);

  return { ...state, loadExpiry };
}
