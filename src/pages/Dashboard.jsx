import { useEffect } from 'react';
import ApiBanner from '../components/ApiBanner';
import MarketStatus from '../components/MarketStatus';
import PortfolioChart from '../components/charts/PortfolioChart';
import PositionsList from '../components/PositionsList';
import TransactionHistory from '../components/TransactionHistory';
import Watchlist from '../components/Watchlist';
import { usePortfolio } from '../hooks/usePortfolio';
import { useQuoteRefresh } from '../hooks/useQuoteRefresh';
import { formatCurrency, plClass } from '../lib/formatters';

export default function Dashboard() {
  const { cash, totalValue, totalPL, snapshotPortfolio } = usePortfolio();
  useQuoteRefresh();

  useEffect(() => {
    snapshotPortfolio(totalValue);
  }, [snapshotPortfolio, totalValue]);

  return (
    <div className="section-gap" style={{ paddingTop: 16 }}>
      <ApiBanner />
      <MarketStatus />

      <section className="card hero-card">
        <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Total Value</div>
        <div style={{ fontSize: '2.2rem', fontWeight: 700, marginTop: 4 }}>{formatCurrency(totalValue)}</div>
        <div className={plClass(totalPL)} style={{ marginTop: 6 }}>
          {formatCurrency(totalPL)} unrealized P/L
        </div>
        <div style={{ marginTop: 16, color: 'var(--text-muted)' }}>
          Cash · {formatCurrency(cash)}
        </div>
      </section>

      <PortfolioChart />

      <section className="card">
        <h2 className="card-title">Watchlist</h2>
        <Watchlist />
      </section>

      <section className="card">
        <h2 className="card-title">Positions</h2>
        <PositionsList />
      </section>

      <section className="card">
        <h2 className="card-title">Recent Activity</h2>
        <TransactionHistory />
      </section>
    </div>
  );
}
