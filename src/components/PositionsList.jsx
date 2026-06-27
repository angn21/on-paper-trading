import { Link } from 'react-router-dom';
import { usePortfolio } from '../hooks/usePortfolio';
import { formatCurrency, formatShares, plClass } from '../lib/formatters';
import { getSector } from '../lib/sectors';
import Sparkline from './Sparkline';

export default function PositionsList() {
  const { stockPositions, optionPositions, priceHistory } = usePortfolio();

  return (
    <div>
      {stockPositions.map((position) => (
        <Link key={position.symbol} to={`/stock/${position.symbol}`} className="row-link position-row">
          <div className="position-row-main">
            <div>
              <div className="position-symbol">{position.symbol}</div>
              <div className="position-meta">
                {getSector(position.symbol)}
                {' · '}
                {position.isShort
                  ? `Short ${formatShares(Math.abs(position.shares))}`
                  : `${formatShares(position.shares)} long`}
                {' · avg '}
                {formatCurrency(position.avgCost)}
              </div>
            </div>
            <Sparkline prices={priceHistory[position.symbol]} />
          </div>
          <div className="position-row-values">
            <div className="tabular">{formatCurrency(position.marketValue)}</div>
            <div className={`tabular ${plClass(position.unrealizedPL)}`} style={{ fontSize: '0.85rem' }}>
              {formatCurrency(position.unrealizedPL)}
            </div>
          </div>
        </Link>
      ))}

      {optionPositions.map((position) => (
        <Link key={position.id} to={`/stock/${position.symbol}?tab=options`} className="row-link position-row">
          <div>
            <div className="position-symbol">
              {position.symbol} {position.type.toUpperCase()} {formatCurrency(position.strike, 0)}
            </div>
            <div className="position-meta">
              {position.contracts} contracts · exp {position.expiry}
              {position.markSource === 'eod' ? ' · EOD + Δ adj' : position.markSource === 'model' ? ' · Model' : ''}
            </div>
          </div>
          <div className="position-row-values">
            <div className="tabular">{formatCurrency(position.marketValue)}</div>
            <div className={`tabular ${plClass(position.unrealizedPL)}`} style={{ fontSize: '0.85rem' }}>
              {formatCurrency(position.unrealizedPL)}
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
