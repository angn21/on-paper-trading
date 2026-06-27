import { useEffect } from 'react';
import { marketData } from '../marketData/marketData';
import { usePortfolioContext } from '../context/PortfolioContext';

export function useQuoteRefresh() {
  const {
    positions,
    options,
    watchlist,
    pendingOrders,
    setQuote,
    setVolatility,
    processPendingOrders,
    snapshotPortfolio,
    totalValue,
  } = usePortfolioContext();

  useEffect(() => {
    const symbols = new Set([
      ...Object.keys(positions),
      ...options.map((item) => item.symbol),
      ...watchlist,
      ...pendingOrders.map((o) => o.symbol),
      'SPY',
    ]);

    if (!symbols.size) return undefined;

    let cancelled = false;

    async function refreshQuotes() {
      const priceMap = {};

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
              priceMap[symbol] = quote;
            }
          } catch {
            // Handled in marketData fallback.
          }
        }),
      );

      if (!cancelled) {
        processPendingOrders(priceMap);
        snapshotPortfolio(totalValue, priceMap.SPY?.c);
      }
    }

    refreshQuotes();
    const interval = setInterval(refreshQuotes, 60_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [
    options,
    pendingOrders,
    positions,
    processPendingOrders,
    setQuote,
    setVolatility,
    snapshotPortfolio,
    totalValue,
    watchlist,
  ]);
}
