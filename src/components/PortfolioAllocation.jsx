import { formatPercent } from '../lib/formatters';
import GlossaryTip from './GlossaryTip';

export default function PortfolioAllocation({ allocation }) {
  if (!allocation) return null;

  const items = [
    { label: 'Stocks', pct: allocation.stocks, color: 'var(--accent)' },
    { label: 'Options', pct: allocation.options, color: '#5ac8fa' },
    { label: 'Cash', pct: allocation.cash, color: 'var(--text-muted)' },
  ];

  return (
    <div className="card">
      <h2 className="card-title">Allocation</h2>
      <div className="allocation-bar">
        {items.map((item) => (
          <div
            key={item.label}
            className="allocation-segment"
            style={{ width: `${Math.max(item.pct, 0)}%`, background: item.color }}
            title={`${item.label} ${formatPercent(item.pct, 0)}`}
          />
        ))}
      </div>
      <div className="allocation-legend">
        {items.map((item) => (
          <span key={item.label}>
            {item.label} {formatPercent(item.pct, 0)}
          </span>
        ))}
      </div>
      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '8px 0 0' }}>
        <GlossaryTip term="unrealizedPL">Unrealized P/L</GlossaryTip> is not included in allocation weights.
      </p>
    </div>
  );
}
