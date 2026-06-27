import { getFinnhubKey } from '../_lib/finnhubProxy.js';

export default function handler(_req, res) {
  const configured = Boolean(getFinnhubKey());
  res.status(200).json({ marketData: configured ? 'configured' : 'missing' });
}
