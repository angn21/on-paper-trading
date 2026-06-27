import { useEffect, useState } from 'react';
import { marketData } from '../marketData/marketData';

export default function MarketStatus() {
  const [status, setStatus] = useState(null);

  useEffect(() => {
    marketData.getMarketStatus().then(setStatus).catch(() => null);
  }, []);

  if (!status) return null;

  return (
    <div className={`banner ${status.isOpen ? 'banner-info' : 'banner-warning'}`}>
      <strong>{status.isOpen ? 'Market open' : 'Market closed'}</strong>
      <div>{status.note}</div>
    </div>
  );
}
