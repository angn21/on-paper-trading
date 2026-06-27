/**
 * Provider-agnostic market data layer.
 * - Quotes/search/status: Finnhub via /api/finnhub
 * - Charts (candles): Twelve Data via /api/twelvedata (1 credit per symbol per fetch)
 * Keys stay server-side. Candles are cached in localStorage to save API credits.
 */

import { getCachedCandles, pruneCandleCache, setCachedCandles } from './candleCache.js';
import { getCachedVolatility, setCachedVolatility } from './volatilityCache.js';
import { DEFAULT_SIGMA, realizedVolatility } from '../lib/volatility.js';
import {
  getLocalMarketSession,
  getMarketStatusCacheTTL,
  getQuoteCacheTTL,
  getQuoteRefreshInterval,
  sessionFromFinnhub,
} from '../lib/marketHours.js';

const FINNHUB_API = '/api/finnhub';
const TWELVE_DATA_API = '/api/twelvedata';

const CACHE_TTL = {
  search: 120_000,
};

const cache = new Map();
let mode = 'live';
let liveFailureReason = null;

/** Finnhub session override (holidays, extended hours). Falls back to local ET clock. */
let holidayOverride = null;
let finnhubSession = null;
let finnhubSessionAt = 0;

function getActiveSession() {
  const local = getLocalMarketSession();

  if (local.tier === 'weekend') {
    holidayOverride = null;
    return local;
  }

  if (holidayOverride) {
    return {
      tier: 'weekend',
      isOpen: false,
      session: 'closed',
      holiday: holidayOverride,
    };
  }

  if (finnhubSession && Date.now() - finnhubSessionAt < 30 * 60_000) {
    return finnhubSession;
  }

  return local;
}

const SIMULATED_SYMBOLS = [
  { symbol: 'AAPL', description: 'Apple Inc' },
  { symbol: 'MSFT', description: 'Microsoft Corp' },
  { symbol: 'GOOGL', description: 'Alphabet Inc' },
  { symbol: 'AMZN', description: 'Amazon.com Inc' },
  { symbol: 'TSLA', description: 'Tesla Inc' },
  { symbol: 'NVDA', description: 'NVIDIA Corp' },
  { symbol: 'META', description: 'Meta Platforms Inc' },
  { symbol: 'SPY', description: 'SPDR S&P 500 ETF' },
];

/** Twelve Data time_series config per chart range (1 credit each). */
const TWELVE_DATA_RANGE = {
  D: { interval: '5min', outputsize: 100 },
  W: { interval: '1day', outputsize: 90 },
  M: { interval: '1day', outputsize: 365 },
  Y: { interval: '1week', outputsize: 260 },
};

function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function getCached(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}

function setCache(key, value, ttl) {
  cache.set(key, { value, expiresAt: Date.now() + ttl, fetchedAt: Date.now() });
}

function getStale(key) {
  return cache.get(key)?.value ?? null;
}

function switchToSimulated(reason) {
  mode = 'simulated';
  liveFailureReason = reason;
}

function seededBasePrice(symbol) {
  const seed = hashString(symbol.toUpperCase());
  return 20 + (seed % 480) + (seed % 100) / 100;
}

function simulatedQuote(symbol) {
  const upper = symbol.toUpperCase();
  const base = seededBasePrice(upper);
  const daySeed = Math.floor(Date.now() / 86_400_000);
  const drift = Math.sin(daySeed + hashString(upper)) * 0.018;
  const current = base * (1 + drift);
  const previousClose = base * (1 + drift * 0.6);
  const change = current - previousClose;
  const changePct = (change / previousClose) * 100;

  return {
    c: Number(current.toFixed(2)),
    d: Number(change.toFixed(2)),
    dp: Number(changePct.toFixed(2)),
    h: Number((current * 1.012).toFixed(2)),
    l: Number((current * 0.988).toFixed(2)),
    o: Number((previousClose * 1.002).toFixed(2)),
    pc: Number(previousClose.toFixed(2)),
    t: Math.floor(Date.now() / 1000),
    _simulated: true,
  };
}

function simulatedSearch(query) {
  const q = query.trim().toLowerCase();
  if (!q) return SIMULATED_SYMBOLS;
  return SIMULATED_SYMBOLS.filter(
    (item) =>
      item.symbol.toLowerCase().includes(q) ||
      item.description.toLowerCase().includes(q),
  );
}

