import { routeAuthRequest } from './auth/handlers.js';

/** Vite dev-server middleware for auth + portfolio API routes. */
export function createAuthMiddleware() {
  return async (req, res, next) => {
    const url = new URL(req.url, 'http://localhost');
    const { pathname } = url;

    if (
      !pathname.startsWith('/api/auth/') &&
      pathname !== '/api/portfolio'
    ) {
      next();
      return;
    }

    try {
      const headers = new Headers();
      Object.entries(req.headers).forEach(([key, value]) => {
        if (value) headers.set(key, Array.isArray(value) ? value.join(', ') : value);
      });

      let body;
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        body = await new Promise((resolve, reject) => {
          const chunks = [];
          req.on('data', (chunk) => chunks.push(chunk));
          req.on('end', () => resolve(Buffer.concat(chunks).toString()));
          req.on('error', reject);
        });
      }

      const request = new Request(`http://localhost${pathname}`, {
        method: req.method,
        headers,
        body: body || undefined,
      });

      const response = await routeAuthRequest(request, pathname);
      if (!response) {
        next();
        return;
      }

      res.statusCode = response.status;
      response.headers.forEach((value, key) => {
        res.setHeader(key, value);
      });
      const text = await response.text();
      res.end(text);
    } catch (error) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: error.message || 'Server error' }));
    }
  };
}
