/** Sector tags for common US tickers (static map). */
export const SECTOR_MAP = {
  AAPL: 'Technology',
  MSFT: 'Technology',
  GOOGL: 'Technology',
  GOOG: 'Technology',
  AMZN: 'Consumer Cyclical',
  TSLA: 'Consumer Cyclical',
  NVDA: 'Technology',
  META: 'Technology',
  SPY: 'ETF — Broad Market',
  QQQ: 'ETF — Technology',
  JPM: 'Financial',
  BAC: 'Financial',
  XOM: 'Energy',
  JNJ: 'Healthcare',
  UNH: 'Healthcare',
  WMT: 'Consumer Defensive',
  DIS: 'Communication',
  NFLX: 'Communication',
  AMD: 'Technology',
  INTC: 'Technology',
  COST: 'Consumer Defensive',
  V: 'Financial',
  MA: 'Financial',
  PG: 'Consumer Defensive',
  KO: 'Consumer Defensive',
  PEP: 'Consumer Defensive',
  CRM: 'Technology',
  ORCL: 'Technology',
  IBM: 'Technology',
};

export function getSector(symbol) {
  return SECTOR_MAP[symbol?.toUpperCase()] || 'US Equity';
}
