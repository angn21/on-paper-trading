import { hashPin, verifyPin } from './pin.js';
import { getSupabase, isSupabaseConfigured } from './supabase.js';
import {
  buildSessionCookie,
  createSessionToken,
  getUserFromRequest,
} from './session.js';
import {
  defaultPortfolioState,
  displayUsername,
  normalizeUsername,
  sanitizePortfolioState,
  validatePin,
  validateUsername,
} from './portfolioState.js';

function json(data, status = 200, extraHeaders = {}) {
  return Response.json(data, { status, headers: extraHeaders });
}

function methodNotAllowed() {
  return json({ error: 'Method not allowed' }, 405);
}

function notConfigured() {
  return json({ error: 'Account sync is not configured on the server.' }, 503);
}

function invalidCredentials() {
  return json({ error: 'Invalid username or PIN.' }, 401);
}

async function readJsonBody(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export async function handleRegister(request) {
  if (request.method !== 'POST') return methodNotAllowed();
  if (!isSupabaseConfigured()) return notConfigured();

  const body = await readJsonBody(request);
  const username = displayUsername(body?.username);
  const pin = body?.pin;
  const importLocal = Boolean(body?.importLocal);

  if (!validateUsername(username)) {
    return json({
      error: 'Username must be 3–20 characters (letters, numbers, underscore only).',
    }, 400);
  }

  if (!validatePin(pin)) {
    return json({ error: 'PIN must be 4–6 digits.' }, 400);
  }

  const usernameLower = normalizeUsername(username);
  const pinHash = await hashPin(pin);
  const supabase = getSupabase();

  const { data: profile, error } = await supabase
    .from('profiles')
    .insert({
      username,
      username_lower: usernameLower,
      pin_hash: pinHash,
    })
    .select('id, username')
    .single();

  if (error) {
    if (error.code === '23505') {
      return json({ error: 'That username is already taken. Try another or sign in.' }, 409);
    }
    return json({ error: 'Could not create account. Please try again.' }, 500);
  }

  const portfolioData = importLocal && body?.portfolio
    ? sanitizePortfolioState(body.portfolio)
    : { ...defaultPortfolioState };

  const { error: portfolioError } = await supabase.from('portfolios').insert({
    user_id: profile.id,
    data: portfolioData,
  });

  if (portfolioError) {
    console.error('portfolio insert on register failed:', portfolioError);
  }

  const token = await createSessionToken(profile.id, profile.username);

  return json(
    { ok: true, user: { id: profile.id, username: profile.username } },
    200,
    { 'Set-Cookie': buildSessionCookie(token) },
  );
}

export async function handleLogin(request) {
  if (request.method !== 'POST') return methodNotAllowed();
  if (!isSupabaseConfigured()) return notConfigured();

  const body = await readJsonBody(request);
  const usernameLower = normalizeUsername(body?.username);
  const pin = body?.pin;

  if (!usernameLower || !validatePin(pin)) {
    return invalidCredentials();
  }

  const supabase = getSupabase();
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, username, pin_hash')
    .eq('username_lower', usernameLower)
    .maybeSingle();

  if (error || !profile) {
    return invalidCredentials();
  }

  const valid = await verifyPin(pin, profile.pin_hash);
  if (!valid) {
    return invalidCredentials();
  }

  const token = await createSessionToken(profile.id, profile.username);

  return json(
    { ok: true, user: { id: profile.id, username: profile.username } },
    200,
    { 'Set-Cookie': buildSessionCookie(token) },
  );
}

export async function handleLogout(request) {
  if (request.method !== 'POST') return methodNotAllowed();

  return json(
    { ok: true },
    200,
    { 'Set-Cookie': buildSessionCookie('', { clear: true }) },
  );
}

export async function handleMe(request) {
  if (request.method !== 'GET') return methodNotAllowed();
  if (!isSupabaseConfigured()) return json({ user: null });

  const session = await getUserFromRequest(request);
  if (!session) return json({ user: null });

  return json({ user: { id: session.userId, username: session.username } });
}

export async function handlePortfolio(request) {
  if (!isSupabaseConfigured()) return notConfigured();

  const session = await getUserFromRequest(request);
  if (!session) return json({ error: 'Not signed in.' }, 401);

  const supabase = getSupabase();

  if (request.method === 'GET') {
    const { data, error } = await supabase
      .from('portfolios')
      .select('data, updated_at')
      .eq('user_id', session.userId)
      .maybeSingle();

    if (error) {
      return json({ error: 'Could not load portfolio.' }, 500);
    }

    return json({
      data: sanitizePortfolioState(data?.data || defaultPortfolioState),
      updatedAt: data?.updated_at || null,
    });
  }

  if (request.method === 'PUT') {
    const body = await readJsonBody(request);
    const portfolio = sanitizePortfolioState(body?.data);

    const { data, error } = await supabase
      .from('portfolios')
      .upsert(
        {
          user_id: session.userId,
          data: portfolio,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' },
      )
      .select('updated_at')
      .single();

    if (error) {
      console.error('portfolio save failed:', error);
      return json({ error: 'Could not save portfolio.', detail: error.message }, 500);
    }

    return json({ ok: true, updatedAt: data.updated_at });
  }

  return methodNotAllowed();
}

export async function routeAuthRequest(request, pathname) {
  if (pathname === '/api/auth/register') return handleRegister(request);
  if (pathname === '/api/auth/login') return handleLogin(request);
  if (pathname === '/api/auth/logout') return handleLogout(request);
  if (pathname === '/api/auth/me') return handleMe(request);
  if (pathname === '/api/portfolio') return handlePortfolio(request);
  return null;
}
