async function parseJson(response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

async function authFetch(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);

  try {
    return await fetch(url, {
      ...options,
      credentials: 'include',
      signal: controller.signal,
    });
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('Request timed out. Please try again.');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchMe() {
  const response = await authFetch('/api/auth/me');
  const data = await parseJson(response);
  return data.user ?? null;
}

export async function registerAccount({ username, pin, importLocal = false, portfolio = null }) {
  const response = await authFetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, pin, importLocal, portfolio }),
  });
  const data = await parseJson(response);
  if (!response.ok) {
    throw new Error(data.error || 'Registration failed.');
  }
  return data.user;
}

export async function loginAccount({ username, pin }) {
  const response = await authFetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, pin }),
  });
  const data = await parseJson(response);
  if (!response.ok) {
    throw new Error(data.error || 'Sign in failed.');
  }
  return data.user;
}

export async function logoutAccount() {
  await authFetch('/api/auth/logout', { method: 'POST' });
}

export async function fetchRemotePortfolio() {
  const response = await authFetch('/api/portfolio');
  if (response.status === 401) return null;
  if (!response.ok) throw new Error('Could not load cloud portfolio.');
  return parseJson(response);
}

export async function saveRemotePortfolio(data) {
  const response = await authFetch('/api/portfolio', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data }),
  });
  if (response.status === 401) return false;
  if (!response.ok) throw new Error('Could not save cloud portfolio.');
  return true;
}
