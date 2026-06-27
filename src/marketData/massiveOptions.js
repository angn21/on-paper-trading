/**
 * Massive.com (Polygon) options chain — server proxy, rate limit, cache.
 * Free tier: 5 API calls/minute — one chain fetch per symbol, cached 20 min.
 */

import { parseMassiveOptionsChain } from '../lib/parseMassiveOptionsChain.js';
import { getCachedOptionsChain, setCachedOptionsChain } from './optionsChainCache.js';

const MASSIVE_API = '/api/massive';
const MIN_CALL_INTERVAL_MS = 12_500;

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

async function massiveFetch(path, params = {}) {
  return enqueueMassiveCall(async () => {
    const url = new URL(MASSIVE_API, window.location.origin);
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
    if (response.status === 403) {
      throw new Error('plan_required');
    }
    if (!response.ok) {
      throw new Error(`http_${response.status}`);
    }

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

function chainQueryParams(underlyingPrice) {
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

  return params;
}

export async function fetchLiveOptionsChain(symbol, underlyingPrice = 0) {
  const upper = symbol.toUpperCase();
  const cached = getCachedOptionsChain(upper);
  if (cached) {
    return { ...cached, fromCache: true };
  }

  const path = `v3/snapshot/options/${upper}`;
  const data = await massiveFetch(path, chainQueryParams(underlyingPrice));
  const chains = parseMassiveOptionsChain(upper, data.results || []);

  if (!chains.length) {
    throw new Error('empty_chain');
  }

  const payload = {
    chains,
    source: 'live',
    fetchedAt: Date.now(),
    underlyingPrice: data.results?.[0]?.underlying_asset?.price ?? underlyingPrice,
  };

  setCachedOptionsChain(upper, payload);
  return payload;
}

export function getOptionsChainErrorMessage(error) {
  switch (error?.message) {
    case 'no_api_key':
      return 'Massive API key not configured on the server.';
    case 'plan_required':
      return 'Your Massive plan does not include options chain data (Options Starter+ required).';
    case 'rate_limit':
      return 'Massive rate limit reached — try again in a minute.';
    case 'empty_chain':
      return 'No option quotes returned for this symbol.';
    default:
      return 'Could not load live option chain.';
  }
}
