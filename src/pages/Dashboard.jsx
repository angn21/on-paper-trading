import ApiBanner from '../components/ApiBanner';
import AnimatedCurrency from '../components/AnimatedCurrency';
import BenchmarkChart from '../components/BenchmarkChart';
import MarketStatus from '../components/MarketStatus';
import OfflineBanner from '../components/OfflineBanner';
import PendingOrders from '../components/PendingOrders';
import PerformanceStats from '../components/PerformanceStats';
import PortfolioActions from '../components/PortfolioActions';
import PortfolioAllocation from '../components/PortfolioAllocation';
import SectorAllocation from '../components/SectorAllocation';
import PortfolioChart from '../components/charts/PortfolioChart';
import PositionsList from '../components/PositionsList';
import TransactionHistory from '../components/TransactionHistory';
import Watchlist from '../components/Watchlist';
import { usePortfolio } from '../hooks/usePortfolio';
import { useQuoteRefresh } from '../hooks/useQuoteRefresh';
import { formatCurrency, plClass } from '../lib/formatters';

export default function Dashboard() {
  const {
    cash,
    totalValue,
    totalPL,
    allocation,
    performance,
    portfolioHistory,
    benchmarkHistory,
    pendingOrders,
    stockPositions,
    optionPositions,
  } = usePortfolio();

  useQuoteRefresh();

  const hasPositions = stockPositions.length > 0 || optionPositions.length > 0;

  return (
    <div className="section-gap" style={{ paddingTop: 16 }}>
      <ApiBanner />
      <OfflineBanner />
      <MarketStatus />

      <section className="card hero-card">
        <div className="stat-label">Total Value</div>
        <div className="hero-value">
          <AnimatedCurrency value={totalValue} />
        </div>
        <div className={`hero-pl tabular ${plClass(totalPL)}`}>
          <AnimatedCurrency value={totalPL} className={plClass(totalPL)} /> unrealized P/L
        </div>
        <div className="hero-cash">Cash · {formatCurrency(cash)}</div>
      </section>

      <PortfolioChart />
      <BenchmarkChart portfolioHistory={portfolioHistory} benchmarkHistory={benchmarkHistory} />
      <PortfolioAllocation allocation={allocation} />
      <SectorAllocation />
      <PerformanceStats performance={performance} />
      <PendingOrders orders={pendingOrders} />
      <PortfolioActions />

      <section className="card">
        <h2 className="card-title">Watchlist</h2>
        <Watchlist />
      </section>

      <section className="card">
        <h2 className="card-title">Positions</h2>
        {hasPositions ? <PositionsList /> : (
          <div className="empty-state">
            No open positions yet. Search a ticker to place your first paper trade.
          </div>
        )}
      </section>

      <section className="card">
        <h2 className="card-title">Recent Activity</h2>
        <TransactionHistory />
      </section>
    </div>
  );
}
