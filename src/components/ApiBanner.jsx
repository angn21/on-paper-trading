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

      if (health === 'missing' || (mode === 'simulated' && reason === 'no_api_key')) {
        setMessage(
          'Market data server not configured — using simulated prices. Set FINNHUB_API_KEY on the server (see README).',
        );
        return;
      }

      if (mode === 'simulated') {
        setMessage('Live market data unavailable — using simulated prices for now.');
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