function parseTwelveDataDatetime(datetime) {
  const normalized = datetime.includes(' ')
    ? datetime.replace(' ', 'T')
    : `${datetime}T00:00:00`;
  return Math.floor(new Date(`${normalized}-05:00`).getTime() / 1000);
}

function parseTwelveDataCandles(data) {
  if (data.status !== 'ok' || !data.values?.length) {
    throw new Error('no_candles');
  }

  const values = [...data.values].reverse();
  const t = [];
  const o = [];
  const h = [];
  const l = [];
  const c = [];

  values.forEach((bar) => {
    t.push(parseTwelveDataDatetime(bar.datetime));
    o.push(Number(bar.open));
    h.push(Number(bar.high));
    l.push(Number(bar.low));
    c.push(Number(bar.close));
  });

  return { s: 'ok', t, o, h, l, c, _source: 'live' };
}

function downsampleCandles(candles, maxPoints = 120) {
  if (!candles?.t?.length || candles.t.length <= maxPoints) return candles;

  const step = Math.ceil(candles.t.length / maxPoints);
  const t = [];
  const o = [];
  const h = [];
  const l = [];
  const c = [];

  for (let i = 0; i < candles.t.length; i += step) {
    t.push(candles.t[i]);
    o.push(candles.o[i]);
    h.push(candles.h[i]);
    l.push(candles.l[i]);
    c.push(candles.c[i]);
  }

  const last = candles.t.length - 1;
  if (t[t.length - 1] !== candles.t[last]) {
    t.push(candles.t[last]);
    o.push(candles.o[last]);
    h.push(candles.h[last]);
    l.push(candles.l[last]);
    c.push(candles.c[last]);
  }

  return { ...candles, t, o, h, l, c };
}

/** Fallback chart anchored to live quote when Twelve Data is unavailable. */
async function approximateCandles(symbol, range) {
  let quote;
  try {
    quote = await liveQuote(symbol);
  } catch {
    quote = simulatedQuote(symbol);
  }

  const pointCount = { D: 48, W: 60, M: 90, Y: 100 }[range] || 60;
  const now = Math.floor(Date.now() / 1000);
  const windows = { D: 2 * 24 * 3600, W: 90 * 24 * 3600, M: 365 * 24 * 3600, Y: 5 * 365 * 24 * 3600 };
  const from = now - (windows[range] || windows.W);
  const step = (now - from) / Math.max(pointCount - 1, 1);
  const seed = hashString(symbol);
  const start = quote.pc || quote.c;
  const end = quote.c || quote.pc;

  const t = [];
  const o = [];
  const h = [];
  const l = [];
  const c = [];

  for (let i = 0; i < pointCount; i += 1) {
    const progress = i / Math.max(pointCount - 1, 1);
    const noise = (Math.sin(i * 0.7 + seed) + Math.cos(i * 0.3 + seed)) * 0.004;
    const price = start + (end - start) * progress + start * noise;
    const open = i === 0 ? start : c[i - 1];
    const close = i === pointCount - 1 ? end : price;
    const high = Math.max(open, close) * 1.002;
    const low = Math.min(open, close) * 0.998;

    t.push(Math.floor(from + i * step));
    o.push(Number(open.toFixed(2)));
    h.push(Number(high.toFixed(2)));
    l.push(Number(low.toFixed(2)));
    c.push(Number(close.toFixed(2)));
  }

  return { s: 'ok', t, o, h, l, c, _source: 'approximate' };
}

