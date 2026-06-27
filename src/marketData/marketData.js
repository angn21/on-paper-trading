/**
 * Provider-agnostic market data layer.
 * Live data goes through /api/finnhub (server-side proxy) so the Finnhub key
 * never ships to the browser. Swap providers by editing the live adapter below.
 */

const API_BASE = '/api/finnhub';

const CACHE_TTL = {
  quote: 30_000,
  candles: 300_000,
  search: 120_000,
  marketStatus: 300_000,
};

const cache = new Map();
let mode = 'live';
let liveFailureReason = null;

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
  cache.set(key, { value, expiresAt: Date.now() + ttl });
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

function rangeConfig(range) {
  const now = Math.floor(Date.now() / 1000);
  switch (range) {
    case 'D':
      return { resolution: '5', from: now - 5 * 24 * 3600, to: now };
    case 'W':
      return { resolution: 'D', from: now - 90 * 24 * 3600, to: now };
    case 'M':
      return { resolution: 'D', from: now - 365 * 24 * 3600, to: now };
    case 'Y':
    default:
      return { resolution: 'W', from: now - 5 * 365 * 24 * 3600, to: now };
  }
}

function simulatedCandles(symbol, range) {
  const { resolution, from, to } = rangeConfig(range);
  const step =
    resolution === '5'
      ? 5 * 60
      : resolution === 'D'
        ? 24 * 3600
        : 7 * 24 * 3600;

  const quote = simulatedQuote(symbol);
  const points = Math.min(300, Math.floor((to - from) / step));
  const t = [];
  const o = [];
  const h = [];
  const l = [];
  const c = [];

  let price = quote.pc;
  for (let i = 0; i < points; i += 1) {
    const ts = from + i * step;
    const wobble = Math.sin(i / 7 + hashString(symbol) * 0.01) * 0.012;
    const open = price;
    const close = price * (1 + wobble);
    const high = Math.max(open, close) * 1.004;
    const low = Math.min(open, close) * 0.996;
    t.push(ts);
    o.push(Number(open.toFixed(2)));
    h.push(Number(high.toFixed(2)));
    l.push(Number(low.toFixed(2)));
    c.push(Number(close.toFixed(2)));
    price = close;
  }

  if (c.length) c[c.length - 1] = quote.c;

  return { s: 'ok', t, o, h, l, c };
}

async function finnhubFetch(path, params = {}) {
  const url = new URL(API_BASE, window.location.origin);
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

  setCache(cacheKey, data, CACHE_TTL.quote);
  return data;
}

async function liveCandles(symbol, range) {
  const upper = symbol.toUpperCase();
  const { resolution, from, to } = rangeConfig(range);
  const cacheKey = `candles:${upper}:${range}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const data = await finnhubFetch('/stock/candle', {
    symbol: upper,
    resolution,
    from,
    to,
  });

  if (data.s !== 'ok' || !data.t?.length) {
    throw new Error('no_candles');
  }

  setCache(cacheKey, data, CACHE_TTL.candles);
  return data;
}

async function liveMarketStatus() {
  const cacheKey = 'market-status:US';
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const data = await finnhubFetch('/stock/market-status', { exchange: 'US' });
  const result = {
    isOpen: Boolean(data.isOpen),
    session: data.session || (data.isOpen ? 'open' : 'closed'),
    note: data.isOpen
      ? 'US market is open.'
      : 'US market is closed. Paper trading is available anytime in this simulator.',
  };

  setCache(cacheKey, result, CACHE_TTL.marketStatus);
  return result;
}

function fallbackMarketStatus() {
  const now = new Date();
  const day = now.getUTCDay();
  const hour = now.getUTCHours() - 5;
  const isWeekday = day >= 1 && day <= 5;
  const isOpen = isWeekday && hour >= 9 && hour < 16;

  return {
    isOpen,
    session: isOpen ? 'open' : 'closed',
    note: isOpen
      ? 'US market appears open (estimated).'
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
      return stale;
    }
    switchToSimulated(error.message);
    return simFn();
  }
}

/** Check whether the server proxy has a Finnhub key configured. */
export async function checkMarketDataHealth() {
  try {
    const response = await fetch('/api/health');
    const contentType = response.headers.get('content-type') || '';
    if (!response.ok || !contentType.includes('application/json')) {
      return 'missing';
    }
    const data = await response.json();
    return data.marketData === 'configured' ? 'configured' : 'missing';
  } catch {
    return 'missing';
  }
}

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
    const cacheKey = `candles:${upper}:${range}`;

    return withFallback(
      () => liveCandles(upper, range),
      () => simulatedCandles(upper, range),
      cacheKey,
    );
  },

  async getMarketStatus() {
    const cacheKey = 'market-status:US';

    return withFallback(
      () => liveMarketStatus(),
      () => fallbackMarketStatus(),
      cacheKey,
    );
  },
};
