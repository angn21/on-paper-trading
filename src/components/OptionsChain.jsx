import { useMemo, useState } from 'react';
import { generateOptionsChain } from '../lib/blackScholes';
import { formatVolatilityPercent } from '../lib/volatility';
import { resolveUnderlyingPrice, resolveVolatility } from '../lib/portfolioStorage';
import { usePortfolio } from '../hooks/usePortfolio';
import { formatCurrency } from '../lib/formatters';
import OptionsTradePanel from './OptionsTradePanel';

function seededFallbackPrice(symbol) {
  let hash = 0;
  for (let i = 0; i < symbol.length; i += 1) {
    hash = (hash << 5) - hash + symbol.charCodeAt(i);
    hash |= 0;
  }
  return 20 + (Math.abs(hash) % 480);
}

export default function OptionsChain({ symbol }) {
  const { quotes, volatility, portfolioState } = usePortfolio();
  const upper = symbol?.toUpperCase();

  const underlyingPrice = resolveUnderlyingPrice(
    upper,
    quotes,
    portfolioState.marketSnapshot,
    seededFallbackPrice,
  );
  const sigma = resolveVolatility(upper, volatility, portfolioState.marketSnapshot);

  const chain = useMemo(
    () => generateOptionsChain(symbol, underlyingPrice, sigma),
    [symbol, underlyingPrice, sigma],
  );

  const [type, setType] = useState('call');
  const [expiry, setExpiry] = useState('');
  const [selected, setSelected] = useState(null);

  const expiries = chain.map((item) => item.expiry);
  const activeExpiry = expiry || expiries[0] || '';
  const activeChain = chain.find((item) => item.expiry === activeExpiry);
  const rows = activeChain ? activeChain[type === 'call' ? 'calls' : 'puts'] : [];

  return (
    <div className="section-gap">
      <div className="banner banner-warning">
        Option premiums are model-derived (Black-Scholes) using {formatVolatilityPercent(sigma)}{' '}
        30-day realized volatility — not live option quotes.
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

        <div
          className="options-chain-header"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '0.8rem',
            color: 'var(--text-muted)',
            marginBottom: 4,
            paddingBottom: 4,
            borderBottom: '1px solid var(--border)',
          }}
        >
          <span>Strike</span>
          <span>Mid premium</span>
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

      {selected && (
        <OptionsTradePanel
          contract={selected}
          sigma={sigma}
          underlyingPrice={underlyingPrice}
        />
      )}
    </div>
  );
}
