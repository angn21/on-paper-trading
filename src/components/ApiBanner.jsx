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

      // If live quotes work, don't show the config banner even if /api/health glitches.
      if (health === 'configured' || mode === 'live') {
        if (mode === 'simulated') {
          setMessage('Live market data unavailable — using simulated prices for now.');
        } else {
          setMessage('');
        }
        return;
      }

      if (health === 'missing' || reason === 'no_api_key') {
        setMessage(
          'Market data server not configured — using simulated prices. In Vercel, set FINNHUB_API_KEY for Production and redeploy.',
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
