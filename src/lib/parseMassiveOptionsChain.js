/**
 * Normalize Massive / Polygon option chain snapshot rows into app contract shape.
 */

function contractMid(row) {
  const quote = row.last_quote;
  if (quote?.midpoint != null && quote.midpoint > 0) {
    return Number(quote.midpoint);
  }
  if (quote?.bid != null && quote?.ask != null && quote.bid >= 0 && quote.ask > 0) {
    return (quote.bid + quote.ask) / 2;
  }
  if (row.day?.close != null && row.day.close > 0) {
    return Number(row.day.close);
  }
  if (row.last_trade?.price != null && row.last_trade.price > 0) {
    return Number(row.last_trade.price);
  }
  return null;
}

export function parseMassiveOptionsChain(symbol, results = []) {
  const upper = symbol.toUpperCase();
  const byExpiry = new Map();

  results.forEach((row) => {
    const details = row.details;
    if (!details?.expiration_date || details.strike_price == null) return;

    const type = details.contract_type === 'put' ? 'put' : 'call';
    const strike = Number(details.strike_price);
    const expiry = details.expiration_date;
    const mid = contractMid(row);
    if (mid == null || mid <= 0) return;

    const quote = row.last_quote || {};
    const bid = quote.bid != null ? Number(quote.bid) : mid;
    const ask = quote.ask != null ? Number(quote.ask) : mid;

    const contract = {
      id: `${upper}-${expiry}-${type === 'call' ? 'C' : 'P'}-${strike}`,
      symbol: upper,
      type,
      strike,
      expiry,
      mid: Number(mid.toFixed(2)),
      bid: Number(Math.max(0, bid).toFixed(2)),
      ask: Number(Math.max(0, ask).toFixed(2)),
      openInterest: row.open_interest ?? null,
      iv: row.implied_volatility ?? null,
      greeks: row.greeks ?? null,
      optionTicker: details.ticker ?? null,
    };

    if (!byExpiry.has(expiry)) {
      byExpiry.set(expiry, { expiry, calls: [], puts: [] });
    }
    const bucket = byExpiry.get(expiry);
    bucket[type === 'call' ? 'calls' : 'puts'].push(contract);
  });

  return [...byExpiry.values()]
    .sort((a, b) => a.expiry.localeCompare(b.expiry))
    .map(({ expiry, calls, puts }) => ({
      expiry,
      calls: calls.sort((a, b) => a.strike - b.strike),
      puts: puts.sort((a, b) => a.strike - b.strike),
    }))
    .filter((item) => item.calls.length || item.puts.length);
}
