import { useMemo, useState } from 'react';
import { generateOptionsChain } from '../lib/blackScholes';
import { usePortfolio } from '../hooks/usePortfolio';
import { formatCurrency } from '../lib/formatters';
import OptionsTradePanel from './OptionsTradePanel';

export default function OptionsChain({ symbol, underlyingPrice }) {
  const [type, setType] = useState('call');
  const [expiry, setExpiry] = useState('');
  const [selected, setSelected] = useState(null);

  const chain = useMemo(
    () => generateOptionsChain(symbol, underlyingPrice),
    [symbol, underlyingPrice],
  );

  const expiries = chain.map((item) => item.expiry);
  const activeExpiry = expiry || expiries[0] || '';
  const activeChain = chain.find((item) => item.expiry === activeExpiry);
  const rows = activeChain ? activeChain[type === 'call' ? 'calls' : 'puts'] : [];

  return (
    <div className="section-gap">
      <div className="banner banner-warning">
        Option premiums are model-derived (Black-Scholes), not live market quotes.
      </div>

      <div className="card">
        <div className="pill-group" style={{ marginBottom: 12 }}>
          <button type="button" className={type === 'call' ? 'pill active' : 'pill'} onClick={() => setType('call')}>
            Calls
          </button>
          <button type="button" className={type === 'put' ? 'pill active' : 'pill'} onClick={() => setType('put')}>
            Puts
          </button>
        </div>

        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', marginBottom: 12 }}>
          {expiries.map((item) => (
            <button
              key={item}
              type="button"
              className={activeExpiry === item ? 'pill active' : 'pill'}
              onClick={() => {
                setExpiry(item);
                setSelected(null);
              }}
            >
              {item}
            </button>
          ))}
        </div>

        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 8 }}>
          Strike · Mid premium
        </div>

        {rows.map((row) => (
          <button
            key={row.id}
            type="button"
            className="row-link"
            style={{
              width: '100%',
              background: selected?.id === row.id ? 'var(--accent-dim)' : 'transparent',
              border: 'none',
              borderBottom: '1px solid var(--border)',
              color: 'inherit',
            }}
            onClick={() => setSelected(row)}
          >
            <span>{formatCurrency(row.strike, 0)}</span>
            <span className="positive">{formatCurrency(row.mid)}</span>
          </button>
        ))}
      </div>

      {selected && <OptionsTradePanel contract={selected} />}
    </div>
  );
}
