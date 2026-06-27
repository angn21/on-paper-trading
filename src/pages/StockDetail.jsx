import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import ApiBanner from '../components/ApiBanner';
import OfflineBanner from '../components/OfflineBanner';
import OptionsChain from '../components/OptionsChain';
import PendingOrders from '../components/PendingOrders';
import StockChart from '../components/charts/StockChart';
import StockNews from '../components/StockNews';
import StockPositionCard from '../components/StockPositionCard';
import TradePanel from '../components/TradePanel';
import WhatIfCalculator from '../components/WhatIfCalculator';
import { marketData } from '../marketData/marketData';
import { usePortfolio } from '../hooks/usePortfolio';
import { getSector } from '../lib/sectors';
import { formatCurrency, formatPercent, plClass } from '../lib/formatters';

function quoteFromContext(quotes, marketSnapshot, symbol) {
  const live = quotes[symbol];
  if (live?.c) return live;

  const snap = marketSnapshot?.quotes?.[symbol];
  if (snap?.c) {
    return { c: snap.c, d: 0, dp: snap.dp ?? 0, pc: snap.c };
  }

  return null;
}

export default function StockDetail() {
  const { symbol } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const upper = symbol?.toUpperCase();
  const tab = searchParams.get('tab') === 'options' ? 'options' : 'chart';

  const {
    watchlist,
    positions,
    pendingOrders,
    quotes,
    portfolioState,
    toggleWatchlist,
    setQuote,
    isQuoteRefreshPaused,
  } = usePortfolio();
  const [quote, setLocalQuote] = useState(null);
  const [loading, setLoading] = useState(true);

  const contextQuote = useMemo(
    () => quoteFromContext(quotes, portfolioState.marketSnapshot, upper),
    [quotes, portfolioState.marketSnapshot, upper],
  );

  const isWatched = watchlist.includes(upper);
  const position = positions[upper];
  const symbolOrders = pendingOrders.filter((o) => o.symbol === upper);
  const sector = getSector(upper);
  const displayQuote = quote || contextQuote;

  useEffect(() => {
    if (contextQuote?.c) {
      setLocalQuote(contextQuote);
      setLoading(false);
    }

    if (isQuoteRefreshPaused()) return undefined;

    let cancelled = false;
    if (!contextQuote?.c) setLoading(true);

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
  }, [contextQuote, isQuoteRefreshPaused, setQuote, upper]);

  return (
    <div className="section-gap" style={{ paddingTop: 16 }}>
      <Link to="/" className="back-link">← Back to portfolio</Link>

      <ApiBanner />
      <OfflineBanner />

      <section className="card hero-card">
        <div className="stock-hero-header">
          <div>
            <div className="stat-label">{upper} · {sector}</div>
            {loading && !displayQuote?.c ? (
              <div className="skeleton" style={{ width: 160, height: 36, marginTop: 8 }} />
            ) : (
              <>
                <div className="hero-value">{formatCurrency(displayQuote?.c)}</div>
                <div className={`hero-pl tabular ${plClass(displayQuote?.d)}`}>
                  {formatCurrency(displayQuote?.d)} ({formatPercent(displayQuote?.dp)}) today
                </div>
              </>
            )}
          </div>
          <button
            type="button"
            className="btn btn-secondary watch-btn"
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
          <StockChart symbol={upper} livePrice={displayQuote?.c} />
          <StockPositionCard position={position} quote={displayQuote} symbol={upper} />
          <WhatIfCalculator
            symbol={upper}
            shares={position?.shares}
            avgCost={position?.avgCost}
            currentPrice={displayQuote?.c}
          />
          <PendingOrders orders={symbolOrders} />
          <TradePanel symbol={upper} price={displayQuote?.c} />
          <StockNews symbol={upper} />
        </>
      ) : (
        <OptionsChain symbol={upper} />
      )}
    </div>
  );
}
