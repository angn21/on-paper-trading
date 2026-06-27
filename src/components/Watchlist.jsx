import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { marketData } from '../marketData/marketData';
import { usePortfolio } from '../hooks/usePortfolio';
import { formatCurrency, formatPercent, plClass } from '../lib/formatters';

export default function Watchlist() {
  const { watchlist, quotes } = usePortfolio();
  const [rows, setRows] = useState([]);

  useEffect(() => {
    if (!watchlist.length) {
      setRows([]);
      return;
    }

    let cancelled = false;

    async function load() {
      const data = await Promise.all(
        watchlist.map(async (symbol) => {
          const quote = quotes[symbol] || (await marketData.getQuote(symbol));
          return { symbol, quote };
        }),
      );
      if (!cancelled) setRows(data);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [quotes, watchlist]);

  if (!watchlist.length) {
    return <div className="empty-state">Star tickers on a stock page to build your watchlist.</div>;
  }

  return (
    <div>
      {rows.map(({ symbol, quote }) => (
        <Link key={symbol} to={`/stock/${symbol}`} className="row-link">
          <div>
            <div style={{ fontWeight: 700 }}>{symbol}</div>
            <div className={plClass(quote?.d)}>
              {formatCurrency(quote?.c)} · {formatPercent(quote?.dp)}
            </div>
          </div>
          <span className="positive">›</span>
        </Link>
      ))}
    </div>
  );
}
