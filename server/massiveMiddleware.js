import { proxyMassiveRequest } from './massiveProxy.js';

/**
 * Vite dev-server middleware — mirrors the Vercel /api/massive route locally.
 */
export function createMassiveMiddleware() {
  return async (req, res, next) => {
    if (!req.url?.startsWith('/api/massive')) {
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
      const path = requestUrl.searchParams.get('path') || '';
      const params = new URLSearchParams(requestUrl.searchParams);
      params.delete('path');
      const result = await proxyMassiveRequest(path, params);

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
