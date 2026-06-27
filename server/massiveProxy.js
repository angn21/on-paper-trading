const MASSIVE_BASES = ['https://api.polygon.io', 'https://api.massive.com'];

export function getMassiveKey() {
  return (process.env.MASSIVE_API_KEY || process.env.POLYGON_API_KEY || '').trim();
}

export async function proxyMassiveRequest(path, queryParams) {
  const apiKey = getMassiveKey();
  if (!apiKey) {
    return {
      status: 503,
      body: { error: 'MASSIVE_API_KEY not configured on server' },
    };
  }

  const cleanPath = path.replace(/^\/+/, '');
  let lastError = null;

  for (const base of MASSIVE_BASES) {
    const url = new URL(`${base}/${cleanPath}`);

    queryParams.forEach((value, key) => {
      if (key !== 'slug' && key !== 'path') {
        url.searchParams.set(key, value);
      }
    });
    url.searchParams.set('apiKey', apiKey);

    try {
      const response = await fetch(url.toString());
      let body;
      try {
        body = await response.json();
      } catch {
        body = { error: 'Invalid response from Massive' };
      }

      if (response.status === 404 && base === MASSIVE_BASES[0]) {
        lastError = { status: response.status, body };
        continue;
      }

      return { status: response.status, body };
    } catch (error) {
      lastError = {
        status: 502,
        body: { error: error.message || 'Failed to reach Massive' },
      };
    }
  }

  return lastError || {
    status: 502,
    body: { error: 'Failed to reach Massive' },
  };
}
