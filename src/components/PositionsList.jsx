import { Link } from 'react-router-dom';
import { usePortfolio } from '../hooks/usePortfolio';
import { formatCurrency, formatShares, plClass } from '../lib/formatters';

export default function PositionsList() {
  const { stockPositions, optionPositions } = usePortfolio();

  if (!stockPositions.length && !optionPositions.length) {
    return <div className="empty-state">No open positions yet. Search a ticker to place your first paper trade.</div>;
  }

  return (
    <div>
      {stockPositions.map((position) => (
        <Link key={position.symbol} to={`/stock/${position.symbol}`} className="row-link">
          <div>
            <div style={{ fontWeight: 700 }}>{position.symbol}</div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              {formatShares(position.shares)} shares · avg {formatCurrency(position.avgCost)}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div>{formatCurrency(position.marketValue)}</div>
            <div className={plClass(position.unrealizedPL)} style={{ fontSize: '0.85rem' }}>
              {formatCurrency(position.unrealizedPL)}
            </div>
          </div>
        </Link>
      ))}

      {optionPositions.map((position) => (
        <Link key={position.id} to={`/stock/${position.symbol}?tab=options`} className="row-link">
          <div>
            <div style={{ fontWeight: 700 }}>
              {position.symbol} {position.type.toUpperCase()} {formatCurrency(position.strike, 0)}
            </div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              {position.contracts} contracts · exp {position.expiry}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div>{formatCurrency(position.marketValue)}</div>
            <div className={plClass(position.unrealizedPL)} style={{ fontSize: '0.85rem' }}>
              {formatCurrency(position.unrealizedPL)}
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
