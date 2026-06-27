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
import { resolveUnderlyingPrice } from '../lib/portfolioStorage';
import { getSector } from '../lib/sectors';
import { formatCurrency, formatPercent, plClass } from '../lib/formatters';

function seededFallbackPrice(symbol) {
  let hash = 0;
  for (let i = 0; i < symbol.length; i += 1) {
    hash = (hash << 5) - hash + symbol.charCodeAt(i);
    hash |= 0;
  }
  return 20 + (Math.abs(hash) % 480);
}

function buildDisplayQuote(symbol, quotes, marketSnapshot) {
  const upper = symbol.toUpperCase();
  const price = resolveUnderlyingPrice(upper, quotes, marketSnapshot, seededFallbackPrice);
  const live = quotes[upper];
  const snap = marketSnapshot?.quotes?.[upper];

  if (live?.c && !snap?.c) {
    return live;
  }

  return {
    c: price,
    d: live?.d ?? 0,
    dp: snap?.dp ?? live?.dp ?? 0,
    pc: live?.pc ?? price,
  };
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
  const [liveQuote, setLiveQuote] = useState(null);
  const [loading, setLoading] = useState(true);

  const inPortfolioSnapshot = Boolean(portfolioState.marketSnapshot?.quotes?.[upper]?.c);

  const displayQuote = useMemo(
    () => buildDisplayQuote(upper, quotes, portfolioState.marketSnapshot),
    [upper, quotes, portfolioState.marketSnapshot],
  );

  const isWatched = watchlist.includes(upper);
  const position = positions[upper];
  const symbolOrders = pendingOrders.filter((o) => o.symbol === upper);
  const sector = getSector(upper);

  useEffect(() => {
    if (inPortfolioSnapshot) {
      setLoading(false);
      return undefined;
    }

    if (isQuoteRefreshPaused()) {
      setLoading(false);
      return undefined;
    }

    let cancelled = false;
    setLoading(true);

    marketData
      .getQuote(upper)
      .then((data) => {
        if (!cancelled) {
          setLiveQuote(data);
          setQuote(upper, data);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [inPortfolioSnapshot, isQuoteRefreshPaused, setQuote, upper]);

  const headerQuote = inPortfolioSnapshot ? displayQuote : (liveQuote || displayQuote);

  return (
    <div className="section-gap" style={{ paddingTop: 16 }}>
      <Link to="/" className="back-link">← Back to portfolio</Link>

      <ApiBanner />
      <OfflineBanner />

      {inPortfolioSnapshot && (
        <div className="banner banner-info" style={{ marginBottom: 0 }}>
          Price and option premiums use your synced portfolio marks so they match across devices.
        </div>
      )}

      <section className="card hero-card">
        <div className="stock-hero-header">
          <div>
            <div className="stat-label">{upper} · {sector}</div>
            {loading && !headerQuote?.c ? (
              <div className="skeleton" style={{ width: 160, height: 36, marginTop: 8 }} />
            ) : (
              <>
                <div className="hero-value">{formatCurrency(headerQuote?.c)}</div>
                <div className={`hero-pl tabular ${plClass(headerQuote?.d)}`}>
                  {formatCurrency(headerQuote?.d)} ({formatPercent(headerQuote?.dp)}) today
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
          <StockChart symbol={upper} livePrice={headerQuote?.c} />
          <StockPositionCard position={position} quote={headerQuote} symbol={upper} />
          <WhatIfCalculator
            symbol={upper}
            shares={position?.shares}
            avgCost={position?.avgCost}
            currentPrice={headerQuote?.c}
          />
          <PendingOrders orders={symbolOrders} />
          <TradePanel symbol={upper} price={headerQuote?.c} />
          <StockNews symbol={upper} />
        </>
      ) : (
        <OptionsChain symbol={upper} />
      )}
    </div>
  );
}
