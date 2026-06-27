import { useState } from 'react';
import { resolveUnderlyingPrice } from '../lib/portfolioStorage';
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

  const {
    chains,
    expiries,
    source,
    message,
    pricingExpiry,
    loadExpiry,
  } = useOptionsChain(symbol, underlyingPrice, 0.3);

  const [type, setType] = useState('call');
  const [selectedExpiry, setSelectedExpiry] = useState('');
  const [selected, setSelected] = useState(null);

  const isEod = source === 'eod';
  const isModel = source === 'model';
  const isLoading = source === 'loading';

  const activeExpiry = isModel
    ? (selectedExpiry || expiries[0] || '')
    : selectedExpiry;

  const activeChain = chains.find((item) => item.expiry === activeExpiry);
  const rows = activeChain ? activeChain[type === 'call' ? 'calls' : 'puts'] : [];
  const isPricing = Boolean(pricingExpiry && pricingExpiry === activeExpiry);

  function handleExpiryClick(item) {
    setSelectedExpiry(item);
    setSelected(null);
    if (isEod) loadExpiry(item);
  }

  return (
    <div className="section-gap">
      {isLoading && (
        <div className="banner banner-info">Loading expiries…</div>
      )}

      {isEod && !isLoading && (
        <div className="banner banner-info">
          {isPricing ? getOptionsChainSourceLabel(true) : getOptionsChainSourceLabel()}
          {!isPricing && message ? ` ${message}` : ''}
        </div>
      )}

      {isModel && (
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
              onClick={() => handleExpiryClick(item)}
            >
              {item}
            </button>
          ))}
        </div>

        {!isLoading && isEod && !activeExpiry && (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Select an expiry to load strikes.
          </p>
        )}

        {!isLoading && activeExpiry && isPricing && !rows.length && (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Loading EOD marks for {activeExpiry}…
          </p>
        )}

        {!isLoading && activeExpiry && !isPricing && !rows.length && (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            No {type}s for this expiry. Try another date.
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
              <span>{isEod ? 'EOD mid' : 'Mid premium'}</span>
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
        <OptionsTradePanel contract={selected} underlyingPrice={underlyingPrice} />
      )}
    </div>
  );
}
