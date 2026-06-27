/**
 * Vite dev-server middleware for Twelve Data API proxy.
 */
export function createTwelveDataMiddleware() {
  const TWELVE_DATA_BASE = 'https://api.twelvedata.com';

  return async (req, res, next) => {
    if (!req.url?.startsWith('/api/twelvedata')) {
      next();
      return;
    }

    if (req.method !== 'GET') {
      res.statusCode = 405;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Method not allowed' }));
      return;
    }

    const apiKey = (process.env.TWELVE_DATA_API_KEY || '').trim();
    if (!apiKey) {
      res.statusCode = 503;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'TWELVE_DATA_API_KEY not configured on server' }));
      return;
    }

    try {
      const requestUrl = new URL(req.url, 'http://localhost');
      const endpoint = requestUrl.searchParams.get('endpoint') || 'time_series';
      const tdUrl = new URL(`${TWELVE_DATA_BASE}/${endpoint.replace(/^\/+/, '')}`);

      requestUrl.searchParams.forEach((value, key) => {
        if (key !== 'endpoint') {
          tdUrl.searchParams.set(key, value);
        }
      });
      tdUrl.searchParams.set('apikey', apiKey);

      const response = await fetch(tdUrl.toString());
      const body = await response.json();

      res.statusCode = response.status;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(body));
    } catch (error) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: error.message || 'Proxy error' }));
    }
  };
}
