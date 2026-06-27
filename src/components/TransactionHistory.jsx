import { useState } from 'react';
import { usePortfolio } from '../hooks/usePortfolio';
import { formatCurrency, formatDateTime, plClass } from '../lib/formatters';

export default function TransactionHistory() {
  const { transactions, updateTransactionNote } = usePortfolio();
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState('');

  if (!transactions.length) {
    return <div className="empty-state">Your trades will appear here. Add journal notes when you trade.</div>;
  }

  function startEdit(tx) {
    setEditingId(tx.id);
    setDraft(tx.note || '');
  }

  function saveNote(txId) {
    updateTransactionNote(txId, draft.trim());
    setEditingId(null);
  }

  return (
    <div>
      {transactions.slice(0, 10).map((tx) => (
        <div key={tx.id} className="tx-row">
          <div className="row-link" style={{ padding: '12px 0 4px' }}>
            <div>
            <div style={{ fontWeight: 700 }}>
              {(tx.side === 'short' ? 'SHORT' : tx.side === 'cover' ? 'COVER' : tx.side.toUpperCase())}{' '}
                {tx.kind === 'option'
                  ? `${tx.symbol} ${tx.optionType} ${formatCurrency(tx.strike, 0)}`
                  : tx.symbol}
                {tx.orderType && tx.orderType !== 'market' && (
                  <span className="order-type-badge">{tx.orderType}</span>
                )}
              </div>
              <div className="position-meta">
                {formatDateTime(tx.ts)}
                {tx.kind === 'stock'
                  ? ` · ${tx.shares} shares @ ${formatCurrency(tx.price)}`
                  : ` · ${tx.contracts} contracts @ ${formatCurrency(tx.price)}`}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="tabular">{formatCurrency(tx.total)}</div>
              {tx.realizedPL != null && (
                <div className={`tabular ${plClass(tx.realizedPL)}`} style={{ fontSize: '0.85rem' }}>
                  {formatCurrency(tx.realizedPL)}
                </div>
              )}
            </div>
          </div>

          {editingId === tx.id ? (
            <div className="note-edit">
              <input
                className="input"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Journal note"
                maxLength={120}
              />
              <button type="button" className="btn btn-primary btn-sm" onClick={() => saveNote(tx.id)}>Save</button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditingId(null)}>Cancel</button>
            </div>
          ) : (
            <button type="button" className="note-link" onClick={() => startEdit(tx)}>
              {tx.note ? `📝 ${tx.note}` : '+ Add journal note'}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
