import { useEffect, useState } from 'react';
import { resolveUnderlyingPrice, hasSyncedMarksForSymbol } from '../lib/portfolioStorage';
import { usePortfolio } from '../hooks/usePortfolio';
import { useOptionsChain } from '../hooks/useOptionsChain';
import { getOptionsChainSourceLabel } from '../marketData/massiveOptions';
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
  const { quotes, portfolioState } = usePortfolio();
  const upper = symbol?.toUpperCase();

  const underlyingPrice = resolveUnderlyingPrice(
    upper,
    quotes,
    portfolioState.marketSnapshot,
    seededFallbackPrice,
  );

  const { chains, expiries: chainExpiries, source, message, loadExpiry } = useOptionsChain(
    symbol,
    underlyingPrice,
    0.3,
  );

  const [type, setType] = useState('call');
  const [expiry, setExpiry] = useState('');
  const [selected, setSelected] = useState(null);

  const expiries = chainExpiries.length
    ? chainExpiries
    : chains.map((item) => item.expiry);
  const activeExpiry = expiry || expiries[0] || '';
  const activeChain = chains.find((item) => item.expiry === activeExpiry);
  const rows = activeChain ? activeChain[type === 'call' ? 'calls' : 'puts'] : [];

  useEffect(() => {
    if (activeExpiry && source === 'eod') {
      loadExpiry(activeExpiry);
    }
  }, [activeExpiry, source, loadExpiry]);

  const hasSyncedMarks = hasSyncedMarksForSymbol(upper, portfolioState.marketSnapshot);
  const isLive = source === 'live';
  const isEod = source === 'eod';
  const isLoading = source === 'loading';

  return (
    <div className="section-gap">
      {hasSyncedMarks && (
        <div className="banner banner-info">
          Stock prices use your synced portfolio marks so they match across devices.
        </div>
      )}

      {isLoading && (
        <div className="banner banner-info">Loading option chain…</div>
      )}

      {(isLive || isEod) && (
        <div className="banner banner-info">
          {getOptionsChainSourceLabel(source)}
          {message ? ` ${message}` : ''}
        </div>
      )}

      {source === 'model' && (
        <div className="banner banner-warning">
          {message} Using model-derived premiums (Black-Scholes).
        </div>
      )}

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

        {!isLoading && !rows.length && (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            No {type}s for this expiry. Try another date or wait if EOD prices are still loading.
          </p>
        )}

        {rows.length > 0 && (
          <>
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
              <span>{isLive || isEod ? 'Mid quote' : 'Mid premium'}</span>
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
          </>
        )}
      </div>

      {selected && (
        <OptionsTradePanel
          contract={selected}
          underlyingPrice={underlyingPrice}
          liveGreeks={isLive}
        />
      )}
    </div>
  );
}
