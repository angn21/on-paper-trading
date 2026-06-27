const FINNHUB_BASE = 'https://finnhub.io/api/v1';

export function getFinnhubKey() {
  return (process.env.FINNHUB_API_KEY || process.env.VITE_FINNHUB_API_KEY || '').trim();
}

export async function proxyFinnhubRequest(path, queryParams) {
  const token = getFinnhubKey();
  if (!token) {
    return {
      status: 503,
      body: { error: 'FINNHUB_API_KEY not configured on server' },
    };
  }

  const cleanPath = path.replace(/^\/+/, '');
  const url = new URL(`${FINNHUB_BASE}/${cleanPath}`);

  queryParams.forEach((value, key) => {
    if (key !== 'slug' && key !== 'path') {
      url.searchParams.set(key, value);
    }
  });
  url.searchParams.set('token', token);

  const response = await fetch(url.toString());
  let body;
  try {
    body = await response.json();
  } catch {
    body = { error: 'Invalid response from Finnhub' };
  }

  return { status: response.status, body };
}
