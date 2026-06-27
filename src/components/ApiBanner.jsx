import { useEffect, useState } from 'react';
import { checkMarketDataHealth, marketData } from '../marketData/marketData';

export default function ApiBanner() {
  const [message, setMessage] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function updateBanner() {
      const health = await checkMarketDataHealth();
      if (cancelled) return;

      const mode = marketData.getMode();
      const reason = marketData.getFailureReason();

      if (health.status === 'missing') {
        setMessage(
          'Market data server not configured. Set FINNHUB_API_KEY and TWELVE_DATA_API_KEY on the server (see README).',
        );
        return;
      }

      if (!health.finnhub && mode === 'simulated') {
        setMessage('Finnhub not configured — quotes may use simulated prices.');
        return;
      }

      if (!health.twelvedata) {
        setMessage('Twelve Data not configured — charts may be approximate. Add TWELVE_DATA_API_KEY to enable live charts.');
        return;
      }

      if (mode === 'simulated') {
        setMessage('Live quotes unavailable — using simulated prices for now.');
        return;
      }

      setMessage('');
    }

    updateBanner();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!message) return null;

  return <div className="banner banner-warning">{message}</div>;
}
