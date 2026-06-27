export const config = { runtime: 'edge' };

const TWELVE_DATA_BASE = 'https://api.twelvedata.com';

export default async function handler(request) {
  if (request.method !== 'GET') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  const apiKey = (process.env.TWELVE_DATA_API_KEY || '').trim();
  if (!apiKey) {
    return Response.json({ error: 'TWELVE_DATA_API_KEY not configured on server' }, { status: 503 });
  }

  const url = new URL(request.url);
  const endpoint = url.searchParams.get('endpoint') || 'time_series';
  const tdUrl = new URL(`${TWELVE_DATA_BASE}/${endpoint.replace(/^\/+/, '')}`);

  url.searchParams.forEach((value, key) => {
    if (key !== 'endpoint') {
      tdUrl.searchParams.set(key, value);
    }
  });
  tdUrl.searchParams.set('apikey', apiKey);

  try {
    const response = await fetch(tdUrl.toString());
    const body = await response.json();
    return Response.json(body, { status: response.status });
  } catch {
    return Response.json({ error: 'Failed to reach Twelve Data' }, { status: 502 });
  }
}
