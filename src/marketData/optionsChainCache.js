/**
 * Cache priced option expiries per symbol (20 min).
 */

const STORAGE_KEY = 'on-paper-options-chain-v2';
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

function symbolKey(symbol) {
  return symbol.toUpperCase();
}

function readEntry(symbol) {
  const key = symbolKey(symbol);
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

function writeEntry(symbol, value) {
  const key = symbolKey(symbol);
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

/** @returns {{ expiries: string[], chainsByExpiry: Record<string, object> } | null} */
export function getCachedSymbolOptions(symbol) {
  return readEntry(symbol);
}

export function getCachedExpiryChain(symbol, expiry) {
  const cached = readEntry(symbol);
  return cached?.chainsByExpiry?.[expiry] ?? null;
}

export function setCachedExpiryChain(symbol, expiry, chain, expiries = null) {
  const existing = readEntry(symbol) || { expiries: [], chainsByExpiry: {} };
  const next = {
    expiries: expiries?.length ? expiries : existing.expiries,
    chainsByExpiry: { ...existing.chainsByExpiry, [expiry]: chain },
  };
  writeEntry(symbol, next);
}
