import {
  HttpError,
  errorResponse,
  getUserContext,
  json,
  normalizeEmail,
  requireAdmin,
  writeWhitelist
} from '../_lib/app.js';

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function onRequestGet({ request, env }) {
  try {
    const user = await getUserContext(request, env);
    requireAdmin(user);

    return json({
      entries: user.whitelist,
      signed_in_as: user.email
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function onRequestPost({ request, env }) {
  try {
    const user = await getUserContext(request, env);
    requireAdmin(user);

    let body;
    try {
      body = await request.json();
    } catch {
      throw new HttpError(400, 'Invalid request body.');
    }

    const email = normalizeEmail(body.email);
    if (!validateEmail(email)) {
      throw new HttpError(400, 'A valid email address is required.');
    }

    const existing = user.whitelist.find(entry => entry.email === email);
    if (existing) {
      return json({ ok: true, entry: existing, already_whitelisted: true });
    }

    const entry = {
      email,
      added_by: user.email,
      created_at: new Date().toISOString()
    };

    await writeWhitelist(env, [...user.whitelist, entry]);
    return json({ ok: true, entry }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function onRequestDelete({ request, env }) {
  try {
    const user = await getUserContext(request, env);
    requireAdmin(user);

    let body;
    try {
      body = await request.json();
    } catch {
      throw new HttpError(400, 'Invalid request body.');
    }

    const email = normalizeEmail(body.email);
    if (!email) {
      throw new HttpError(400, 'Email is required.');
    }

    const updated = user.whitelist.filter(entry => entry.email !== email);
    if (updated.length === user.whitelist.length) {
      throw new HttpError(404, 'Email not found in whitelist.');
    }

    await writeWhitelist(env, updated);
    return json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
