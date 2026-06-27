/**
 * Cache EOD option marks from Massive prev-bar (24h).
 */

const STORAGE_KEY = 'on-paper-options-eod-v1';
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
    // Ignore quota errors.
  }
}

export function getCachedOptionEod(ticker) {
  const key = ticker.toUpperCase();
  const mem = memory.get(key);
  if (mem && Date.now() < mem.expiresAt) return mem.value;

  const store = loadStore();
  const entry = store[key];
  if (entry && Date.now() < entry.expiresAt) {
    memory.set(key, entry);
    return entry.value;
  }

  return null;
}

export function setCachedOptionEod(ticker, value) {
  const key = ticker.toUpperCase();
  const entry = { value, expiresAt: Date.now() + TTL };
  memory.set(key, entry);
  const store = loadStore();
  store[key] = entry;
  saveStore(store);
}

const CONTRACTS_KEY = 'on-paper-options-contracts-v1';
const CONTRACTS_TTL = 24 * 60 * 60 * 1000;

export function getCachedOptionContracts(symbol) {
  const key = symbol.toUpperCase();
  try {
    const store = JSON.parse(localStorage.getItem(CONTRACTS_KEY) || '{}');
    const entry = store[key];
    if (entry && Date.now() < entry.expiresAt) return entry.value;
  } catch {
    // ignore
  }
  return null;
}

export function setCachedOptionContracts(symbol, contracts) {
  const key = symbol.toUpperCase();
  try {
    const store = JSON.parse(localStorage.getItem(CONTRACTS_KEY) || '{}');
    store[key] = { value: contracts, expiresAt: Date.now() + CONTRACTS_TTL };
    localStorage.setItem(CONTRACTS_KEY, JSON.stringify(store));
  } catch {
    // ignore
  }
}
