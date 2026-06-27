/**
 * Cache estimated volatility per symbol (24h) to avoid extra Twelve Data calls.
 */

const STORAGE_KEY = 'on-paper-volatility-cache-v2';
const TTL = 24 * 60 * 60 * 1000;

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
    // Ignore storage errors.
  }
}

export function getCachedVolatility(symbol) {
  const key = symbol.toUpperCase();
  const mem = memory.get(key);
  if (mem && Date.now() < mem.expiresAt) {
    return mem.value;
  }

  const store = loadStore();
  const entry = store[key];
  if (entry && Date.now() < entry.expiresAt) {
    memory.set(key, entry);
    return entry.value;
  }

  return null;
}

export function setCachedVolatility(symbol, value) {
  const key = symbol.toUpperCase();
  const entry = {
    value,
    fetchedAt: Date.now(),
    expiresAt: Date.now() + TTL,
  };
  memory.set(key, entry);

  const store = loadStore();
  store[key] = entry;
  saveStore(store);
}
