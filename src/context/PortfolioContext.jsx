import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { priceOptionPosition } from '../lib/blackScholes';

const STORAGE_KEY = 'on-paper-portfolio-v1';
const STARTING_CASH = 100_000;

const defaultState = {
  cash: STARTING_CASH,
  positions: {},
  options: [],
  watchlist: [],
  transactions: [],
  portfolioHistory: [],
};

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState;
    return { ...defaultState, ...JSON.parse(raw) };
  } catch {
    return defaultState;
  }
}

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

const PortfolioContext = createContext(null);

export function PortfolioProvider({ children }) {
  const [state, setState] = useState(() => {
    const loaded = loadState();
    if (!loaded.portfolioHistory.length) {
      return {
        ...loaded,
        portfolioHistory: [{ ts: Date.now(), totalValue: loaded.cash }],
      };
    }
    return loaded;
  });
  const [quotes, setQuotes] = useState({});

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const setQuote = useCallback((symbol, quote) => {
    setQuotes((prev) => ({ ...prev, [symbol.toUpperCase()]: quote }));
  }, []);

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

  const buyStock = useCallback((symbol, shares, price) => {
    const upper = symbol.toUpperCase();
    const qty = Number(shares);
    const px = Number(price);

    if (!upper || qty <= 0 || px <= 0) {
      return { ok: false, error: 'Enter a valid quantity and price.' };
    }

    const cost = qty * px;

    let result = { ok: false, error: 'Unable to buy.' };

    setState((prev) => {
      if (cost > prev.cash) {
        result = { ok: false, error: 'Not enough cash for this purchase.' };
        return prev;
      }

      const existing = prev.positions[upper] || { shares: 0, avgCost: 0 };
      const totalShares = existing.shares + qty;
      const avgCost = (existing.shares * existing.avgCost + cost) / totalShares;

      result = { ok: true };

      return {
        ...prev,
        cash: prev.cash - cost,
        positions: {
          ...prev.positions,
          [upper]: { shares: totalShares, avgCost },
        },
        transactions: [
          {
            id: makeId(),
            ts: Date.now(),
            kind: 'stock',
            side: 'buy',
            symbol: upper,
            shares: qty,
            price: px,
            total: cost,
          },
          ...prev.transactions,
        ].slice(0, 200),
      };
    });

    return result;
  }, []);

  const sellStock = useCallback((symbol, shares, price) => {
    const upper = symbol.toUpperCase();
    const qty = Number(shares);
    const px = Number(price);

    if (!upper || qty <= 0 || px <= 0) {
      return { ok: false, error: 'Enter a valid quantity and price.' };
    }

    let result = { ok: false, error: 'Unable to sell.' };

    setState((prev) => {
      const existing = prev.positions[upper];
      if (!existing || qty > existing.shares) {
        result = { ok: false, error: 'You do not own enough shares to sell.' };
        return prev;
      }

      const proceeds = qty * px;
      const remaining = existing.shares - qty;
      const nextPositions = { ...prev.positions };

      if (remaining <= 0) {
        delete nextPositions[upper];
      } else {
        nextPositions[upper] = { shares: remaining, avgCost: existing.avgCost };
      }

      result = { ok: true };

      return {
        ...prev,
        cash: prev.cash + proceeds,
        positions: nextPositions,
        transactions: [
          {
            id: makeId(),
            ts: Date.now(),
            kind: 'stock',
            side: 'sell',
            symbol: upper,
            shares: qty,
            price: px,
            total: proceeds,
            realizedPL: (px - existing.avgCost) * qty,
          },
          ...prev.transactions,
        ].slice(0, 200),
      };
    });

    return result;
  }, []);

  const buyOption = useCallback((contract, contracts, premium) => {
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

      result = { ok: true };

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
          },
          ...prev.transactions,
        ].slice(0, 200),
      };
    });

    return result;
  }, []);

  const sellOption = useCallback((positionId, contracts, premium) => {
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

      result = { ok: true };

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
          },
          ...prev.transactions,
        ].slice(0, 200),
      };
    });

    return result;
  }, []);

  const snapshotPortfolio = useCallback((totalValue) => {
    setState((prev) => {
      const now = Date.now();
      const last = prev.portfolioHistory[prev.portfolioHistory.length - 1];
      if (last && Math.abs(last.ts - now) < 60_000) {
        const updated = [...prev.portfolioHistory];
        updated[updated.length - 1] = { ts: now, totalValue };
        return { ...prev, portfolioHistory: updated.slice(-500) };
      }

      return {
        ...prev,
        portfolioHistory: [...prev.portfolioHistory, { ts: now, totalValue }].slice(-500),
      };
    });
  }, []);

  const resetPortfolio = useCallback(() => {
    setState(defaultState);
    setQuotes({});
  }, []);

  const computed = useMemo(() => {
    const stockPositions = Object.entries(state.positions).map(([symbol, position]) => {
      const quote = quotes[symbol];
      const price = quote?.c ?? position.avgCost;
      const marketValue = price * position.shares;
      const costBasis = position.avgCost * position.shares;
      return {
        symbol,
        shares: position.shares,
        avgCost: position.avgCost,
        price,
        marketValue,
        unrealizedPL: marketValue - costBasis,
        dayChangePct: quote?.dp ?? 0,
      };
    });

    const optionPositions = state.options.map((position) => {
      const underlying = quotes[position.symbol]?.c ?? seededFallbackPrice(position.symbol);
      const pricing = priceOptionPosition(position, underlying);
      return {
        ...position,
        underlying,
        ...pricing,
      };
    });

    const stocksValue = stockPositions.reduce((sum, item) => sum + item.marketValue, 0);
    const optionsValue = optionPositions.reduce((sum, item) => sum + item.marketValue, 0);
    const totalValue = state.cash + stocksValue + optionsValue;
    const stockPL = stockPositions.reduce((sum, item) => sum + item.unrealizedPL, 0);
    const optionsPL = optionPositions.reduce((sum, item) => sum + item.unrealizedPL, 0);

    return {
      stockPositions,
      optionPositions,
      stocksValue,
      optionsValue,
      totalValue,
      stockPL,
      optionsPL,
      totalPL: stockPL + optionsPL,
    };
  }, [quotes, state]);

  const value = {
    ...state,
    ...computed,
    quotes,
    setQuote,
    toggleWatchlist,
    buyStock,
    sellStock,
    buyOption,
    sellOption,
    snapshotPortfolio,
    resetPortfolio,
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
