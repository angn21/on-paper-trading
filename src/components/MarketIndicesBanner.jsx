import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatCurrency, formatPercent, plClass } from '../lib/formatters';
import { marketData } from '../marketData/marketData';

const INDICES = [
  { symbol: 'SPY', label: 'S&P 500', via: 'SPY ETF' },
  { symbol: 'QQQ', label: 'Nasdaq 100', via: 'QQQ ETF' },
];

function IndexTile({ label, via, symbol, quote }) {
  const change = quote?.d;
  const changePct = quote?.dp;

  return (
    <Link to={`/stock/${symbol}`} className="indices-tile">
      <span className="indices-label">{label}</span>
      <span className="indices-via">{via} · ETF price, not index level</span>
      <span className="indices-price tabular">{formatCurrency(quote?.c)}</span>
      <span className={`indices-change tabular ${plClass(change)}`}>
        {change != null ? `${change >= 0 ? '+' : ''}${formatCurrency(change, 2)}` : '—'}
        {' '}
        ({formatPercent(changePct)})
      </span>
    </Link>
  );
}

export default function MarketIndicesBanner() {
  const [quotes, setQuotes] = useState({});

  useEffect(() => {
    let cancelled = false;
    let timer;

    async function refresh() {
      const next = {};
      await Promise.all(
        INDICES.map(async ({ symbol }) => {
          try {
            next[symbol] = await marketData.getQuote(symbol);
          } catch {
            // marketData falls back to simulated quotes internally via getQuote
          }
        }),
      );
      if (!cancelled) setQuotes((prev) => ({ ...prev, ...next }));
    }

    async function tick() {
      if (cancelled) return;
      await refresh();
      if (cancelled) return;
      timer = setTimeout(tick, marketData.getQuoteRefreshInterval());
    }

    tick();

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  return (
    <div className="indices-banner" aria-label="Market index ETFs">
      {INDICES.map(({ symbol, label, via }) => (
        <IndexTile key={symbol} symbol={symbol} label={label} via={via} quote={quotes[symbol]} />
      ))}
    </div>
  );
}