async function finnhubFetch(path, params = {}) {
  const url = new URL(FINNHUB_API, window.location.origin);
  url.searchParams.set('path', path.replace(/^\//, ''));
  Object.entries(params).forEach(([key, value]) => {
    if (value != null) url.searchParams.set(key, String(value));
  });

  const response = await fetch(url.toString());

  if (response.status === 503) {
    throw new Error('no_api_key');
  }
  if (response.status === 429) {
    throw new Error('rate_limit');
  }
  if (!response.ok) {
    throw new Error(`http_${response.status}`);
  }

  const data = await response.json();
  if (data?.error) {
    throw new Error(data.error);
  }

  return data;
}

async function twelveDataFetch(params = {}) {
  const url = new URL(TWELVE_DATA_API, window.location.origin);
  Object.entries(params).forEach(([key, value]) => {
    if (value != null) url.searchParams.set(key, String(value));
  });

  const response = await fetch(url.toString());

  if (response.status === 503) {
    throw new Error('no_twelve_data_key');
  }
  if (response.status === 429) {
    throw new Error('rate_limit');
  }
  if (!response.ok) {
    throw new Error(`http_${response.status}`);
  }

  const data = await response.json();
  if (data?.status === 'error' || data?.code) {
    throw new Error(data.message || 'twelve_data_error');
  }

  return data;
}

async function liveSearch(query) {
  const cacheKey = `search:${query.toLowerCase()}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const data = await finnhubFetch('/search', { q: query });
  const results = (data.result || [])
    .filter((item) => item.type === 'Common Stock' && item.symbol && !item.symbol.includes('.'))
    .slice(0, 20)
    .map((item) => ({
      symbol: item.symbol,
      description: item.description || item.symbol,
    }));

  setCache(cacheKey, results, CACHE_TTL.search);
  return results;
}

async function liveQuote(symbol) {
  const upper = symbol.toUpperCase();
  const cacheKey = `quote:${upper}`;
  const session = getActiveSession();
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const data = await finnhubFetch('/quote', { symbol: upper });
  const price = data.c || data.pc;
  if (!price) {
    throw new Error('invalid_quote');
  }
  if (!data.c && data.pc) {
    data.c = data.pc;
  }

  setCache(cacheKey, data, getQuoteCacheTTL(session));
  return { ...data, _simulated: false };
}

async function twelveDataCandles(symbol, range) {
  const upper = symbol.toUpperCase();
  const config = TWELVE_DATA_RANGE[range] || TWELVE_DATA_RANGE.W;
  const session = getActiveSession();

  const cached = getCachedCandles(upper, range, session);
  if (cached?.c?.length) {
    try {
      const quote = await liveQuote(upper);
      const lastClose = cached.c[cached.c.length - 1];
      const drift = quote?.c && lastClose ? Math.abs(quote.c - lastClose) / quote.c : 0;
      if (drift <= 0.02) return cached;
    } catch {
      return cached;
    }
  }

  const data = await twelveDataFetch({
    symbol: upper,
    interval: config.interval,
    outputsize: config.outputsize,
    order: 'ASC',
  });

  const parsed = downsampleCandles(parseTwelveDataCandles(data));
  setCachedCandles(upper, range, parsed, session);
  return parsed;
}

async function estimateVolatility(symbol) {
  const upper = symbol.toUpperCase();
  const cached = getCachedVolatility(upper);
  if (cached != null) return { sigma: cached, reliable: true };

  for (const range of ['M', 'W']) {
    let candles = getCachedCandles(upper, range);
    if (!candles?.c || candles.c.length < 10) {
      try {
        candles = await twelveDataCandles(upper, range);
      } catch {
        candles = null;
      }
    }

    if (candles?.c?.length >= 10) {
      const sigma = realizedVolatility(candles.c.length > 30 ? candles.c.slice(-30) : candles.c);
      if (sigma != null) {
        setCachedVolatility(upper, sigma);
        return { sigma, reliable: true };
      }
    }
  }

  try {
    const data = await twelveDataFetch({
      symbol: upper,
      interval: '1day',
      outputsize: 30,
      order: 'ASC',
    });

    if (data.status === 'ok' && data.values?.length >= 10) {
      const closes = [...data.values].reverse().map((bar) => Number(bar.close));
      const sigma = realizedVolatility(closes);
      if (sigma != null) {
        setCachedVolatility(upper, sigma);
        return { sigma, reliable: true };
      }
    }
  } catch {
    // Fall back to default below.
  }

  return { sigma: DEFAULT_SIGMA, reliable: false };
}

async function liveMarketStatus() {
  const cacheKey = 'market-status:US';
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const data = await finnhubFetch('/stock/market-status', { exchange: 'US' });
  holidayOverride = data.holiday || null;
  finnhubSession = sessionFromFinnhub(data);
  finnhubSessionAt = Date.now();

  const result = {
    isOpen: finnhubSession.isOpen,
    session: finnhubSession.session,
    tier: finnhubSession.tier,
    note: finnhubSession.isOpen
      ? 'US market is open.'
      : finnhubSession.tier === 'weekend' && finnhubSession.holiday
        ? `US market closed (${finnhubSession.holiday}). Paper trading is available anytime.`
        : finnhubSession.tier === 'weekend'
          ? 'Weekend — US market is closed. Paper trading is available anytime.'
          : finnhubSession.tier === 'extended'
            ? `Extended hours (${finnhubSession.session}). Quotes update less frequently.`
            : 'US market is closed. Paper trading is available anytime in this simulator.',
  };

  setCache(cacheKey, result, getMarketStatusCacheTTL(finnhubSession));
  return result;
}

function fallbackMarketStatus() {
  const session = getLocalMarketSession();
  finnhubSession = session;
  finnhubSessionAt = Date.now();

  return {
    isOpen: session.isOpen,
    session: session.session,
    tier: session.tier,
    note: session.isOpen
      ? 'US market appears open (estimated).'
      : session.tier === 'weekend'
        ? 'Weekend — US market is closed. Paper trading is available anytime.'
        : session.tier === 'extended'
          ? `Extended hours (${session.session}, estimated). Quotes update less frequently.`
          : 'US market is closed. Paper trading is available anytime in this simulator.',
  };
}

async function withFallback(liveFn, simFn, cacheKey) {
  try {
    const result = await liveFn();
    if (mode !== 'live') {
      mode = 'live';
      liveFailureReason = null;
    }
    return result;
  } catch (error) {
    const stale = getStale(cacheKey);
    if (stale) {
      switchToSimulated(error.message);
      return { ...stale, _simulated: true };
    }
    switchToSimulated(error.message);
    return simFn();
  }
}

/** Check whether the server proxy has API keys configured. */
export async function checkMarketDataHealth() {
  try {
    const response = await fetch('/api/health');
    const contentType = response.headers.get('content-type') || '';
    if (!response.ok || !contentType.includes('application/json')) {
      return { status: 'missing' };
    }
    const data = await response.json();
    return {
      status: data.marketData === 'configured' ? 'configured' : 'missing',
      finnhub: Boolean(data.finnhub),
      twelvedata: Boolean(data.twelvedata),
    };
  } catch {
    return { status: 'missing', finnhub: false, twelvedata: false };
  }
}

pruneCandleCache();

export const marketData = {
  getMode() {
    return mode;
  },

  getFailureReason() {
    return liveFailureReason;
  },

  async searchSymbols(query) {
    if (!query?.trim()) return [];
    const cacheKey = `search:${query.toLowerCase()}`;

    return withFallback(
      () => liveSearch(query),
      () => simulatedSearch(query),
      cacheKey,
    );
  },

  async getQuote(symbol) {
    const upper = symbol.toUpperCase();
    const cacheKey = `quote:${upper}`;

    return withFallback(
      () => liveQuote(upper),
      () => simulatedQuote(upper),
      cacheKey,
    );
  },

  async getCandles(symbol, range = 'D') {
    const upper = symbol.toUpperCase();

    try {
      return await twelveDataCandles(upper, range);
    } catch {
      const stale = getCachedCandles(upper, range);
      if (stale) return stale;
      return approximateCandles(upper, range);
    }
  },

  /** 30-day realized volatility from daily closes (cached 24h). */
  async getVolatility(symbol) {
    try {
      return await estimateVolatility(symbol.toUpperCase());
    } catch {
      return { sigma: DEFAULT_SIGMA, reliable: false };
    }
  },

  async getNews(symbol, limit = 5) {
    const upper = symbol.toUpperCase();
    const cacheKey = `news:${upper}`;
    const cached = getCached(cacheKey);
    if (cached) return cached;

    try {
      const to = new Date().toISOString().slice(0, 10);
      const from = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
      const data = await finnhubFetch('/company-news', { symbol: upper, from, to });
      const items = (Array.isArray(data) ? data : [])
        .slice(0, limit)
        .map((item) => ({
          headline: item.headline,
          source: item.source,
          datetime: item.datetime,
          url: item.url,
        }));
      setCache(cacheKey, items, CACHE_TTL.search);
      return items;
    } catch {
      return [];
    }
  },

  async getMarketStatus() {
    const cacheKey = 'market-status:US';

    return withFallback(
      () => liveMarketStatus(),
      () => fallbackMarketStatus(),
      cacheKey,
    );
  },

  getMarketSession() {
    return getActiveSession();
  },

  getQuoteRefreshInterval() {
    return getQuoteRefreshInterval(getActiveSession());
  },

  invalidateQuotes(symbols = []) {
    symbols.forEach((symbol) => {
      cache.delete(`quote:${String(symbol).toUpperCase()}`);
    });
  },
};
