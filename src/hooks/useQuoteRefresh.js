import { useEffect, useRef } from 'react';
import { marketData } from '../marketData/marketData';
import { usePortfolioContext } from '../context/PortfolioContext';

function snapshotHasVol(symbol, marketSnapshot) {
  return marketSnapshot?.volatility?.[symbol.toUpperCase()] != null;
}

export function useQuoteRefresh() {
  const {
    positions,
    options,
    watchlist,
    pendingOrders,
    portfolioState,
    setQuote,
    setVolatility,
    processPendingOrders,
    snapshotPortfolio,
    totalValue,
    isQuoteRefreshPaused,
  } = usePortfolioContext();

  const totalValueRef = useRef(totalValue);
  totalValueRef.current = totalValue;

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
    let timer;

    async function refreshQuotes() {
      await marketData.getMarketStatus();

      const priceMap = {};

      await Promise.all(
        [...symbols].map(async (symbol) => {
          const upper = symbol.toUpperCase();
          const skipVol = snapshotHasVol(upper, portfolioState.marketSnapshot);

          try {
            const quote = await marketData.getQuote(symbol);
            if (!cancelled) {
              setQuote(symbol, quote);
              priceMap[symbol] = quote;
            }

            if (!skipVol) {
              const volResult = await marketData.getVolatility(symbol);
              if (!cancelled) setVolatility(symbol, volResult);
            }
          } catch {
            // Handled in marketData fallback.
          }
        }),
      );

      if (!cancelled) {
        processPendingOrders(priceMap);
        snapshotPortfolio(totalValueRef.current, priceMap.SPY?.c);
      }
    }

    async function tick() {
      if (cancelled) return;
      if (!isQuoteRefreshPaused()) {
        await refreshQuotes();
      }
      if (cancelled) return;
      timer = setTimeout(tick, marketData.getQuoteRefreshInterval());
    }

    tick();

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [
    options,
    pendingOrders,
    portfolioState.marketSnapshot,
    positions,
    processPendingOrders,
    setQuote,
    setVolatility,
    snapshotPortfolio,
    watchlist,
    isQuoteRefreshPaused,
  ]);
}
