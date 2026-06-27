/**
 * Massive.com options via Options Basic: reference contracts + EOD prev bar.
 * Free tier: 5 API calls/min — burst up to 5, then wait for the rolling window.
 */

import {
  buildChainFromReference,
  contractsForExpiry,
  listExpiriesFromContracts,
} from '../lib/buildChainFromReference.js';
import { buildMarkSnapshot } from '../lib/optionMarks.js';
import {
  getCachedExpiryChain,
  getCachedSymbolOptions,
  setCachedExpiryChain,
} from './optionsChainCache.js';
import {
  getCachedOptionContracts,
  getCachedOptionEod,
  setCachedOptionContracts,
  setCachedOptionEod,
} from './optionsEodCache.js';

const MASSIVE_API = '/api/massive';
const RATE_WINDOW_MS = 60_000;
const MAX_CALLS_PER_WINDOW = 5;

const recentCallTimes = [];

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function acquireRateLimitSlot() {
  while (true) {
    const now = Date.now();
    while (recentCallTimes.length && recentCallTimes[0] <= now - RATE_WINDOW_MS) {
      recentCallTimes.shift();
    }

    if (recentCallTimes.length < MAX_CALLS_PER_WINDOW) {
      recentCallTimes.push(now);
      return;
    }

    const waitMs = recentCallTimes[0] + RATE_WINDOW_MS - now + 50;
    await sleep(Math.max(waitMs, 100));
  }
}

