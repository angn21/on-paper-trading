import { useEffect, useState } from 'react';
import { generateOptionsChain } from '../lib/blackScholes';
import { fetchLiveOptionsChain, getOptionsChainErrorMessage } from '../marketData/massiveOptions';

/**
 * Live Massive options chain with Black-Scholes fallback.
 */
export function useOptionsChain(symbol, underlyingPrice, sigma) {
  const [state, setState] = useState({
    chains: [],
    source: 'loading',
    message: '',
    fromCache: false,
  });

  useEffect(() => {
    const upper = symbol?.toUpperCase();
    if (!upper) return undefined;

    let cancelled = false;

    async function load() {
      setState((prev) => ({
        ...prev,
        source: 'loading',
        message: '',
      }));

      try {
        const live = await fetchLiveOptionsChain(upper, underlyingPrice || 0);
        if (!cancelled) {
          setState({
            chains: live.chains,
            source: 'live',
            message: live.fromCache ? 'Using cached chain (refreshes every 20 min).' : '',
            fromCache: live.fromCache,
          });
        }
      } catch (error) {
        if (cancelled) return;
        const chains = generateOptionsChain(upper, underlyingPrice || 100, sigma);
        setState({
          chains,
          source: 'model',
          message: getOptionsChainErrorMessage(error),
          fromCache: false,
        });
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [symbol, underlyingPrice, sigma]);

  return state;
}
