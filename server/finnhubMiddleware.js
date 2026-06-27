import { proxyFinnhubRequest } from './finnhubProxy.js';

/**
 * Vite dev-server middleware — mirrors the Vercel /api/finnhub route locally.
 */
export function createFinnhubMiddleware() {
  return async (req, res, next) => {
    if (!req.url?.startsWith('/api/finnhub')) {
      next();
      return;
    }

    if (req.method !== 'GET') {
      res.statusCode = 405;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Method not allowed' }));
      return;
    }

    try {
      const requestUrl = new URL(req.url, 'http://localhost');
      const path = requestUrl.pathname.replace(/^\/api\/finnhub\/?/, '');
      const params = new URLSearchParams(requestUrl.searchParams);
      const result = await proxyFinnhubRequest(path, params);

      res.statusCode = result.status;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(result.body));
    } catch (error) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: error.message || 'Proxy error' }));
    }
  };
}

export function createHealthMiddleware() {
  return (req, res, next) => {
    if (req.url !== '/api/health') {
      next();
      return;
    }

    const configured = Boolean(
      (process.env.FINNHUB_API_KEY || process.env.VITE_FINNHUB_API_KEY || '').trim(),
    );

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ marketData: configured ? 'configured' : 'missing' }));
  };
}
