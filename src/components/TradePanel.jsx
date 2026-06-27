import { useMemo, useState } from 'react';
import { usePortfolio } from '../hooks/usePortfolio';
import { formatCurrency } from '../lib/formatters';

export default function TradePanel({ symbol, price }) {
  const { cash, positions, buyStock, sellStock } = usePortfolio();
  const [side, setSide] = useState('buy');
  const [shares, setShares] = useState('1');
  const [message, setMessage] = useState('');

  const owned = positions[symbol?.toUpperCase()]?.shares || 0;
  const total = useMemo(() => Number(shares || 0) * Number(price || 0), [price, shares]);

  function submit() {
    const result =
      side === 'buy'
        ? buyStock(symbol, shares, price)
        : sellStock(symbol, shares, price);

    setMessage(result.ok ? `${side === 'buy' ? 'Bought' : 'Sold'} successfully.` : result.error);
  }

  return (
    <div className="card">
      <div className="pill-group" style={{ marginBottom: 16 }}>
        <button type="button" className={side === 'buy' ? 'pill active' : 'pill'} onClick={() => setSide('buy')}>
          Buy
        </button>
        <button type="button" className={side === 'sell' ? 'pill active' : 'pill'} onClick={() => setSide('sell')}>
          Sell
        </button>
      </div>

      <label style={{ display: 'block', marginBottom: 8, color: 'var(--text-muted)', fontSize: '0.85rem' }}>
        Shares
      </label>
      <input
        className="input"
        type="number"
        min="0"
        step="1"
        value={shares}
        onChange={(event) => setShares(event.target.value)}
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 16, fontSize: '0.9rem' }}>
        <div>
          <div style={{ color: 'var(--text-muted)' }}>Cash available</div>
          <div>{formatCurrency(cash)}</div>
        </div>
        <div>
          <div style={{ color: 'var(--text-muted)' }}>Shares owned</div>
          <div>{owned}</div>
        </div>
        <div>
          <div style={{ color: 'var(--text-muted)' }}>Est. total</div>
          <div>{formatCurrency(total)}</div>
        </div>
        <div>
          <div style={{ color: 'var(--text-muted)' }}>Price</div>
          <div>{formatCurrency(price)}</div>
        </div>
      </div>

      <button
        type="button"
        className={`btn ${side === 'buy' ? 'btn-primary' : 'btn-danger'}`}
        style={{ width: '100%', marginTop: 16 }}
        onClick={submit}
        disabled={!price || Number(shares) <= 0}
      >
        {side === 'buy' ? 'Buy' : 'Sell'} {symbol}
      </button>

      {message && (
        <div style={{ marginTop: 12, fontSize: '0.85rem', color: 'var(--text-muted)' }}>{message}</div>
      )}
    </div>
  );
}
