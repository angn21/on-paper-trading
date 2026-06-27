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
};

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
    state.cash !== STARTING_CASH
  );
}

export function pickSyncPayload(state) {
  return sanitizePortfolioState(state);
}
