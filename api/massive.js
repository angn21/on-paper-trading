export const config = { runtime: 'edge' };

const MASSIVE_BASES = ['https://api.polygon.io', 'https://api.massive.com'];

function getMassiveKey() {
  return (process.env.MASSIVE_API_KEY || process.env.POLYGON_API_KEY || '').trim();
}

export default async function handler(request) {
  if (request.method !== 'GET') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  const apiKey = getMassiveKey();
  if (!apiKey) {
    return Response.json({ error: 'MASSIVE_API_KEY not configured on server' }, { status: 503 });
  }

  const url = new URL(request.url);
  const massivePath = url.searchParams.get('path') || '';
  if (!massivePath) {
    return Response.json({ error: 'Missing path parameter' }, { status: 400 });
  }

  const cleanPath = massivePath.replace(/^\/+/, '');

  for (const base of MASSIVE_BASES) {
    const massiveUrl = new URL(`${base}/${cleanPath}`);
    url.searchParams.forEach((value, key) => {
      if (key !== 'path') {
        massiveUrl.searchParams.set(key, value);
      }
    });
    massiveUrl.searchParams.set('apiKey', apiKey);

    try {
      const response = await fetch(massiveUrl.toString());
      const body = await response.json();

      if (response.status === 404 && base === MASSIVE_BASES[0]) {
        continue;
      }

      return Response.json(body, { status: response.status });
    } catch {
      if (base === MASSIVE_BASES[MASSIVE_BASES.length - 1]) {
        return Response.json({ error: 'Failed to reach Massive' }, { status: 502 });
      }
    }
  }

  return Response.json({ error: 'Failed to reach Massive' }, { status: 502 });
}
