import { useMemo, useState } from 'react';
import { computeGreeks } from '../lib/blackScholes';
import { usePortfolio } from '../hooks/usePortfolio';
import { useTradeFeedback } from '../hooks/useTradeFeedback';
import { formatCurrency } from '../lib/formatters';
import GlossaryTip from './GlossaryTip';

function daysToExpiry(expiryStr) {
  const expiry = new Date(expiryStr);
  return Math.max((expiry - Date.now()) / (365.25 * 24 * 3600 * 1000), 1 / 365);
}

export default function OptionsTradePanel({ contract, sigma = 0.3, underlyingPrice, liveGreeks = false }) {
  const { cash, options, buyOption, sellOption } = usePortfolio();
  const onTrade = useTradeFeedback();
  const [side, setSide] = useState('buy');
  const [contracts, setContracts] = useState('1');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  const owned = options.find(
    (item) =>
      item.symbol === contract.symbol &&
      item.type === contract.type &&
      item.strike === contract.strike &&
      item.expiry === contract.expiry,
  );

  const ownedCount = owned?.contracts || 0;
  const qty = Number(contracts) || 0;
  const total = useMemo(() => qty * contract.mid * 100, [contract.mid, qty]);

  const greeks = useMemo(() => {
    if (liveGreeks && contract.greeks) {
      return {
        delta: contract.greeks.delta ?? 0,
        gamma: contract.greeks.gamma ?? 0,
        theta: contract.greeks.theta ?? 0,
        vega: contract.greeks.vega ?? 0,
      };
    }
    const T = daysToExpiry(contract.expiry);
    const S = underlyingPrice || contract.strike;
    return computeGreeks(S, contract.strike, T, sigma, 0.045, contract.type);
  }, [contract, liveGreeks, sigma, underlyingPrice]);

  function setMaxSell() {
    if (ownedCount) setContracts(String(ownedCount));
  }

  function submit() {
    setError('');
    const result =
      side === 'buy'
        ? buyOption(contract, contracts, contract.mid, note.trim())
        : sellOption(owned?.id, contracts, contract.mid, note.trim());

    if (!result.ok) {
      setError(result.error);
      return;
    }

    onTrade(result);
    if (side === 'sell' && ownedCount - qty > 0) {
      setContracts('1');
    }
    setNote('');
  }

  return (
    <div className="card">
      <h3 className="options-trade-title">
        {contract.symbol} {contract.type.toUpperCase()} {formatCurrency(contract.strike, 0)} · {contract.expiry}
      </h3>

      <div className="greeks-row">
        <span><GlossaryTip term="delta">Δ</GlossaryTip> {greeks.delta.toFixed(3)}</span>
        <span><GlossaryTip term="theta">Θ</GlossaryTip> {greeks.theta.toFixed(3)}</span>
        <span><GlossaryTip term="vega">ν</GlossaryTip> {greeks.vega.toFixed(3)}</span>
      </div>

      <div className="pill-group" style={{ marginBottom: 16 }}>
        <button type="button" className={side === 'buy' ? 'pill active' : 'pill'} onClick={() => setSide('buy')}>
          Buy
        </button>
        <button type="button" className={side === 'sell' ? 'pill active' : 'pill'} onClick={() => setSide('sell')}>
          Sell
        </button>
      </div>

      <label className="field">
        <span>Contracts {side === 'sell' && ownedCount ? `(max ${ownedCount})` : ''}</span>
        <div className="input-with-action">
          <input className="input" type="number" min="0" step="1" value={contracts} onChange={(e) => setContracts(e.target.value)} />
          {side === 'sell' && ownedCount > 1 && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={setMaxSell}>All</button>
          )}
        </div>
      </label>

      <label className="field">
        <span>Journal note (optional)</span>
        <input className="input" type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Thesis for this trade" maxLength={120} />
      </label>

      <div className="trade-summary">
        <div>
          <div className="stat-label">Cash available</div>
          <div className="tabular">{formatCurrency(cash)}</div>
        </div>
        <div>
          <div className="stat-label">Contracts owned</div>
          <div className="tabular">{ownedCount}</div>
        </div>
        <div>
          <div className="stat-label"><GlossaryTip term="premium">{liveGreeks ? 'Quote mid' : 'Model mid'}</GlossaryTip></div>
          <div className="tabular">{formatCurrency(contract.mid)}</div>
        </div>
        <div>
          <div className="stat-label">Est. total</div>
          <div className="tabular">{formatCurrency(total)}</div>
        </div>
      </div>

      {side === 'sell' && ownedCount > 0 && qty > 0 && qty < ownedCount && (
        <p className="partial-sell-hint">
          Partial sell — {ownedCount - qty} contract(s) will remain open.
        </p>
      )}

      <button
        type="button"
        className={`btn ${side === 'buy' ? 'btn-primary' : 'btn-danger'}`}
        style={{ width: '100%', marginTop: 16 }}
        onClick={submit}
        disabled={qty <= 0 || (side === 'sell' && (!owned || qty > ownedCount))}
      >
        {side === 'buy' ? 'Buy' : 'Sell'} option
      </button>

      {error && <div className="trade-error">{error}</div>}
    </div>
  );
}
