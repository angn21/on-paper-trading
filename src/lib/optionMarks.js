import { computeGreeks, priceOptionPosition } from './blackScholes';

function yearsToExpiry(expiryDate) {
  const ms = expiryDate.getTime() - Date.now();
  return Math.max(ms / (365.25 * 24 * 60 * 60 * 1000), 1 / 365.25);
}

export function sanitizeMarkSnapshot(raw) {
  if (!raw || typeof raw !== 'object') return null;

  const M = Number(raw.M);
  const S = Number(raw.S);
  const sigma = Number(raw.sigma);
  const t = Number(raw.t);
  const delta = Number(raw.delta);
  const theta = Number(raw.theta);

  if (!(M >= 0 && S > 0 && sigma > 0 && t > 0)) return null;

  return {
    M,
    S,
    sigma,
    t,
    delta: Number.isFinite(delta) ? delta : 0,
    theta: Number.isFinite(theta) ? theta : 0,
  };
}

export function buildMarkSnapshot({ mid, underlyingPrice, strike, expiry, type, sigma }) {
  const expiryDate = new Date(`${expiry}T16:00:00`);
  const T = yearsToExpiry(expiryDate);
  const greeks = computeGreeks(underlyingPrice, strike, T, sigma, 0.045, type);

  return {
    M: Number(mid),
    S: underlyingPrice,
    sigma,
    t: Date.now(),
    delta: greeks.delta,
    theta: greeks.theta,
  };
}

export function markOpenOption(position, underlyingPrice, sigma) {
  const expiryDate = new Date(`${position.expiry}T16:00:00`);
  const T = yearsToExpiry(expiryDate);
  const costBasis = position.avgPremium * 100 * position.contracts;

  if (T <= 0) {
    const intrinsic =
      position.type === 'call'
        ? Math.max(underlyingPrice - position.strike, 0)
        : Math.max(position.strike - underlyingPrice, 0);
    const mark = Number(intrinsic.toFixed(2));
    const marketValue = mark * 100 * position.contracts;
    return {
      mark,
      marketValue,
      unrealizedPL: marketValue - costBasis,
      markSource: position.markSnapshot ? 'eod' : 'model',
    };
  }

  const snap = position.markSnapshot;
  if (!snap) {
    const pricing = priceOptionPosition(position, underlyingPrice, sigma);
    return { ...pricing, markSource: 'model' };
  }

  const days = (Date.now() - snap.t) / (24 * 60 * 60 * 1000);
  const mark = Math.max(0, snap.M + snap.delta * (underlyingPrice - snap.S) + snap.theta * days);
  const markRounded = Number(mark.toFixed(2));
  const marketValue = markRounded * 100 * position.contracts;

  return {
    mark: markRounded,
    marketValue,
    unrealizedPL: marketValue - costBasis,
    markSource: 'eod',
  };
}
