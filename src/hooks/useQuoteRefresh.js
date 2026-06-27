import { useEffect } from 'react';
import { marketData } from '../marketData/marketData';
import { usePortfolioContext } from '../context/PortfolioContext';

export function useQuoteRefresh() {
  const { positions, options, watchlist, setQuote } = usePortfolioContext();

  useEffect(() => {
    const symbols = new Set([
      ...Object.keys(positions),
      ...options.map((item) => item.symbol),
      ...watchlist,
    ]);

    if (!symbols.size) return undefined;

    let cancelled = false;

    async function refreshQuotes() {
      await Promise.all(
        [...symbols].map(async (symbol) => {
          try {
            const quote = await marketData.getQuote(symbol);
            if (!cancelled) setQuote(symbol, quote);
          } catch {
            // Individual quote failures are handled in marketData fallback.
          }
        }),
      );
    }

    refreshQuotes();
    const interval = setInterval(refreshQuotes, 60_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [options, positions, watchlist, setQuote]);
}
