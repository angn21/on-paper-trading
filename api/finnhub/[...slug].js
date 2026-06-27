export const config = { runtime: 'edge' };

const FINNHUB_BASE = 'https://finnhub.io/api/v1';

export default async function handler(request) {
  if (request.method !== 'GET') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  const token = (process.env.FINNHUB_API_KEY || process.env.VITE_FINNHUB_API_KEY || '').trim();
  if (!token) {
    return Response.json({ error: 'FINNHUB_API_KEY not configured on server' }, { status: 503 });
  }

  const url = new URL(request.url);
  const finnhubPath = url.pathname.replace(/^\/api\/finnhub\/?/, '');

  const finnhubUrl = new URL(`${FINNHUB_BASE}/${finnhubPath}`);
  url.searchParams.forEach((value, key) => {
    finnhubUrl.searchParams.set(key, value);
  });
  finnhubUrl.searchParams.set('token', token);

  try {
    const response = await fetch(finnhubUrl.toString());
    const body = await response.json();
    return Response.json(body, { status: response.status });
  } catch {
    return Response.json({ error: 'Failed to reach Finnhub' }, { status: 502 });
  }
}
