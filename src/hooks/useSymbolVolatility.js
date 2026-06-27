import { useEffect } from 'react';
import { marketData } from '../marketData/marketData';
import { usePortfolio } from './usePortfolio';

/** Fetch 30-day realized vol for a symbol (options tab, stock detail, etc.). */
export function useSymbolVolatility(symbol) {
  const { setVolatility } = usePortfolio();

  useEffect(() => {
    const upper = symbol?.toUpperCase();
    if (!upper) return undefined;

    let cancelled = false;

    async function load() {
      const result = await marketData.getVolatility(upper);
      if (!cancelled) setVolatility(upper, result);
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [symbol, setVolatility]);
}
