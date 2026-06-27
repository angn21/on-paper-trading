/**
 * Massive.com options — Starter+ chain snapshot OR Basic (reference + EOD prev).
 * Free Options Basic: 5 API calls/min — snapshot endpoint is NOT included (403).
 * @see https://massive.com/docs/rest/options/snapshots/option-chain-snapshot
 * @see https://massive.com/docs/rest/options/contracts/all-contracts
 * @see https://massive.com/docs/rest/options/aggregates/previous-day-bar
 */

import { parseMassiveOptionsChain } from '../lib/parseMassiveOptionsChain.js';
import {
  buildChainFromReference,
  contractsForExpiry,
  listExpiriesFromContracts,
} from '../lib/buildChainFromReference.js';
import { getCachedOptionsChain, setCachedOptionsChain } from './optionsChainCache.js';
import {
  getCachedOptionContracts,
  getCachedOptionEod,
  setCachedOptionContracts,
  setCachedOptionEod,
} from './optionsEodCache.js';

const MASSIVE_API = '/api/massive';
const MIN_CALL_INTERVAL_MS = 12_500;
const MAX_PREV_BATCH = 4;

let lastCallAt = 0;
let callQueue = Promise.resolve();

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function enqueueMassiveCall(fn) {
  callQueue = callQueue.then(async () => {
    const wait = Math.max(0, MIN_CALL_INTERVAL_MS - (Date.now() - lastCallAt));
    if (wait > 0) await sleep(wait);
    lastCallAt = Date.now();
    return fn();
  });
  return callQueue;
}

async function massiveFetch(path, params = {}, { allow403 = false } = {}) {
  return enqueueMassiveCall(async () => {
    const url = new URL(MASSIVE_API, window.location.origin);
    url.searchParams.set('path', path.replace(/^\//, ''));
    Object.entries(params).forEach(([key, value]) => {
      if (value != null) url.searchParams.set(key, String(value));
    });

    const response = await fetch(url.toString());

    if (response.status === 503) throw new Error('no_api_key');
    if (response.status === 429) throw new Error('rate_limit');
    if (response.status === 403) {
      if (allow403) return { status: 'FORBIDDEN', results: [] };
      throw new Error('forbidden');
    }
    if (!response.ok) throw new Error(`http_${response.status}`);

    const data = await response.json();
    if (data?.status === 'ERROR' || data?.error) {
      throw new Error(data.error || data.message || 'massive_error');
    }

    return data;
  });
}

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

function contractListParams(underlyingPrice) {
  const today = new Date();
  const maxExpiry = new Date(today);
  maxExpiry.setDate(maxExpiry.getDate() + 84);

  const params = {
    underlying_ticker: undefined,
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

  const params = contractListParams(underlyingPrice);
  params.underlying_ticker = upper;

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

async function priceContracts(contracts) {
  const priceByTicker = {};
  const needsFetch = contracts.filter((c) => {
    const cached = getCachedOptionEod(c.ticker);
    if (cached != null) {
      priceByTicker[c.ticker] = cached;
      return false;
    }
    return true;
  });

  for (let i = 0; i < needsFetch.length; i += MAX_PREV_BATCH) {
    const batch = needsFetch.slice(i, i + MAX_PREV_BATCH);
    await Promise.all(
      batch.map(async (c) => {
        try {
          const close = await fetchPrevClose(c.ticker);
          if (close != null) priceByTicker[c.ticker] = close;
        } catch {
          // Skip contracts we couldn't price within rate limits.
        }
      }),
    );
  }

  return priceByTicker;
}

async function fetchBasicOptionsChain(symbol, underlyingPrice) {
  const upper = symbol.toUpperCase();
  const contracts = await fetchContractIndex(upper, underlyingPrice);
  const expiries = listExpiriesFromContracts(contracts, underlyingPrice);
  const firstExpiry = expiries[0];
  if (!firstExpiry) throw new Error('empty_chain');

  const toPrice = contractsForExpiry(contracts, firstExpiry, underlyingPrice);
  const priceByTicker = await priceContracts(toPrice);
  const chains = buildChainFromReference(upper, contracts, priceByTicker, underlyingPrice);

  if (!chains.length) throw new Error('empty_chain');

  return {
    chains,
    contracts,
    expiries,
    source: 'eod',
    fetchedAt: Date.now(),
  };
}

async function fetchSnapshotChain(symbol, underlyingPrice) {
  const upper = symbol.toUpperCase();
  const today = new Date();
  const maxExpiry = new Date(today);
  maxExpiry.setDate(maxExpiry.getDate() + 84);

  const params = {
    'expiration_date.gte': formatDate(today),
    'expiration_date.lte': formatDate(maxExpiry),
    limit: 250,
    sort: 'expiration_date',
    order: 'asc',
  };

  if (underlyingPrice > 0) {
    params['strike_price.gte'] = Math.max(1, Math.floor(underlyingPrice * 0.82));
    params['strike_price.lte'] = Math.ceil(underlyingPrice * 1.18);
  }

  const data = await massiveFetch(`v3/snapshot/options/${upper}`, params, { allow403: true });

  if (data.status === 'FORBIDDEN') {
    return null;
  }

  const chains = parseMassiveOptionsChain(upper, data.results || []);
  if (!chains.length) throw new Error('empty_chain');

  return {
    chains,
    contracts: null,
    expiries: chains.map((c) => c.expiry),
    source: 'live',
    fetchedAt: Date.now(),
    underlyingPrice: data.results?.[0]?.underlying_asset?.price ?? underlyingPrice,
  };
}

export async function fetchLiveOptionsChain(symbol, underlyingPrice = 0) {
  const upper = symbol.toUpperCase();
  const cached = getCachedOptionsChain(upper);
  if (cached) {
    return { ...cached, fromCache: true };
  }

  let payload = await fetchSnapshotChain(upper, underlyingPrice);

  if (!payload) {
    payload = await fetchBasicOptionsChain(upper, underlyingPrice);
  }

  setCachedOptionsChain(upper, payload);
  return payload;
}

/** Price an additional expiry on demand (Options Basic EOD path). */
export async function fetchExpiryEodPrices(symbol, expiry, underlyingPrice, contractsOverride = null) {
  const upper = symbol.toUpperCase();
  const contracts = contractsOverride || (await fetchContractIndex(upper, underlyingPrice));
  const toPrice = contractsForExpiry(contracts, expiry, underlyingPrice);
  const priceByTicker = await priceContracts(toPrice);
  return buildChainFromReference(upper, contracts, priceByTicker, underlyingPrice);
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
      return 'Could not load live option chain.';
  }
}

export function getOptionsChainSourceLabel(source) {
  if (source === 'live') {
    return 'Live option quotes via Massive (near-the-money strikes, next ~12 weeks).';
  }
  if (source === 'eod') {
    return 'Option marks from Massive Options Basic — prior session EOD close (reference + prev bar).';
  }
  return '';
}
