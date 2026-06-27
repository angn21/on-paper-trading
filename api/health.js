export const config = { runtime: 'edge' };

export default function handler() {
  const finnhub = Boolean(
    (process.env.FINNHUB_API_KEY || process.env.VITE_FINNHUB_API_KEY || '').trim(),
  );
  const twelvedata = Boolean((process.env.TWELVE_DATA_API_KEY || '').trim());
  const massive = Boolean(
    (process.env.MASSIVE_API_KEY || process.env.POLYGON_API_KEY || '').trim(),
  );
  const supabase = Boolean(
    process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
  const session = Boolean((process.env.SESSION_SECRET || '').trim().length >= 16);

  return Response.json({
    marketData: finnhub || twelvedata || massive ? 'configured' : 'missing',
    finnhub,
    twelvedata,
    massive,
    supabase,
    accounts: supabase && session ? 'configured' : 'missing',
  });
}
