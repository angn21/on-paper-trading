export const config = { runtime: 'edge' };

export default function handler() {
  const finnhub = Boolean(
    (process.env.FINNHUB_API_KEY || process.env.VITE_FINNHUB_API_KEY || '').trim(),
  );
  const twelvedata = Boolean((process.env.TWELVE_DATA_API_KEY || '').trim());

  return Response.json({
    marketData: finnhub || twelvedata ? 'configured' : 'missing',
    finnhub,
    twelvedata,
  });
}
