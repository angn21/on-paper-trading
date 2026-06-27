import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { priceOptionPosition } from '../lib/blackScholes';
import { shouldFillOrder } from '../lib/orders';
import { applyStockTrade, revertStockTransaction } from '../lib/positions';
import { marketData } from '../marketData/marketData';
import {
  STARTING_CASH,
  defaultPortfolioState,
  loadLocalPortfolio,
  saveLocalPortfolio,
  sanitizePortfolioState,
  resolveUnderlyingPrice,
  resolveVolatility,
} from '../lib/portfolioStorage';

const defaultState = defaultPortfolioState;

function loadState() {
  return loadLocalPortfolio();
}

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

const PortfolioContext = createContext(null);

export function PortfolioProvider({ children }) {
  const [state, setState] = useState(() => {
    const loaded = loadState();
    if (!loaded.portfolioHistory.length) {
      return { ...loaded, portfolioHistory: [{ ts: Date.now(), totalValue: loaded.cash }] };
    }
    return loaded;
  });
  const [quotes, setQuotes] = useState({});
  const [volatility, setVolatilityState] = useState({});
  const [volatilityReliability, setVolatilityReliability] = useState({});
  const [priceHistory, setPriceHistory] = useState({});
  const lastSnapshotRef = useRef(0);
  const quoteRefreshPausedUntilRef = useRef(0);

  useEffect(() => {
    const snapshot = state.marketSnapshot;
    if (!snapshot?.quotes && !snapshot?.volatility) return;

    Object.entries(snapshot.quotes || {}).forEach(([symbol, quote]) => {
      const upper = symbol.toUpperCase();
      setQuotes((prev) => ({
        ...prev,
        [upper]: { c: quote.c, d: 0, dp: quote.dp ?? 0, pc: quote.c },
      }));
    });

    Object.entries(snapshot.volatility || {}).forEach(([symbol, sigma]) => {
      const upper = symbol.toUpperCase();
      setVolatilityState((prev) => ({ ...prev, [upper]: sigma }));
      setVolatilityReliability((prev) => ({ ...prev, [upper]: true }));
    });
  }, [state.marketSnapshot]);

  const pauseQuoteRefresh = useCallback((durationMs = 180_000) => {
    quoteRefreshPausedUntilRef.current = Date.now() + durationMs;
  }, []);

  const isQuoteRefreshPaused = useCallback(() => {
    return Date.now() < quoteRefreshPausedUntilRef.current;
  }, []);

  const resumeQuoteRefresh = useCallback(() => {
    quoteRefreshPausedUntilRef.current = 0;
  }, []);

  useEffect(() => {
    saveLocalPortfolio(state);
  }, [state]);

  const replacePortfolioState = useCallback((next) => {
    const merged = sanitizePortfolioState(next);
    if (!merged.portfolioHistory.length) {
      merged.portfolioHistory = [{ ts: Date.now(), totalValue: merged.cash }];
    }
    saveLocalPortfolio(merged);
    setState(merged);
  }, []);

  const mergeMarketSnapshot = useCallback((snapshot) => {
    setState((prev) => ({
      ...prev,
      marketSnapshot: sanitizePortfolioState({ marketSnapshot: snapshot }).marketSnapshot,
    }));
  }, []);

  const invalidateMarketQuotes = useCallback(() => {
    setQuotes({});
  }, []);

  const setQuote = useCallback((symbol, quote) => {
    const upper = symbol.toUpperCase();
    setQuotes((prev) => ({ ...prev, [upper]: quote }));
    if (quote?.c) {
      setPriceHistory((prev) => ({
        ...prev,
        [upper]: [...(prev[upper] || []), quote.c].slice(-24),
      }));
    }
  }, []);

  const setVolatility = useCallback((symbol, sigmaOrResult, reliable = true) => {
    const upper = symbol.toUpperCase();
    let sigma = sigmaOrResult;
    let isReliable = reliable;

    if (sigmaOrResult && typeof sigmaOrResult === 'object' && 'sigma' in sigmaOrResult) {
      sigma = sigmaOrResult.sigma;
      isReliable = sigmaOrResult.reliable;
    }

    setVolatilityState((prev) => ({ ...prev, [upper]: sigma }));
    setVolatilityReliability((prev) => ({ ...prev, [upper]: isReliable }));
  }, []);

  const refreshVolatility = useCallback(async (symbol) => {
    const upper = symbol?.toUpperCase();
    if (!upper) return null;

    const snap = state.marketSnapshot;
    if (snap?.volatility?.[upper] != null) {
      setVolatility(upper, snap.volatility[upper], true);
      return { sigma: snap.volatility[upper], reliable: true };
    }

    const result = await marketData.getVolatility(upper);
    setVolatility(upper, result);
    return result;
  }, [setVolatility, state.marketSnapshot]);

  const toggleWatchlist = useCallback((symbol) => {
    const upper = symbol.toUpperCase();
    setState((prev) => {
      const exists = prev.watchlist.includes(upper);
      return {
        ...prev,
        watchlist: exists
          ? prev.watchlist.filter((item) => item !== upper)
          : [...prev.watchlist, upper],
      };
    });
  }, []);

  const executeTrade = useCallback((upper, side, qty, px, note = '', orderType = 'market') => {
    let result = { ok: false, error: 'Unable to complete trade.' };

    setState((prev) => {
      const applied = applyStockTrade(prev, { upper, side, qty, px, note, orderType });
      if (applied.error) {
        result = { ok: false, error: applied.error };
        return prev;
      }

      result = {
        ok: true,
        txId: applied.transaction.id,
        message: applied.message,
      };

      return {
        ...prev,
        cash: applied.cash,
        positions: applied.positions,
        transactions: [applied.transaction, ...prev.transactions].slice(0, 200),
      };
    });

    return result;
  }, []);

  const buyStock = useCallback(
    (symbol, shares, price, note = '', orderType = 'market') => {
      const upper = symbol.toUpperCase();
      const qty = Number(shares);
      const px = Number(price);
      if (!upper || qty <= 0 || px <= 0) {
        return { ok: false, error: 'Enter a valid quantity and price.' };
      }
      return executeTrade(upper, 'buy', qty, px, note, orderType);
    },
    [executeTrade],
  );

  const sellStock = useCallback(
    (symbol, shares, price, note = '', orderType = 'market') => {
      const upper = symbol.toUpperCase();
      const qty = Number(shares);
      const px = Number(price);
      if (!upper || qty <= 0 || px <= 0) {
        return { ok: false, error: 'Enter a valid quantity and price.' };
      }
      return executeTrade(upper, 'sell', qty, px, note, orderType);
    },
    [executeTrade],
  );

  const placeStockOrder = useCallback(
    ({ symbol, side, orderType, shares, price, limitPrice, stopPrice, note = '' }) => {
      const upper = symbol.toUpperCase();
      const qty = Number(shares);

      if (!upper || qty <= 0) {
        return { ok: false, error: 'Enter a valid quantity.' };
      }

      if (orderType === 'market') {
        const px = Number(price);
        if (px <= 0) return { ok: false, error: 'Invalid market price.' };
        return side === 'buy'
          ? buyStock(upper, qty, px, note, 'market')
          : sellStock(upper, qty, px, note, 'market');
      }

      if (orderType === 'limit' && (!limitPrice || limitPrice <= 0)) {
        return { ok: false, error: 'Enter a valid limit price.' };
      }
      if (orderType === 'stop' && (!stopPrice || stopPrice <= 0)) {
        return { ok: false, error: 'Enter a valid stop price.' };
      }

      const order = {
        id: makeId(),
        symbol: upper,
        side,
        orderType,
        shares: qty,
        limitPrice: limitPrice ? Number(limitPrice) : null,
        stopPrice: stopPrice ? Number(stopPrice) : null,
        note,
        createdAt: Date.now(),
      };

      setState((prev) => ({
        ...prev,
        pendingOrders: [order, ...prev.pendingOrders].slice(0, 50),
      }));

      return {
        ok: true,
        message: `${orderType} ${side} order placed for ${qty} ${upper}`,
        pending: true,
      };
    },
    [buyStock, sellStock],
  );

  const cancelPendingOrder = useCallback((orderId) => {
    setState((prev) => ({
      ...prev,
      pendingOrders: prev.pendingOrders.filter((o) => o.id !== orderId),
    }));
  }, []);

  const processPendingOrders = useCallback(
    (priceMap) => {
      setState((prev) => {
        if (!prev.pendingOrders.length) return prev;

        const remaining = [];
        let next = prev;

        prev.pendingOrders.forEach((order) => {
          const price = priceMap[order.symbol]?.c;
          if (!shouldFillOrder(order, price)) {
            remaining.push(order);
            return;
          }

          const fillPrice = order.orderType === 'limit' ? order.limitPrice : price;
          const applied = applyStockTrade(next, {
            upper: order.symbol,
            side: order.side,
            qty: order.shares,
            px: fillPrice,
            note: order.note,
            orderType: order.orderType,
          });

          if (applied.error) {
            remaining.push(order);
            return;
          }

          next = {
            ...next,
            cash: applied.cash,
            positions: applied.positions,
            transactions: [applied.transaction, ...next.transactions].slice(0, 200),
          };
        });

        if (remaining.length === prev.pendingOrders.length) return prev;
        return { ...next, pendingOrders: remaining };
      });
    },
    [],
  );

  const revertLastTransaction = useCallback(() => {
    setState((prev) => {
      const [last, ...rest] = prev.transactions;
      if (!last || last.kind !== 'stock') return prev;
      if (last.prevShares == null) return prev;
      return revertStockTransaction({ ...prev, transactions: rest }, last);
    });
    return true;
  }, []);

  const updateTransactionNote = useCallback((txId, note) => {
    setState((prev) => ({
      ...prev,
      transactions: prev.transactions.map((tx) =>
        tx.id === txId ? { ...tx, note } : tx,
      ),
    }));
  }, []);

  const addCash = useCallback((amount) => {
    const value = Number(amount);
    if (value <= 0) return { ok: false, error: 'Enter a positive amount.' };
    setState((prev) => ({ ...prev, cash: prev.cash + value }));
    return { ok: true, message: `Added ${value.toFixed(2)} to cash.` };
  }, []);

  const buyOption = useCallback((contract, contracts, premium, note = '') => {
    const qty = Number(contracts);
    const px = Number(premium);
    const cost = qty * px * 100;
    if (qty <= 0 || px <= 0) {
      return { ok: false, error: 'Enter a valid contract count and premium.' };
    }

    let result = { ok: false, error: 'Unable to buy option.' };

    setState((prev) => {
      if (cost > prev.cash) {
        result = { ok: false, error: 'Not enough cash for this option purchase.' };
        return prev;
      }

      const existing = prev.options.find(
        (item) =>
          item.symbol === contract.symbol &&
          item.type === contract.type &&
          item.strike === contract.strike &&
          item.expiry === contract.expiry,
      );

      let nextOptions;
      if (existing) {
        const totalContracts = existing.contracts + qty;
        const avgPremium =
          (existing.avgPremium * existing.contracts + px * qty) / totalContracts;
        nextOptions = prev.options.map((item) =>
          item.id === existing.id
            ? { ...item, contracts: totalContracts, avgPremium }
            : item,
        );
      } else {
        nextOptions = [
          ...prev.options,
          {
            id: makeId(),
            symbol: contract.symbol,
            type: contract.type,
            strike: contract.strike,
            expiry: contract.expiry,
            contracts: qty,
            avgPremium: px,
          },
        ];
      }

      result = { ok: true, message: `Bought ${qty} ${contract.type} contract(s).` };

      return {
        ...prev,
        cash: prev.cash - cost,
        options: nextOptions,
        transactions: [
          {
            id: makeId(),
            ts: Date.now(),
            kind: 'option',
            side: 'buy',
            symbol: contract.symbol,
            optionType: contract.type,
            strike: contract.strike,
            expiry: contract.expiry,
            contracts: qty,
            price: px,
            total: cost,
            note,
          },
          ...prev.transactions,
        ].slice(0, 200),
      };
    });

    return result;
  }, []);

  const sellOption = useCallback((positionId, contracts, premium, note = '') => {
    const qty = Number(contracts);
    const px = Number(premium);
    if (qty <= 0 || px <= 0) {
      return { ok: false, error: 'Enter a valid contract count and premium.' };
    }

    let result = { ok: false, error: 'Unable to sell option.' };

    setState((prev) => {
      const existing = prev.options.find((item) => item.id === positionId);
      if (!existing || qty > existing.contracts) {
        result = { ok: false, error: 'You do not own enough contracts to sell.' };
        return prev;
      }

      const proceeds = qty * px * 100;
      const remaining = existing.contracts - qty;
      let nextOptions = prev.options;

      if (remaining <= 0) {
        nextOptions = prev.options.filter((item) => item.id !== positionId);
      } else {
        nextOptions = prev.options.map((item) =>
          item.id === positionId ? { ...item, contracts: remaining } : item,
        );
      }

      result = {
        ok: true,
        message: `Sold ${qty} contract(s) · ${remaining} remaining`,
      };

      return {
        ...prev,
        cash: prev.cash + proceeds,
        options: nextOptions,
        transactions: [
          {
            id: makeId(),
            ts: Date.now(),
            kind: 'option',
            side: 'sell',
            symbol: existing.symbol,
            optionType: existing.type,
            strike: existing.strike,
            expiry: existing.expiry,
            contracts: qty,
            price: px,
            total: proceeds,
            realizedPL: (px - existing.avgPremium) * qty * 100,
            note,
          },
          ...prev.transactions,
        ].slice(0, 200),
      };
    });

    return result;
  }, []);

  const snapshotPortfolio = useCallback((totalValue, spyPrice = null) => {
    const now = Date.now();
    if (now - lastSnapshotRef.current < 55_000) return;
    lastSnapshotRef.current = now;

    setState((prev) => {
      const last = prev.portfolioHistory[prev.portfolioHistory.length - 1];
      let portfolioHistory = prev.portfolioHistory;
      if (last && Math.abs(last.ts - now) < 60_000) {
        portfolioHistory = [...prev.portfolioHistory];
        portfolioHistory[portfolioHistory.length - 1] = { ts: now, totalValue };
      } else {
        portfolioHistory = [...prev.portfolioHistory, { ts: now, totalValue }].slice(-500);
      }

      let benchmarkHistory = prev.benchmarkHistory;
      if (spyPrice && spyPrice > 0) {
        const benchPoint = { ts: now, spyPrice, portfolioValue: totalValue };
        const lastBench = prev.benchmarkHistory[prev.benchmarkHistory.length - 1];
        if (lastBench && Math.abs(lastBench.ts - now) < 60_000) {
          benchmarkHistory = [...prev.benchmarkHistory];
          benchmarkHistory[benchmarkHistory.length - 1] = benchPoint;
        } else {
          benchmarkHistory = [...prev.benchmarkHistory, benchPoint].slice(-500);
        }
      }

      return { ...prev, portfolioHistory, benchmarkHistory };
    });
  }, []);

  const resetPortfolio = useCallback(() => {
    setState({
      ...defaultState,
      portfolioHistory: [{ ts: Date.now(), totalValue: STARTING_CASH }],
    });
    setQuotes({});
    setVolatilityState({});
    setVolatilityReliability({});
  }, []);

  const computed = useMemo(() => {
    const stockPositions = Object.entries(state.positions).map(([symbol, position]) => {
      const quote = quotes[symbol];
      const price = resolveUnderlyingPrice(
        symbol,
        quotes,
        state.marketSnapshot,
        () => position.avgCost,
      );
      const marketValue = price * position.shares;
      const costBasis = position.avgCost * position.shares;
      const isShort = position.shares < 0;
      return {
        symbol,
        shares: position.shares,
        avgCost: position.avgCost,
        price,
        marketValue,
        unrealizedPL: marketValue - costBasis,
        dayChangePct: quote?.dp ?? 0,
        isShort,
      };
    });

    const optionPositions = state.options.map((position) => {
      const underlying = resolveUnderlyingPrice(
        position.symbol,
        quotes,
        state.marketSnapshot,
        seededFallbackPrice,
      );
      const sigma = resolveVolatility(
        position.symbol,
        volatility,
        state.marketSnapshot,
        volatilityReliability,
      );
      const pricing = priceOptionPosition(position, underlying, sigma);
      return { ...position, underlying, ...pricing };
    });

    const stocksValue = stockPositions.reduce((sum, item) => sum + item.marketValue, 0);
    const optionsValue = optionPositions.reduce((sum, item) => sum + item.marketValue, 0);
    const totalValue = state.cash + stocksValue + optionsValue;
    const stockPL = stockPositions.reduce((sum, item) => sum + item.unrealizedPL, 0);
    const optionsPL = optionPositions.reduce((sum, item) => sum + item.unrealizedPL, 0);

    const allocation =
      totalValue > 0
        ? {
            cash: (state.cash / totalValue) * 100,
            stocks: (stocksValue / totalValue) * 100,
            options: (optionsValue / totalValue) * 100,
          }
        : { cash: 100, stocks: 0, options: 0 };

    const realizedPL = state.transactions.reduce(
      (sum, tx) => sum + (tx.realizedPL || 0),
      0,
    );
    const winningTrades = state.transactions.filter((tx) => (tx.realizedPL || 0) > 0).length;
    const losingTrades = state.transactions.filter((tx) => (tx.realizedPL || 0) < 0).length;
    const closedTrades = winningTrades + losingTrades;

    return {
      stockPositions,
      optionPositions,
      stocksValue,
      optionsValue,
      totalValue,
      stockPL,
      optionsPL,
      totalPL: stockPL + optionsPL,
      allocation,
      performance: {
        realizedPL,
        winRate: closedTrades ? (winningTrades / closedTrades) * 100 : 0,
        closedTrades,
        totalTrades: state.transactions.length,
      },
    };
  }, [quotes, state, volatility, volatilityReliability]);

  const value = {
    ...state,
    ...computed,
    portfolioState: state,
    quotes,
    volatility,
    volatilityReliability,
    priceHistory,
    setQuote,
    setVolatility,
    refreshVolatility,
    toggleWatchlist,
    buyStock,
    sellStock,
    placeStockOrder,
    cancelPendingOrder,
    processPendingOrders,
    revertLastTransaction,
    updateTransactionNote,
    addCash,
    buyOption,
    sellOption,
    snapshotPortfolio,
    resetPortfolio,
    replacePortfolioState,
    invalidateMarketQuotes,
    mergeMarketSnapshot,
    pauseQuoteRefresh,
    isQuoteRefreshPaused,
    resumeQuoteRefresh,
  };

  return <PortfolioContext.Provider value={value}>{children}</PortfolioContext.Provider>;
}

function seededFallbackPrice(symbol) {
  let hash = 0;
  for (let i = 0; i < symbol.length; i += 1) {
    hash = (hash << 5) - hash + symbol.charCodeAt(i);
    hash |= 0;
  }
  return 20 + (Math.abs(hash) % 480);
}

export function usePortfolioContext() {
  const context = useContext(PortfolioContext);
  if (!context) {
    throw new Error('usePortfolioContext must be used within PortfolioProvider');
  }
  return context;
}
