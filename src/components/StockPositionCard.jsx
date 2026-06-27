import { formatCurrency, formatPercent, formatShares } from '../lib/formatters';
import GlossaryTip from './GlossaryTip';

export default function StockPositionCard({ position, quote, symbol }) {
  if (!position) return null;

  const isShort = position.shares < 0;
  const absShares = Math.abs(position.shares);
  const price = quote?.c ?? position.avgCost;
  const marketValue = position.shares * price;
  const costBasis = position.avgCost * position.shares;
  const pl = marketValue - costBasis;
  const plPct = costBasis !== 0 ? (pl / Math.abs(costBasis)) * 100 : 0;

  return (
    <div className="card position-card">
      <h2 className="card-title">Your position</h2>
      <div className="position-grid">
        <div>
          <div className="stat-label">Position</div>
          <div className={`stat-value tabular ${isShort ? 'negative' : ''}`}>
            {isShort ? `Short ${formatShares(absShares)}` : `Long ${formatShares(position.shares)}`}
          </div>
        </div>
        <div>
          <div className="stat-label">{isShort ? 'Avg short price' : <GlossaryTip term="avgCost">Avg cost</GlossaryTip>}</div>
          <div className="stat-value tabular">{formatCurrency(position.avgCost)}</div>
        </div>
        <div>
          <div className="stat-label">Market value</div>
          <div className="stat-value tabular">{formatCurrency(marketValue)}</div>
        </div>
        <div>
          <div className="stat-label"><GlossaryTip term="unrealizedPL">Unrealized P/L</GlossaryTip></div>
          <div className={`stat-value tabular ${pl >= 0 ? 'positive' : 'negative'}`}>
            {formatCurrency(pl)} ({formatPercent(plPct)})
          </div>
        </div>
      </div>
      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
        {symbol} @ {formatCurrency(price)}
      </p>
    </div>
  );
}
