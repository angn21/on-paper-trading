/**
 * Build options chain groups from Massive reference contracts + optional EOD prices.
 */

function pickNearMoneyContracts(contracts, underlyingPrice, maxStrikes = 4) {
  const byExpiry = new Map();

  contracts.forEach((c) => {
    if (!c.expiration_date || c.strike_price == null) return;
    const type = c.contract_type === 'put' ? 'put' : 'call';
    if (!byExpiry.has(c.expiration_date)) {
      byExpiry.set(c.expiration_date, { calls: [], puts: [] });
    }
    byExpiry.get(c.expiration_date)[type === 'call' ? 'calls' : 'puts'].push(c);
  });

  const chains = [...byExpiry.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(0, 8)
    .map(([expiry, bucket]) => {
      const pickSide = (rows) => {
        const sorted = [...rows].sort(
          (a, b) =>
            Math.abs(a.strike_price - underlyingPrice) - Math.abs(b.strike_price - underlyingPrice),
        );
        const seen = new Set();
        const picked = [];
        sorted.forEach((row) => {
          if (picked.length >= maxStrikes) return;
          const key = row.strike_price;
          if (seen.has(key)) return;
          seen.add(key);
          picked.push(row);
        });
        return picked.sort((a, b) => a.strike_price - b.strike_price);
      };

      return {
        expiry,
        calls: pickSide(bucket.calls),
        puts: pickSide(bucket.puts),
      };
    })
    .filter((item) => item.calls.length || item.puts.length);

  return chains;
}

function contractRow(symbol, contract, priceByTicker) {
  const upper = symbol.toUpperCase();
  const type = contract.contract_type === 'put' ? 'put' : 'call';
  const strike = Number(contract.strike_price);
  const expiry = contract.expiration_date;
  const mid = priceByTicker[contract.ticker];

  if (mid == null || mid <= 0) return null;

  return {
    id: `${upper}-${expiry}-${type === 'call' ? 'C' : 'P'}-${strike}`,
    symbol: upper,
    type,
    strike,
    expiry,
    mid: Number(mid.toFixed(2)),
    bid: Number(mid.toFixed(2)),
    ask: Number(mid.toFixed(2)),
    openInterest: null,
    iv: null,
    greeks: null,
    optionTicker: contract.ticker,
  };
}

export function buildChainFromReference(symbol, contracts, priceByTicker, underlyingPrice) {
  const skeleton = pickNearMoneyContracts(contracts, underlyingPrice || 100);

  return skeleton
    .map(({ expiry, calls, puts }) => ({
      expiry,
      calls: calls.map((c) => contractRow(symbol, c, priceByTicker)).filter(Boolean),
      puts: puts.map((c) => contractRow(symbol, c, priceByTicker)).filter(Boolean),
    }))
    .filter((item) => item.calls.length || item.puts.length);
}

/** Flat list of reference contracts for one expiry (for batched EOD pricing). */
export function contractsForExpiry(contracts, expiry, underlyingPrice, maxStrikes = 4) {
  const skeleton = pickNearMoneyContracts(contracts, underlyingPrice, maxStrikes);
  const bucket = skeleton.find((item) => item.expiry === expiry);
  if (!bucket) return [];
  return [...bucket.calls, ...bucket.puts];
}

export function listExpiriesFromContracts(contracts, underlyingPrice) {
  return pickNearMoneyContracts(contracts, underlyingPrice || 100).map((item) => item.expiry);
}
