import { proxyFinnhubRequest } from '../../server/finnhubProxy.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const slug = req.query.slug;
  const path = Array.isArray(slug) ? slug.join('/') : slug || '';

  const params = new URLSearchParams();
  Object.entries(req.query).forEach(([key, value]) => {
    if (key === 'slug' || value == null) return;
    params.set(key, Array.isArray(value) ? value[0] : String(value));
  });

  const result = await proxyFinnhubRequest(path, params);
  return res.status(result.status).json(result.body);
}
