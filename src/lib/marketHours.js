/**
 * US market session helpers (America/New_York).
 * Used for dynamic API cache TTLs and quote refresh intervals.
 */

const BASE_CANDLE_TTL = {
  D: 5 * 60 * 1000,
  W: 4 * 60 * 60 * 1000,
  M: 24 * 60 * 60 * 1000,
  Y: 30 * 24 * 60 * 60 * 1000,
};

function getETComponents(date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const get = (type) => parts.find((p) => p.type === type)?.value;

  return {
    weekday: get('weekday'),
    hour: Number(get('hour')),
    minute: Number(get('minute')),
  };
}

/** @returns {{ tier: 'open'|'extended'|'closed'|'weekend', isOpen: boolean, session: string, holiday?: string }} */
export function getLocalMarketSession(now = new Date()) {
  const { weekday, hour, minute } = getETComponents(now);
  const mins = hour * 60 + minute;
  const isWeekend = weekday === 'Sat' || weekday === 'Sun';

  if (isWeekend) {
    return { tier: 'weekend', isOpen: false, session: 'closed' };
  }

  const OPEN = 9 * 60 + 30;
  const CLOSE = 16 * 60;
  const PRE = 4 * 60;
  const POST = 20 * 60;

  if (mins >= OPEN && mins < CLOSE) {
    return { tier: 'open', isOpen: true, session: 'regular' };
  }

  if ((mins >= PRE && mins < OPEN) || (mins >= CLOSE && mins < POST)) {
    return {
      tier: 'extended',
      isOpen: false,
      session: mins < OPEN ? 'pre-market' : 'post-market',
    };
  }

  return { tier: 'closed', isOpen: false, session: 'closed' };
}

/** Milliseconds until the next regular session (9:30–16:00 ET), capped at 96h. */
export function msUntilNextRegularOpen(from = new Date()) {
  const MAX = 96 * 60 * 60 * 1000;
  let t = from.getTime() + 60_000;
  const end = from.getTime() + MAX;

  while (t < end) {
    if (getLocalMarketSession(new Date(t)).tier === 'open') {
      return t - from.getTime();
    }
    t += 15 * 60_000;
  }

  return 48 * 60 * 60_000;
}

export function sessionFromFinnhub(data) {
  const local = getLocalMarketSession();

  if (local.tier === 'weekend') return local;

  if (data.holiday) {
    return {
      tier: 'weekend',
      isOpen: false,
      session: 'closed',
      holiday: data.holiday,
    };
  }

  if (data.isOpen && data.session === 'regular') {
    return { tier: 'open', isOpen: true, session: 'regular' };
  }

  if (data.session === 'pre-market' || data.session === 'post-market') {
    return { tier: 'extended', isOpen: false, session: data.session };
  }

  if (data.isOpen) {
    return { tier: 'open', isOpen: true, session: data.session || 'regular' };
  }

  return { tier: 'closed', isOpen: false, session: data.session || 'closed' };
}

export function getCandleCacheTTL(range, session = getLocalMarketSession()) {
  const base = BASE_CANDLE_TTL[range] ?? BASE_CANDLE_TTL.W;

  switch (session.tier) {
    case 'open':
      return base;
    case 'extended':
      return (
        {
          D: 30 * 60 * 1000,
          W: 8 * 60 * 60 * 1000,
          M: 2 * 24 * 60 * 60 * 1000,
          Y: BASE_CANDLE_TTL.Y,
        }[range] ?? base * 2
      );
    case 'closed':
      return (
        {
          D: 4 * 60 * 60 * 1000,
          W: 12 * 60 * 60 * 1000,
          M: 2 * 24 * 60 * 60 * 1000,
          Y: BASE_CANDLE_TTL.Y,
        }[range] ?? base * 4
      );
    case 'weekend':
      if (range === 'D' || range === 'W') {
        return msUntilNextRegularOpen() + 30 * 60_000;
      }
      return (
        {
          M: 7 * 24 * 60 * 60 * 1000,
          Y: BASE_CANDLE_TTL.Y,
        }[range] ?? msUntilNextRegularOpen()
      );
    default:
      return base;
  }
}

export function getQuoteCacheTTL(session = getLocalMarketSession()) {
  switch (session.tier) {
    case 'open':
      return 30_000;
    case 'extended':
      return 5 * 60_000;
    case 'closed':
      return 20 * 60_000;
    case 'weekend':
      return Math.max(msUntilNextRegularOpen(), 30 * 60_000);
    default:
      return 30_000;
  }
}

export function getQuoteRefreshInterval(session = getLocalMarketSession()) {
  switch (session.tier) {
    case 'open':
      return 60_000;
    case 'extended':
      return 5 * 60_000;
    case 'closed':
      return 15 * 60_000;
    case 'weekend':
      return 30 * 60_000;
    default:
      return 60_000;
  }
}

export function getMarketStatusCacheTTL(session = getLocalMarketSession()) {
  switch (session.tier) {
    case 'open':
      return 5 * 60_000;
    case 'extended':
      return 10 * 60_000;
    case 'closed':
    case 'weekend':
      return 30 * 60_000;
    default:
      return 5 * 60_000;
  }
}

export { BASE_CANDLE_TTL as CANDLE_CACHE_TTL_BASE };
