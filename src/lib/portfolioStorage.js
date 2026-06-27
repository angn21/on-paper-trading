export const STORAGE_KEY = 'on-paper-portfolio-v2';
export const STARTING_CASH = 100_000;

export const defaultPortfolioState = {
  cash: STARTING_CASH,
  positions: {},
  options: [],
  watchlist: [],
  transactions: [],
  portfolioHistory: [],
  pendingOrders: [],
  benchmarkHistory: [],
  marketSnapshot: { quotes: {}, volatility: {} },
};

export function symbolsForPortfolio(state) {
  return [...new Set([
    ...Object.keys(state?.positions || {}),
    ...(state?.options || []).map((o) => o.symbol),
    ...(state?.watchlist || []),
    ...(state?.pendingOrders || []).map((o) => o.symbol),
    'SPY',
  ])];
}

export function sanitizeMarketSnapshot(raw) {
  if (!raw || typeof raw !== 'object') {
    return { quotes: {}, volatility: {} };
  }

  const quotes = {};
  if (raw.quotes && typeof raw.quotes === 'object') {
    Object.entries(raw.quotes).forEach(([symbol, quote]) => {
      const upper = symbol.toUpperCase();
      const price = Number(quote?.c);
      if (price > 0) {
        quotes[upper] = { c: price, dp: Number(quote?.dp) || 0 };
      }
    });
  }

  const volatility = {};
  if (raw.volatility && typeof raw.volatility === 'object') {
    Object.entries(raw.volatility).forEach(([symbol, value]) => {
      const sigma = Number(value);
      if (sigma > 0) volatility[symbol.toUpperCase()] = sigma;
    });
  }

  return { quotes, volatility };
}

export function buildMarketSnapshot(state, quotes = {}, volatility = {}) {
  const snapshot = { quotes: {}, volatility: {} };

  symbolsForPortfolio(state).forEach((symbol) => {
    const upper = symbol.toUpperCase();
    if (quotes[upper]?.c) {
      snapshot.quotes[upper] = {
        c: quotes[upper].c,
        dp: quotes[upper].dp ?? 0,
      };
    }
    if (volatility[upper]) {
      snapshot.volatility[upper] = volatility[upper];
    }
  });

  return snapshot;
}

export function sanitizePortfolioState(raw) {
  if (!raw || typeof raw !== 'object') return { ...defaultPortfolioState };

  return {
    cash: Number(raw.cash) >= 0 ? Number(raw.cash) : STARTING_CASH,
    positions: raw.positions && typeof raw.positions === 'object' ? raw.positions : {},
    options: Array.isArray(raw.options) ? raw.options : [],
    watchlist: Array.isArray(raw.watchlist) ? raw.watchlist : [],
    transactions: Array.isArray(raw.transactions) ? raw.transactions : [],
    portfolioHistory: Array.isArray(raw.portfolioHistory) ? raw.portfolioHistory : [],
    pendingOrders: Array.isArray(raw.pendingOrders) ? raw.pendingOrders : [],
    benchmarkHistory: Array.isArray(raw.benchmarkHistory) ? raw.benchmarkHistory : [],
    marketSnapshot: sanitizeMarketSnapshot(raw.marketSnapshot),
  };
}

export function loadLocalPortfolio() {
  try {
    const raw =
      localStorage.getItem(STORAGE_KEY) || localStorage.getItem('on-paper-portfolio-v1');
    if (!raw) return { ...defaultPortfolioState };
    return sanitizePortfolioState({ ...defaultPortfolioState, ...JSON.parse(raw) });
  } catch {
    return { ...defaultPortfolioState };
  }
}

export function saveLocalPortfolio(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  localStorage.setItem(`${STORAGE_KEY}-updated`, String(Date.now()));
}

export function getLocalPortfolioUpdatedAt() {
  const stored = Number(localStorage.getItem(`${STORAGE_KEY}-updated`) || 0);
  if (stored) return stored;

  const local = loadLocalPortfolio();
  const latestTx = local.transactions?.[0]?.ts;
  if (latestTx) return latestTx;

  return 0;
}

export function hasPortfolioActivity(state) {
  if (!state) return false;
  return (
    (state.transactions?.length ?? 0) > 0 ||
    Object.keys(state.positions || {}).length > 0 ||
    (state.options?.length ?? 0) > 0 ||
    (state.watchlist?.length ?? 0) > 0 ||
    (state.pendingOrders?.length ?? 0) > 0 ||
    state.cash !== STARTING_CASH
  );
}

export function pickSyncPayload(state) {
  const payload = sanitizePortfolioState(state);
  return {
    ...payload,
    marketSnapshot: payload.marketSnapshot,
  };
}

export function resolveUnderlyingPrice(symbol, liveQuotes, marketSnapshot, fallbackPrice) {
  const upper = symbol.toUpperCase();
  if (liveQuotes[upper]?.c) return liveQuotes[upper].c;
  if (marketSnapshot?.quotes?.[upper]?.c) return marketSnapshot.quotes[upper].c;
  return fallbackPrice(upper);
}

export function resolveVolatility(symbol, liveVolatility, marketSnapshot) {
  const upper = symbol.toUpperCase();
  if (liveVolatility[upper]) return liveVolatility[upper];
  if (marketSnapshot?.volatility?.[upper]) return marketSnapshot.volatility[upper];
  return 0.3;
}
