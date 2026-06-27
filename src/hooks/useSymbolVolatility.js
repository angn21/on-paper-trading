import { useEffect } from 'react';
import { hasSyncedMarksForSymbol } from '../lib/portfolioStorage';
import { marketData } from '../marketData/marketData';
import { usePortfolio } from './usePortfolio';

/**
 * Fetch 30-day realized vol for symbols without synced cloud marks.
 * When marketSnapshot already has quote + vol, devices use that for consistency.
 */
export function useSymbolVolatility(symbol) {
  const { setVolatility, portfolioState } = usePortfolio();
  const hasSynced = hasSyncedMarksForSymbol(symbol, portfolioState.marketSnapshot);

  useEffect(() => {
    const upper = symbol?.toUpperCase();
    if (!upper || hasSynced) return undefined;

    let cancelled = false;

    async function load() {
      const result = await marketData.getVolatility(upper);
      if (!cancelled) setVolatility(upper, result);
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [symbol, hasSynced, setVolatility]);
}