async function massiveFetch(path, params = {}) {
  await acquireRateLimitSlot();

  const url = new URL(MASSIVE_API, window.location.origin);
  url.searchParams.set('path', path.replace(/^\//, ''));
  Object.entries(params).forEach(([key, value]) => {
    if (value != null) url.searchParams.set(key, String(value));
  });

  const response = await fetch(url.toString());

  if (response.status === 503) throw new Error('no_api_key');
  if (response.status === 429) throw new Error('rate_limit');
  if (response.status === 403) throw new Error('forbidden');
  if (!response.ok) throw new Error(`http_${response.status}`);

  const data = await response.json();
  if (data?.status === 'ERROR' || data?.error) {
    throw new Error(data.error || data.message || 'massive_error');
  }

  return data;
}

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

function contractListParams(underlyingPrice) {
  const today = new Date();
  const maxExpiry = new Date(today);
  maxExpiry.setDate(maxExpiry.getDate() + 84);

  const params = {
    'expiration_date.gte': formatDate(today),
    'expiration_date.lte': formatDate(maxExpiry),
    limit: 1000,
    sort: 'expiration_date',
    order: 'asc',
    expired: false,
  };

  if (underlyingPrice > 0) {
    params['strike_price.gte'] = Math.max(1, Math.floor(underlyingPrice * 0.82));
    params['strike_price.lte'] = Math.ceil(underlyingPrice * 1.18);
  }

  return params;
}

async function fetchContractIndex(symbol, underlyingPrice) {
  const upper = symbol.toUpperCase();
  const cached = getCachedOptionContracts(upper);
  if (cached?.length) return cached;

  const params = { ...contractListParams(underlyingPrice), underlying_ticker: upper };
  const data = await massiveFetch('v3/reference/options/contracts', params);
  const contracts = data.results || [];
  if (!contracts.length) throw new Error('empty_chain');

  setCachedOptionContracts(upper, contracts);
  return contracts;
}

async function fetchPrevClose(optionTicker) {
  const cached = getCachedOptionEod(optionTicker);
  if (cached != null) return cached;

  const encoded = encodeURIComponent(optionTicker);
  const data = await massiveFetch(`v2/aggs/ticker/${encoded}/prev`);
  const bar = data.results?.[0];
  const close = bar?.c ?? bar?.vw ?? null;
  if (close == null || close <= 0) return null;

  setCachedOptionEod(optionTicker, close);
  return close;
}

async function priceContracts(contracts, onProgress) {
  const priceByTicker = {};
  const needsFetch = contracts.filter((c) => {
    const cached = getCachedOptionEod(c.ticker);
    if (cached != null) {
      priceByTicker[c.ticker] = cached;
      return false;
    }
    return true;
  });

  if (onProgress && Object.keys(priceByTicker).length) {
    onProgress({ ...priceByTicker });
  }

  await Promise.all(
    needsFetch.map(async (c) => {
      try {
        const close = await fetchPrevClose(c.ticker);
        if (close != null) {
          priceByTicker[c.ticker] = close;
          onProgress?.({ ...priceByTicker });
        }
      } catch {
        // Skip contracts we couldn't price within rate limits.
      }
    }),
  );

  return priceByTicker;
}

/** One API call — contract index + expiry list only (no pricing). */
export async function fetchOptionExpiries(symbol, underlyingPrice = 0) {
  const upper = symbol.toUpperCase();
  const contracts = await fetchContractIndex(upper, underlyingPrice);
  const expiries = listExpiriesFromContracts(contracts, underlyingPrice);
  if (!expiries.length) throw new Error('empty_chain');

  const cached = getCachedSymbolOptions(upper);
  const chains = cached?.chainsByExpiry
    ? Object.values(cached.chainsByExpiry).sort((a, b) => a.expiry.localeCompare(b.expiry))
    : [];

  return {
    contracts,
    expiries,
    chains,
    source: 'eod',
    fromCache: Boolean(cached?.expiries?.length),
  };
}

/** Price a single expiry on user request (~8 prev-bar calls). */
export async function fetchExpiryEodPrices(
  symbol,
  expiry,
  underlyingPrice,
  contractsOverride = null,
  onProgress,
) {
  const upper = symbol.toUpperCase();

  const cachedChain = getCachedExpiryChain(upper, expiry);
  if (cachedChain) {
    return [cachedChain];
  }

  const contracts = contractsOverride || (await fetchContractIndex(upper, underlyingPrice));
  const toPrice = contractsForExpiry(contracts, expiry, underlyingPrice);

  const priceByTicker = await priceContracts(toPrice, (partial) => {
    const partialChains = buildChainFromReference(upper, contracts, partial, underlyingPrice);
    const chain = partialChains.find((item) => item.expiry === expiry);
    if (chain) onProgress?.(chain);
  });

  const chains = buildChainFromReference(upper, contracts, priceByTicker, underlyingPrice);
  const chain = chains.find((item) => item.expiry === expiry);
  if (!chain) throw new Error('empty_chain');

  const expiries = listExpiriesFromContracts(contracts, underlyingPrice);
  setCachedExpiryChain(upper, expiry, chain, expiries);

  return [chain];
}

export function getOptionsChainErrorMessage(error) {
  switch (error?.message) {
    case 'no_api_key':
      return 'Massive API key not configured on the server.';
    case 'rate_limit':
      return 'Massive rate limit reached — try again in a minute.';
    case 'empty_chain':
      return 'No option quotes returned for this symbol.';
    case 'forbidden':
      return 'Massive rejected the request — check that your key has Options access enabled.';
    default:
      return 'Could not load option chain.';
  }
}

export function getOptionsChainSourceLabel(pricing = false) {
  if (pricing) {
    return 'Loading EOD option marks from Massive (5 API calls/min on free tier).';
  }
  return 'Select an expiry — EOD marks load on demand (Massive Options Basic).';
}

const MARKS_REFRESH_MS = 20 * 60 * 60 * 1000;

/** Re-anchor open positions to latest EOD prev close (~1 API call per held contract). */
export async function refreshOpenOptionMarks(positions, resolveContext) {
  const eligible = positions.filter((p) => p.optionTicker);
  if (!eligible.length) return positions;

  const byId = new Map(positions.map((p) => [p.id, { ...p }]));

  await Promise.all(
    eligible.map(async (position) => {
      const snap = position.markSnapshot;
      if (snap && Date.now() - snap.t < MARKS_REFRESH_MS) return;

      try {
        const close = await fetchPrevClose(position.optionTicker);
        if (close == null) return;

        const { underlying, sigma } = resolveContext(position);
        const markSnapshot = buildMarkSnapshot({
          mid: close,
          underlyingPrice: underlying,
          strike: position.strike,
          expiry: position.expiry,
          type: position.type,
          sigma,
        });

        byId.set(position.id, { ...position, markSnapshot });
      } catch {
        // Keep existing snapshot on failure.
      }
    }),
  );

  return positions.map((p) => byId.get(p.id) || p);
}
