import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import ApiBanner from '../components/ApiBanner';
import OptionsChain from '../components/OptionsChain';
import StockChart from '../components/charts/StockChart';
import TradePanel from '../components/TradePanel';
import { marketData } from '../marketData/marketData';
import { usePortfolio } from '../hooks/usePortfolio';
import { formatCurrency, formatPercent, plClass } from '../lib/formatters';

export default function StockDetail() {
  const { symbol } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const upper = symbol?.toUpperCase();
  const tab = searchParams.get('tab') === 'options' ? 'options' : 'chart';

  const { watchlist, toggleWatchlist, setQuote } = usePortfolio();
  const [quote, setLocalQuote] = useState(null);
  const [loading, setLoading] = useState(true);

  const isWatched = watchlist.includes(upper);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    marketData
      .getQuote(upper)
      .then((data) => {
        if (!cancelled) {
          setLocalQuote(data);
          setQuote(upper, data);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [setQuote, upper]);

  return (
    <div className="section-gap" style={{ paddingTop: 16 }}>
      <Link to="/" style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
        ← Back to portfolio
      </Link>

      <ApiBanner />

      <section className="card hero-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
          <div>
            <div style={{ color: 'var(--text-muted)' }}>{upper}</div>
            {loading ? (
              <div className="skeleton" style={{ width: 160, height: 36, marginTop: 8 }} />
            ) : (
              <>
                <div style={{ fontSize: '2.2rem', fontWeight: 700, marginTop: 4 }}>
                  {formatCurrency(quote?.c)}
                </div>
                <div className={plClass(quote?.d)} style={{ marginTop: 6 }}>
                  {formatCurrency(quote?.d)} ({formatPercent(quote?.dp)}) today
                </div>
              </>
            )}
          </div>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => toggleWatchlist(upper)}
            aria-label={isWatched ? 'Remove from watchlist' : 'Add to watchlist'}
          >
            {isWatched ? '★' : '☆'}
          </button>
        </div>
      </section>

      <div className="pill-group">
        <button
          type="button"
          className={tab === 'chart' ? 'pill active' : 'pill'}
          onClick={() => setSearchParams({})}
        >
          Chart
        </button>
        <button
          type="button"
          className={tab === 'options' ? 'pill active' : 'pill'}
          onClick={() => setSearchParams({ tab: 'options' })}
        >
          Options
        </button>
      </div>

      {tab === 'chart' ? (
        <>
          <StockChart symbol={upper} />
          <TradePanel symbol={upper} price={quote?.c} />
        </>
      ) : (
        <OptionsChain symbol={upper} underlyingPrice={quote?.c || 100} />
      )}
    </div>
  );
}
