export const STARTING_CASH = 100_000;

export const PORTFOLIO_FIELDS = [
  'cash',
  'positions',
  'options',
  'watchlist',
  'transactions',
  'portfolioHistory',
  'pendingOrders',
  'benchmarkHistory',
  'marketSnapshot',
];

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

export function sanitizePortfolioState(raw) {
  if (!raw || typeof raw !== 'object') return { ...defaultPortfolioState };

  return {
    cash: Number(raw.cash) >= 0 ? Number(raw.cash) : STARTING_CASH,
    positions: raw.positions && typeof raw.positions === 'object' ? raw.positions : {},
    options: Array.isArray(raw.options) ? raw.options.slice(0, 100) : [],
    watchlist: Array.isArray(raw.watchlist) ? raw.watchlist.slice(0, 50) : [],
    transactions: Array.isArray(raw.transactions) ? raw.transactions.slice(0, 200) : [],
    portfolioHistory: Array.isArray(raw.portfolioHistory) ? raw.portfolioHistory.slice(-500) : [],
    pendingOrders: Array.isArray(raw.pendingOrders) ? raw.pendingOrders.slice(0, 50) : [],
    benchmarkHistory: Array.isArray(raw.benchmarkHistory) ? raw.benchmarkHistory.slice(-500) : [],
    marketSnapshot: sanitizeMarketSnapshot(raw.marketSnapshot),
  };
}

function sanitizeMarketSnapshot(raw) {
  if (!raw || typeof raw !== 'object') {
    return { quotes: {}, volatility: {} };
  }

  const quotes = {};
  if (raw.quotes && typeof raw.quotes === 'object') {
    Object.entries(raw.quotes).slice(0, 50).forEach(([symbol, quote]) => {
      const upper = String(symbol).toUpperCase();
      const price = Number(quote?.c);
      if (price > 0) {
        quotes[upper] = { c: price, dp: Number(quote?.dp) || 0 };
      }
    });
  }

  const volatility = {};
  if (raw.volatility && typeof raw.volatility === 'object') {
    Object.entries(raw.volatility).slice(0, 50).forEach(([symbol, value]) => {
      const sigma = Number(value);
      if (sigma > 0) volatility[String(symbol).toUpperCase()] = sigma;
    });
  }

  return { quotes, volatility };
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

export function normalizeUsername(username) {
  return String(username || '').trim().toLowerCase();
}

export function validateUsername(username) {
  return /^[a-zA-Z0-9_]{3,20}$/.test(String(username || '').trim());
}

export function validatePin(pin) {
  return /^\d{4,6}$/.test(String(pin || ''));
}

export function displayUsername(username) {
  return String(username || '').trim();
}
