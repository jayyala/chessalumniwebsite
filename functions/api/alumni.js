import {
  HttpError,
  errorResponse,
  getUserContext,
  json,
  normalizeEmail,
  readAlumni,
  requirePoster,
  writeAlumni
} from '../_lib/app.js';

function parseGraduationYear(value) {
  const year = Number(value);
  if (!Number.isInteger(year) || year < 1900 || year > 2099) {
    throw new HttpError(400, 'Graduation year must be a valid four-digit year.');
  }
  return year;
}

export async function onRequestGet({ env }) {
  try {
    return json(await readAlumni(env));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function onRequestPost({ request, env }) {
  try {
    const user = await getUserContext(request, env);
    requirePoster(user);

    let body;
    try {
      body = await request.json();
    } catch {
      throw new HttpError(400, 'Invalid request body.');
    }

    const name = String(body.name || '').trim();
    if (!name) {
      throw new HttpError(400, 'Name is required.');
    }

    const alumni = await readAlumni(env);
    const entry = {
      id: alumni.reduce((maxId, alumnus) => Math.max(maxId, alumnus.id), 0) + 1,
      name,
      email: normalizeEmail(body.email),
      phone: String(body.phone || '').trim(),
      graduation_year: parseGraduationYear(body.graduation_year),
      notes: String(body.notes || '').trim(),
      submitted_by: user.email,
      created_at: new Date().toISOString()
    };

    await writeAlumni(env, [...alumni, entry]);
    return json(entry, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
