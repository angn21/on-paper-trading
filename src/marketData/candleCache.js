/**
 * Persistent candle cache — survives page reloads.
 * TTL is dynamic based on US market session (see marketHours.js).
 */

import { getCandleCacheTTL, getLocalMarketSession } from '../lib/marketHours.js';

const STORAGE_KEY = 'on-paper-candle-cache-v1';

const memory = new Map();

function loadStore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveStore(store) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    const keys = Object.keys(store).sort((a, b) => store[a].fetchedAt - store[b].fetchedAt);
    keys.slice(0, Math.ceil(keys.length / 2)).forEach((key) => delete store[key]);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    } catch {
      // Ignore if still failing.
    }
  }
}

function cacheKey(symbol, range) {
  return `${symbol.toUpperCase()}:${range}`;
}

export function getCachedCandles(symbol, range, session = getLocalMarketSession()) {
  const key = cacheKey(symbol, range);

  const mem = memory.get(key);
  if (mem && Date.now() < mem.expiresAt) {
    return { ...mem.value, _cached: true };
  }

  const store = loadStore();
  const entry = store[key];
  if (entry && Date.now() < entry.expiresAt) {
    memory.set(key, entry);
    return { ...entry.value, _cached: true };
  }

  return null;
}

export function setCachedCandles(symbol, range, value, session = getLocalMarketSession()) {
  const key = cacheKey(symbol, range);
  const ttl = getCandleCacheTTL(range, session);
  const entry = {
    value,
    fetchedAt: Date.now(),
    expiresAt: Date.now() + ttl,
  };

  memory.set(key, entry);

  const store = loadStore();
  store[key] = entry;
  saveStore(store);
}

/** Clear expired entries from localStorage (housekeeping). */
export function pruneCandleCache() {
  const store = loadStore();
  const now = Date.now();
  let changed = false;
  Object.keys(store).forEach((key) => {
    if (store[key].expiresAt < now) {
      delete store[key];
      changed = true;
    }
  });
  if (changed) saveStore(store);
}
