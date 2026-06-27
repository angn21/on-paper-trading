import { SignJWT, jwtVerify } from 'jose';

export const SESSION_COOKIE = 'op_session';
const MAX_AGE_SEC = 30 * 24 * 60 * 60;

function getSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error('SESSION_SECRET must be at least 16 characters');
  }
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(userId, username) {
  return new SignJWT({ sub: userId, username })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SEC}s`)
    .sign(getSecret());
}

export async function verifySessionToken(token) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (!payload.sub) return null;
    return {
      userId: payload.sub,
      username: payload.username,
    };
  } catch {
    return null;
  }
}

export function buildSessionCookie(token, { clear = false } = {}) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  if (clear) {
    return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
  }
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${MAX_AGE_SEC}${secure}`;
}

export function readSessionCookie(cookieHeader) {
  if (!cookieHeader) return null;
  const parts = cookieHeader.split(';').map((part) => part.trim());
  for (const part of parts) {
    if (part.startsWith(`${SESSION_COOKIE}=`)) {
      return decodeURIComponent(part.slice(SESSION_COOKIE.length + 1));
    }
  }
  return null;
}

export async function getUserFromRequest(request) {
  const cookieHeader = request.headers.get('cookie') || request.headers.cookie;
  const token = readSessionCookie(cookieHeader);
  return verifySessionToken(token);
}
