/**
 * Cache Massive options chain snapshots (20 min) to stay within free-tier rate limits.
 */

const STORAGE_KEY = 'on-paper-options-chain-v1';
const TTL = 20 * 60 * 1000;

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
    // Ignore quota errors.
  }
}

function cacheKey(symbol) {
  return symbol.toUpperCase();
}

export function getCachedOptionsChain(symbol) {
  const key = cacheKey(symbol);
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

export function setCachedOptionsChain(symbol, value) {
  const key = cacheKey(symbol);
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
