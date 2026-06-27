import { useEffect, useState } from 'react';

export default function Status() {
  const [health, setHealth] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json())
      .then(setHealth)
      .catch(() => setError('Could not reach /api/health'));
  }, []);

  return (
    <div className="section-gap" style={{ paddingTop: 16 }}>
      <section className="card">
        <h1 style={{ margin: '0 0 8px', fontSize: '1.4rem' }}>System status</h1>
        <p style={{ color: 'var(--text-muted)', marginTop: 0 }}>
          Admin view for API configuration. No secrets are exposed.
        </p>

        {error && <div className="banner banner-warning">{error}</div>}

        {health && (
          <ul className="status-list">
            <li>
              <span>Market data</span>
              <span className={health.marketData === 'configured' ? 'positive' : 'negative'}>
                {health.marketData}
              </span>
            </li>
            <li>
              <span>Finnhub proxy</span>
              <span>{health.finnhub ? '✓' : '✗'}</span>
            </li>
            <li>
              <span>Twelve Data proxy</span>
              <span>{health.twelvedata ? '✓' : '✗'}</span>
            </li>
            <li>
              <span>Cloud accounts (Supabase)</span>
              <span>{health.supabase ? '✓' : '✗'}</span>
            </li>
            <li>
              <span>Account sync</span>
              <span className={health.accounts === 'configured' ? 'positive' : 'negative'}>
                {health.accounts}
              </span>
            </li>
          </ul>
        )}
      </section>
    </div>
  );
}
