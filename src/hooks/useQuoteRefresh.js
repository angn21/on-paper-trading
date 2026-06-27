import { useEffect } from 'react';
import { marketData } from '../marketData/marketData';
import { usePortfolioContext } from '../context/PortfolioContext';

export function useQuoteRefresh() {
  const { positions, options, watchlist, setQuote, setVolatility } = usePortfolioContext();

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
            const [quote, sigma] = await Promise.all([
              marketData.getQuote(symbol),
              marketData.getVolatility(symbol),
            ]);
            if (!cancelled) {
              setQuote(symbol, quote);
              setVolatility(symbol, sigma);
            }
          } catch {
            // Individual failures are handled in marketData fallback.
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
  }, [options, positions, watchlist, setQuote, setVolatility]);
}
