// Black-Scholes pricing and synthetic options chain generation.

function normCdf(x) {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989423 * Math.exp((-x * x) / 2);
  const prob =
    d *
    t *
    (0.3193815 +
      t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return x > 0 ? 1 - prob : prob;
}

function normPdf(x) {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

export function blackScholesPrice(S, K, T, r, sigma, type) {
  if (T <= 0) {
    const intrinsic = type === 'call' ? Math.max(S - K, 0) : Math.max(K - S, 0);
    return intrinsic;
  }

  const sqrtT = Math.sqrt(T);
  const d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * sqrtT);
  const d2 = d1 - sigma * sqrtT;

  if (type === 'call') {
    return S * normCdf(d1) - K * Math.exp(-r * T) * normCdf(d2);
  }

  return K * Math.exp(-r * T) * normCdf(-d2) - S * normCdf(-d1);
}

function getStrikeStep(price) {
  if (price < 25) return 1;
  if (price < 100) return 2.5;
  if (price < 200) return 5;
  return 10;
}

function nextFriday(fromDate, weeksAhead) {
  const date = new Date(fromDate);
  date.setDate(date.getDate() + weeksAhead * 7);
  const day = date.getDay();
  const diff = (5 - day + 7) % 7;
  date.setDate(date.getDate() + diff);
  date.setHours(16, 0, 0, 0);
  return date;
}

function toExpiryString(date) {
  return date.toISOString().slice(0, 10);
}

function yearsToExpiry(expiryDate) {
  const ms = expiryDate.getTime() - Date.now();
  return Math.max(ms / (365.25 * 24 * 60 * 60 * 1000), 1 / 365.25);
}

export function generateOptionsChain(symbol, underlyingPrice, sigma = 0.3, r = 0.045) {
  const step = getStrikeStep(underlyingPrice);
  const atm = Math.round(underlyingPrice / step) * step;
  const strikes = [];

  for (let i = -6; i <= 6; i += 1) {
    const strike = Math.max(step, atm + i * step);
    if (!strikes.includes(strike)) strikes.push(strike);
  }

  const expirations = [
    nextFriday(Date.now(), 1),
    nextFriday(Date.now(), 2),
    nextFriday(Date.now(), 3),
    nextFriday(Date.now(), 4),
    nextFriday(Date.now(), 8),
    nextFriday(Date.now(), 12),
  ];

  const chains = expirations.map((expiryDate) => {
    const expiry = toExpiryString(expiryDate);
    const T = yearsToExpiry(expiryDate);

    const calls = strikes.map((strike) => {
      const mid = blackScholesPrice(underlyingPrice, strike, T, r, sigma, 'call');
      const spread = Math.max(0.01, mid * 0.04);
      return {
        id: `${symbol}-${expiry}-C-${strike}`,
        symbol,
        type: 'call',
        strike,
        expiry,
        mid: Number(mid.toFixed(2)),
        bid: Number(Math.max(0.01, mid - spread / 2).toFixed(2)),
        ask: Number((mid + spread / 2).toFixed(2)),
      };
    });

    const puts = strikes.map((strike) => {
      const mid = blackScholesPrice(underlyingPrice, strike, T, r, sigma, 'put');
      const spread = Math.max(0.01, mid * 0.04);
      return {
        id: `${symbol}-${expiry}-P-${strike}`,
        symbol,
        type: 'put',
        strike,
        expiry,
        mid: Number(mid.toFixed(2)),
        bid: Number(Math.max(0.01, mid - spread / 2).toFixed(2)),
        ask: Number((mid + spread / 2).toFixed(2)),
      };
    });

    return { expiry, calls, puts };
  });

  return chains;
}

export function priceOptionPosition(position, underlyingPrice, sigma = 0.3, r = 0.045) {
  const expiryDate = new Date(`${position.expiry}T16:00:00`);
  const T = yearsToExpiry(expiryDate);
  const mark = blackScholesPrice(
    underlyingPrice,
    position.strike,
    T,
    r,
    sigma,
    position.type,
  );
  const marketValue = mark * 100 * position.contracts;
  const costBasis = position.avgPremium * 100 * position.contracts;
  return {
    mark: Number(mark.toFixed(2)),
    marketValue,
    unrealizedPL: marketValue - costBasis,
  };
}

/** Greeks from Black-Scholes (per share). */
export function computeGreeks(S, K, T, sigma = 0.3, r = 0.045, type = 'call') {
  if (T <= 0 || S <= 0 || K <= 0 || sigma <= 0) {
    return { delta: 0, theta: 0, vega: 0 };
  }

  const sqrtT = Math.sqrt(T);
  const d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * sqrtT);
  const d2 = d1 - sigma * sqrtT;
  const pdf = normPdf(d1);

  const delta = type === 'call' ? normCdf(d1) : normCdf(d1) - 1;
  const thetaCall =
    (-(S * pdf * sigma) / (2 * sqrtT) - r * K * Math.exp(-r * T) * normCdf(d2)) / 365;
  const thetaPut =
    (-(S * pdf * sigma) / (2 * sqrtT) + r * K * Math.exp(-r * T) * normCdf(-d2)) / 365;
  const vega = (S * pdf * sqrtT) / 100;

  return {
    delta: Number(delta.toFixed(3)),
    theta: Number((type === 'call' ? thetaCall : thetaPut).toFixed(3)),
    vega: Number(vega.toFixed(3)),
  };
}
