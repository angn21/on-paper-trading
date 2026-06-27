import { getFinnhubKey } from '../../server/finnhubProxy.js';

export default function handler(_req, res) {
  const configured = Boolean(getFinnhubKey());
  return res.status(200).json({ marketData: configured ? 'configured' : 'missing' });
}
