import { useMemo, useState } from 'react';
import { usePortfolio } from '../hooks/usePortfolio';
import { formatCurrency } from '../lib/formatters';

export default function OptionsTradePanel({ contract }) {
  const { cash, options, buyOption, sellOption } = usePortfolio();
  const [side, setSide] = useState('buy');
  const [contracts, setContracts] = useState('1');
  const [message, setMessage] = useState('');

  const owned = options.find(
    (item) =>
      item.symbol === contract.symbol &&
      item.type === contract.type &&
      item.strike === contract.strike &&
      item.expiry === contract.expiry,
  );

  const total = useMemo(
    () => Number(contracts || 0) * contract.mid * 100,
    [contract.mid, contracts],
  );

  function submit() {
    const result =
      side === 'buy'
        ? buyOption(contract, contracts, contract.mid)
        : sellOption(owned?.id, contracts, contract.mid);

    setMessage(result.ok ? `${side === 'buy' ? 'Bought' : 'Sold'} option successfully.` : result.error);
  }

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>
        {contract.symbol} {contract.type.toUpperCase()} {formatCurrency(contract.strike, 0)} · {contract.expiry}
      </h3>

      <div className="pill-group" style={{ marginBottom: 16 }}>
        <button type="button" className={side === 'buy' ? 'pill active' : 'pill'} onClick={() => setSide('buy')}>
          Buy
        </button>
        <button type="button" className={side === 'sell' ? 'pill active' : 'pill'} onClick={() => setSide('sell')}>
          Sell
        </button>
      </div>

      <label style={{ display: 'block', marginBottom: 8, color: 'var(--text-muted)', fontSize: '0.85rem' }}>
        Contracts
      </label>
      <input
        className="input"
        type="number"
        min="0"
        step="1"
        value={contracts}
        onChange={(event) => setContracts(event.target.value)}
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 16, fontSize: '0.9rem' }}>
        <div>
          <div style={{ color: 'var(--text-muted)' }}>Cash available</div>
          <div>{formatCurrency(cash)}</div>
        </div>
        <div>
          <div style={{ color: 'var(--text-muted)' }}>Contracts owned</div>
          <div>{owned?.contracts || 0}</div>
        </div>
        <div>
          <div style={{ color: 'var(--text-muted)' }}>Model mid</div>
          <div>{formatCurrency(contract.mid)}</div>
        </div>
        <div>
          <div style={{ color: 'var(--text-muted)' }}>Est. total</div>
          <div>{formatCurrency(total)}</div>
        </div>
      </div>

      <button
        type="button"
        className={`btn ${side === 'buy' ? 'btn-primary' : 'btn-danger'}`}
        style={{ width: '100%', marginTop: 16 }}
        onClick={submit}
        disabled={Number(contracts) <= 0 || (side === 'sell' && !owned)}
      >
        {side === 'buy' ? 'Buy' : 'Sell'} option
      </button>

      {message && (
        <div style={{ marginTop: 12, fontSize: '0.85rem', color: 'var(--text-muted)' }}>{message}</div>
      )}
    </div>
  );
}
