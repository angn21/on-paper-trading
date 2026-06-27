import { useState } from 'react';
import { formatCurrency } from '../lib/formatters';

export default function WhatIfCalculator({ symbol, shares, avgCost, currentPrice }) {
  const [targetPrice, setTargetPrice] = useState(currentPrice?.toFixed(2) || '');

  if (!shares) return null;

  const price = parseFloat(targetPrice) || 0;
  const pl = shares * (price - avgCost);

  return (
    <div className="card">
      <h2 className="card-title">What-if</h2>
      <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: 0 }}>
        If {symbol} hits this price, your position P/L would be:
      </p>
      <label className="field">
        <span>Target price</span>
        <input
          type="number"
          step="0.01"
          value={targetPrice}
          onChange={(e) => setTargetPrice(e.target.value)}
        />
      </label>
      <div className={`stat-value tabular ${pl >= 0 ? 'positive' : 'negative'}`} style={{ fontSize: '1.25rem' }}>
        {formatCurrency(pl)}
      </div>
    </div>
  );
}
