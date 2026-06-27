import { formatCurrency, formatPercent } from '../lib/formatters';
import GlossaryTip from './GlossaryTip';

export default function PerformanceStats({ performance }) {
  if (!performance) return null;

  return (
    <div className="card">
      <h2 className="card-title">Performance</h2>
      <div className="stats-grid">
        <div>
          <div className="stat-label"><GlossaryTip term="realizedPL">Realized P/L</GlossaryTip></div>
          <div className="stat-value tabular">{formatCurrency(performance.realizedPL)}</div>
        </div>
        <div>
          <div className="stat-label">Win rate</div>
          <div className="stat-value tabular">{formatPercent(performance.winRate, 0)}</div>
        </div>
        <div>
          <div className="stat-label">Closed trades</div>
          <div className="stat-value tabular">{performance.closedTrades}</div>
        </div>
        <div>
          <div className="stat-label">Total activity</div>
          <div className="stat-value tabular">{performance.totalTrades}</div>
        </div>
      </div>
    </div>
  );
}
