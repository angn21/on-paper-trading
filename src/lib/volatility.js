/** Default annualized volatility when history is unavailable. */
export const DEFAULT_SIGMA = 0.3;

const MIN_SIGMA = 0.12;
const MAX_SIGMA = 1.0;
const TRADING_DAYS_PER_YEAR = 252;

/**
 * Annualized realized volatility from daily close prices (log returns).
 * @param {number[]} closes - oldest to newest
 */
export function realizedVolatility(closes) {
  if (!closes?.length || closes.length < 5) {
    return null;
  }

  const returns = [];
  for (let i = 1; i < closes.length; i += 1) {
    const prev = closes[i - 1];
    const curr = closes[i];
    if (prev > 0 && curr > 0) {
      returns.push(Math.log(curr / prev));
    }
  }

  if (returns.length < 4) {
    return null;
  }

  const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
  const variance =
    returns.reduce((sum, r) => sum + (r - mean) ** 2, 0) / (returns.length - 1);
  const dailyVol = Math.sqrt(Math.max(variance, 0));
  const annualized = dailyVol * Math.sqrt(TRADING_DAYS_PER_YEAR);

  return Math.min(MAX_SIGMA, Math.max(MIN_SIGMA, annualized));
}

export function formatVolatilityPercent(sigma) {
  return `${Math.round(sigma * 100)}%`;
}
