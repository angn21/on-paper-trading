import { useEffect, useMemo, useState } from 'react';
import { generateOptionsChain } from '../lib/blackScholes';
import { formatVolatilityPercent } from '../lib/volatility';
import { marketData } from '../marketData/marketData';
import { usePortfolio } from '../hooks/usePortfolio';
import { formatCurrency } from '../lib/formatters';
import OptionsTradePanel from './OptionsTradePanel';

export default function OptionsChain({ symbol, underlyingPrice }) {
  const { volatility, setVolatility } = usePortfolio();
  const upper = symbol?.toUpperCase();
  const [sigma, setSigma] = useState(volatility[upper] ?? 0.3);

  useEffect(() => {
    let cancelled = false;

    if (volatility[upper]) {
      setSigma(volatility[upper]);
      return undefined;
    }

    marketData.getVolatility(upper).then((value) => {
      if (!cancelled) {
        setSigma(value);
        setVolatility(upper, value);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [setVolatility, upper, volatility]);

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

      {selected && <OptionsTradePanel contract={selected} sigma={sigma} />}
    </div>
  );
}
