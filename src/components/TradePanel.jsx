import { useMemo, useState } from 'react';
import { usePortfolio } from '../hooks/usePortfolio';
import { useTradeFeedback } from '../hooks/useTradeFeedback';
import { formatCurrency, formatShares } from '../lib/formatters';
import GlossaryTip from './GlossaryTip';

const ORDER_TYPES = [
  { id: 'market', label: 'Market' },
  { id: 'limit', label: 'Limit' },
  { id: 'stop', label: 'Stop' },
];

function positionLabel(shares) {
  if (shares > 0) return `Long ${formatShares(shares)}`;
  if (shares < 0) return `Short ${formatShares(Math.abs(shares))}`;
  return 'Flat';
}

export default function TradePanel({ symbol, price }) {
  const { cash, positions, placeStockOrder } = usePortfolio();
  const onTrade = useTradeFeedback();
  const [side, setSide] = useState('buy');
  const [orderType, setOrderType] = useState('market');
  const [shares, setShares] = useState('1');
  const [limitPrice, setLimitPrice] = useState('');
  const [stopPrice, setStopPrice] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  const upper = symbol?.toUpperCase();
  const owned = positions[upper]?.shares || 0;
  const qty = Number(shares) || 0;
  const fillPrice = orderType === 'limit' ? parseFloat(limitPrice) || 0 : price;
  const total = useMemo(() => qty * (fillPrice || price || 0), [fillPrice, price, qty]);

  const willShort = side === 'sell' && owned >= 0 && qty > owned;
  const isCover = side === 'buy' && owned < 0;

  function actionLabel() {
    if (orderType !== 'market') return `Place order`;
    if (side === 'buy') return isCover ? `Cover ${upper}` : `Buy ${upper}`;
    if (willShort && owned === 0) return `Short ${upper}`;
    if (willShort) return `Sell + Short ${upper}`;
    return `Sell ${upper}`;
  }

  function submit() {
    setError('');
    const result = placeStockOrder({
      symbol: upper,
      side,
      orderType,
      shares,
      price,
      limitPrice: limitPrice || null,
      stopPrice: stopPrice || null,
      note: note.trim(),
    });

    if (!result.ok) {
      setError(result.error);
      return;
    }

    onTrade(result);
    if (!result.pending) {
      setNote('');
    }
  }

  return (
    <div className="card">
      <div className="pill-group" style={{ marginBottom: 16 }}>
        <button type="button" className={side === 'buy' ? 'pill active' : 'pill'} onClick={() => setSide('buy')}>
          {owned < 0 ? 'Cover' : 'Buy'}
        </button>
        <button type="button" className={side === 'sell' ? 'pill active' : 'pill'} onClick={() => setSide('sell')}>
          <GlossaryTip term="shortSelling">Sell / Short</GlossaryTip>
        </button>
      </div>

      <div className="pill-group" style={{ marginBottom: 16, flexWrap: 'wrap' }}>
        {ORDER_TYPES.map((item) => (
          <button
            key={item.id}
            type="button"
            className={orderType === item.id ? 'pill active' : 'pill'}
            onClick={() => setOrderType(item.id)}
          >
            <GlossaryTip term={item.id === 'market' ? 'marketOrder' : item.id === 'limit' ? 'limitOrder' : 'stopOrder'}>
              {item.label}
            </GlossaryTip>
          </button>
        ))}
      </div>

      {side === 'sell' && owned >= 0 && (
        <p className="short-hint">
          Selling more than you own opens a <GlossaryTip term="shortSelling">short</GlossaryTip> position.
        </p>
      )}

      <label className="field">
        <span>Shares</span>
        <input className="input" type="number" min="0" step="1" value={shares} onChange={(e) => setShares(e.target.value)} />
      </label>

      {orderType === 'limit' && (
        <label className="field">
          <span>Limit price</span>
          <input className="input" type="number" step="0.01" value={limitPrice} onChange={(e) => setLimitPrice(e.target.value)} placeholder={price?.toFixed(2)} />
        </label>
      )}

      {orderType === 'stop' && (
        <label className="field">
          <span>Stop price</span>
          <input className="input" type="number" step="0.01" value={stopPrice} onChange={(e) => setStopPrice(e.target.value)} placeholder={price?.toFixed(2)} />
        </label>
      )}

      <label className="field">
        <span>Journal note (optional)</span>
        <input className="input" type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Why this trade?" maxLength={120} />
      </label>

      <div className="trade-summary">
        <div>
          <div className="stat-label">Cash available</div>
          <div className="tabular">{formatCurrency(cash)}</div>
        </div>
        <div>
          <div className="stat-label">Position</div>
          <div className={`tabular ${owned < 0 ? 'negative' : ''}`}>{positionLabel(owned)}</div>
        </div>
        <div>
          <div className="stat-label">Est. total</div>
          <div className="tabular">{formatCurrency(total)}</div>
        </div>
        <div>
          <div className="stat-label">Market price</div>
          <div className="tabular">{formatCurrency(price)}</div>
        </div>
      </div>

      <button
        type="button"
        className={`btn ${side === 'buy' ? 'btn-primary' : 'btn-danger'}`}
        style={{ width: '100%', marginTop: 16 }}
        onClick={submit}
        disabled={!price || qty <= 0}
      >
        {actionLabel()}
      </button>

      {error && <div className="trade-error">{error}</div>}
    </div>
  );
}
