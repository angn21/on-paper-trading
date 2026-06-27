async function parseJson(response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

export async function fetchMe() {
  const response = await fetch('/api/auth/me', { credentials: 'include' });
  const data = await parseJson(response);
  return data.user ?? null;
}

export async function registerAccount({ username, pin, importLocal = false, portfolio = null }) {
  const response = await fetch('/api/auth/register', {
    method: 'POST',
    credentials: 'include',
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
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    credentials: 'include',
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
  await fetch('/api/auth/logout', {
    method: 'POST',
    credentials: 'include',
  });
}

export async function fetchRemotePortfolio() {
  const response = await fetch('/api/portfolio', { credentials: 'include' });
  if (response.status === 401) return null;
  if (!response.ok) throw new Error('Could not load cloud portfolio.');
  return parseJson(response);
}

export async function saveRemotePortfolio(data) {
  const response = await fetch('/api/portfolio', {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data }),
  });
  if (response.status === 401) return false;
  if (!response.ok) throw new Error('Could not save cloud portfolio.');
  return true;
}
