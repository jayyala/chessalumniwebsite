import { createRemoteJWKSet, jwtVerify } from 'jose';

const ALUMNI_KEY = 'alumni';
const WHITELIST_KEY = 'whitelist';
const jwksByDomain = new Map();

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
  }
}

export function json(data, init = {}) {
  const headers = new Headers(init.headers || {});
  if (!headers.has('content-type')) {
    headers.set('content-type', 'application/json; charset=utf-8');
  }
  if (!headers.has('cache-control')) {
    headers.set('cache-control', 'no-store');
  }
  return new Response(JSON.stringify(data, null, 2), { ...init, headers });
}

export function errorResponse(error) {
  if (error instanceof HttpError) {
    return json({ error: error.message }, { status: error.status });
  }

  console.error(error);
  return json({ error: 'Internal server error.' }, { status: 500 });
}

export function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function parseList(value) {
  return String(value || '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
}

function parseEmailList(value) {
  return String(value || '')
    .split(',')
    .map(normalizeEmail)
    .filter(Boolean);
}

function ensureKv(env) {
  if (!env.ALUMNI_KV) {
    throw new HttpError(500, 'ALUMNI_KV binding not configured.');
  }
}

async function readList(env, key) {
  ensureKv(env);
  const raw = await env.ALUMNI_KV.get(key);
  if (!raw) {
    return [];
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new HttpError(500, `Stored ${key} data is invalid JSON.`);
  }

  if (!Array.isArray(parsed)) {
    throw new HttpError(500, `Stored ${key} data must be an array.`);
  }

  return parsed;
}

async function writeList(env, key, value) {
  ensureKv(env);
  await env.ALUMNI_KV.put(key, JSON.stringify(value));
}

export async function readAlumni(env) {
  const alumni = await readList(env, ALUMNI_KEY);
  return alumni
    .filter(entry => entry && typeof entry === 'object')
    .map(entry => ({
      id: Number(entry.id) || 0,
      name: String(entry.name || '').trim(),
      email: normalizeEmail(entry.email),
      phone: String(entry.phone || '').trim(),
      graduation_year: Number(entry.graduation_year) || 0,
      notes: String(entry.notes || '').trim(),
      submitted_by: normalizeEmail(entry.submitted_by),
      created_at: String(entry.created_at || '')
    }))
    .filter(entry => entry.id > 0 && entry.name && entry.graduation_year > 0);
}

export async function writeAlumni(env, alumni) {
  await writeList(env, ALUMNI_KEY, alumni);
}

export async function readWhitelist(env) {
  const whitelist = await readList(env, WHITELIST_KEY);
  const seen = new Set();

  return whitelist
    .filter(entry => entry && typeof entry === 'object')
    .map(entry => ({
      email: normalizeEmail(entry.email),
      added_by: normalizeEmail(entry.added_by),
      created_at: String(entry.created_at || '')
    }))
    .filter(entry => {
      if (!entry.email || seen.has(entry.email)) {
        return false;
      }

      seen.add(entry.email);
      return true;
    })
    .sort((a, b) => a.email.localeCompare(b.email));
}

export async function writeWhitelist(env, whitelist) {
  await writeList(
    env,
    WHITELIST_KEY,
    [...whitelist].sort((a, b) => a.email.localeCompare(b.email))
  );
}

function getTeamDomain(env) {
  const raw = String(env.ACCESS_TEAM_DOMAIN || env.TEAM_DOMAIN || '').trim();
  if (!raw) {
    throw new HttpError(500, 'ACCESS_TEAM_DOMAIN environment variable is not set.');
  }

  const value = raw.startsWith('http') ? raw : `https://${raw}`;
  return value.endsWith('/') ? value.slice(0, -1) : value;
}

function getAudiences(env) {
  const audiences = parseList(env.ACCESS_AUDS || env.ACCESS_AUD || env.POLICY_AUD);
  if (!audiences.length) {
    throw new HttpError(500, 'ACCESS_AUD environment variable is not set.');
  }
  return audiences;
}

function getAdminEmails(env) {
  return new Set(parseEmailList(env.ADMIN_EMAILS));
}

function readCookie(request, name) {
  const cookieHeader = request.headers.get('Cookie') || '';

  for (const pair of cookieHeader.split(';')) {
    const [rawName, ...rest] = pair.trim().split('=');
    if (rawName === name) {
      return decodeURIComponent(rest.join('='));
    }
  }

  return '';
}

function getAccessToken(request) {
  return (
    request.headers.get('Cf-Access-Jwt-Assertion') ||
    readCookie(request, 'CF_Authorization')
  );
}

function getJwks(teamDomain) {
  let jwks = jwksByDomain.get(teamDomain);

  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(`${teamDomain}/cdn-cgi/access/certs`));
    jwksByDomain.set(teamDomain, jwks);
  }

  return jwks;
}

export async function getUserContext(request, env) {
  ensureKv(env);

  const teamDomain = getTeamDomain(env);
  const audiences = getAudiences(env);
  const token = getAccessToken(request);

  if (!token) {
    throw new HttpError(
      401,
      'Missing Cloudflare Access token. Protect this route with Access or sign in first.'
    );
  }

  let payload;
  try {
    ({ payload } = await jwtVerify(token, getJwks(teamDomain), {
      issuer: teamDomain,
      audience: audiences.length === 1 ? audiences[0] : audiences
    }));
  } catch (error) {
    console.error('Cloudflare Access JWT verification failed', error);
    throw new HttpError(403, 'Cloudflare Access token could not be verified.');
  }

  const email = normalizeEmail(
    payload.email || request.headers.get('Cf-Access-Authenticated-User-Email')
  );

  if (!email) {
    throw new HttpError(403, 'The Cloudflare Access token does not include an email address.');
  }

  const whitelist = await readWhitelist(env);
  const isAdmin = getAdminEmails(env).has(email);
  const canPost = isAdmin || whitelist.some(entry => entry.email === email);

  return {
    email,
    name: String(payload.name || payload.nickname || payload.given_name || email),
    isAdmin,
    canPost,
    whitelist,
    teamDomain
  };
}

export function requireAdmin(user) {
  if (!user.isAdmin) {
    throw new HttpError(403, 'This account is not allowed to manage the alumni directory.');
  }
}

export function requirePoster(user) {
  if (!user.canPost) {
    throw new HttpError(403, 'This email is not whitelisted to submit alumni information.');
  }
}
