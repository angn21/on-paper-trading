export const config = { runtime: 'edge' };

export default function handler() {
  const key = (process.env.FINNHUB_API_KEY || process.env.VITE_FINNHUB_API_KEY || '').trim();
  return Response.json({ marketData: key ? 'configured' : 'missing' });
}
