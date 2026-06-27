import { useState } from 'react';
import { usePortfolio } from '../hooks/usePortfolio';

export default function PortfolioActions() {
  const { resetPortfolio } = usePortfolio();
  const [showReset, setShowReset] = useState(false);

  function handleReset() {
    if (!window.confirm('Reset portfolio to $100,000? This cannot be undone.')) return;
    resetPortfolio();
    setShowReset(false);
  }

  return (
    <>
      {!showReset ? (
        <button type="button" className="btn btn-ghost" onClick={() => setShowReset(true)}>
          Reset portfolio…
        </button>
      ) : (
        <div className="reset-confirm">
          <p>Start fresh with $100,000 paper money? Positions, watchlist, and trade history will be cleared.</p>
          <div className="actions-row">
            <button type="button" className="btn btn-danger btn-sm" onClick={handleReset}>Yes, reset</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowReset(false)}>Cancel</button>
          </div>
        </div>
      )}
    </>
  );
}
