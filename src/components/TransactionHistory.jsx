import { usePortfolio } from '../hooks/usePortfolio';
import { formatCurrency, formatDateTime, plClass } from '../lib/formatters';

export default function TransactionHistory() {
  const { transactions } = usePortfolio();

  if (!transactions.length) {
    return <div className="empty-state">Your trades will appear here.</div>;
  }

  return (
    <div>
      {transactions.slice(0, 8).map((tx) => (
        <div key={tx.id} className="row-link">
          <div>
            <div style={{ fontWeight: 700 }}>
              {tx.side.toUpperCase()}{' '}
              {tx.kind === 'option'
                ? `${tx.symbol} ${tx.optionType} ${formatCurrency(tx.strike, 0)}`
                : tx.symbol}
            </div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              {formatDateTime(tx.ts)}
              {tx.kind === 'stock' ? ` · ${tx.shares} shares @ ${formatCurrency(tx.price)}` : ` · ${tx.contracts} contracts @ ${formatCurrency(tx.price)}`}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div>{formatCurrency(tx.total)}</div>
            {tx.realizedPL != null && (
              <div className={plClass(tx.realizedPL)} style={{ fontSize: '0.85rem' }}>
                {formatCurrency(tx.realizedPL)}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
