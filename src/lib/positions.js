/**
 * Apply a stock buy or sell with signed-share positions (negative = short).
 */
export function applyStockTrade(prev, { upper, side, qty, px, note = '', orderType = 'market' }) {
  const existing = prev.positions[upper] || { shares: 0, avgCost: 0 };
  const prevShares = existing.shares;
  const prevAvgCost = existing.avgCost;
  const prevCash = prev.cash;

  let shares = existing.shares;
  let avgCost = existing.avgCost;
  let cash = prev.cash;
  let realizedPL = 0;
  let txSide = side;

  if (side === 'buy') {
    const cost = qty * px;
    if (cost > cash) {
      return { error: 'Not enough cash for this purchase.' };
    }

    if (shares < 0) {
      const shortQty = Math.abs(shares);
      const coverQty = Math.min(qty, shortQty);
      realizedPL += (avgCost - px) * coverQty;
      shares += coverQty;
      txSide = 'cover';

      const remainingBuy = qty - coverQty;
      if (remainingBuy > 0) {
        shares = remainingBuy;
        avgCost = px;
      } else if (shares === 0) {
        avgCost = 0;
      }
    } else {
      const newShares = shares + qty;
      avgCost = shares === 0 ? px : (shares * avgCost + qty * px) / newShares;
      shares = newShares;
    }

    cash -= cost;
  } else {
    const proceeds = qty * px;
    cash += proceeds;

    if (shares > 0) {
      const sellFromLong = Math.min(qty, shares);
      realizedPL += (px - avgCost) * sellFromLong;
      shares -= sellFromLong;
      const remainingSell = qty - sellFromLong;

      if (remainingSell > 0) {
        shares = -remainingSell;
        avgCost = px;
        txSide = 'short';
      } else if (shares === 0) {
        avgCost = 0;
      }
    } else {
      const prevShort = Math.abs(shares);
      const newShort = prevShort + qty;
      avgCost = shares === 0 ? px : (prevShort * avgCost + qty * px) / newShort;
      shares = -newShort;
      txSide = 'short';
    }
  }

  const nextPositions = { ...prev.positions };
  if (shares === 0) delete nextPositions[upper];
  else nextPositions[upper] = { shares, avgCost };

  const total = qty * px;
  const transaction = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    ts: Date.now(),
    kind: 'stock',
    side: txSide,
    symbol: upper,
    shares: qty,
    price: px,
    total,
    note,
    orderType,
    prevShares,
    prevAvgCost,
    prevCash,
    ...(realizedPL !== 0 ? { realizedPL } : {}),
  };

  const message =
    txSide === 'short'
      ? `Shorted ${qty} ${upper} @ ${px.toFixed(2)}`
      : txSide === 'cover'
        ? `Covered ${qty} ${upper} @ ${px.toFixed(2)}`
        : side === 'buy'
          ? `Bought ${qty} ${upper} @ ${px.toFixed(2)}`
          : `Sold ${qty} ${upper} @ ${px.toFixed(2)}`;

  return { cash, positions: nextPositions, transaction, message };
}

export function revertStockTransaction(prev, last) {
  const nextPositions = { ...prev.positions };
  if (last.prevShares === 0) delete nextPositions[last.symbol];
  else nextPositions[last.symbol] = { shares: last.prevShares, avgCost: last.prevAvgCost };

  return {
    ...prev,
    cash: last.prevCash ?? prev.cash,
    positions: nextPositions,
    transactions: prev.transactions.filter((tx) => tx.id !== last.id),
  };
}
