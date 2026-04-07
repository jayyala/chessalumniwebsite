import {
  HttpError,
  errorResponse,
  getUserContext,
  json,
  readAlumni,
  requireAdmin,
  writeAlumni
} from '../../_lib/app.js';

export async function onRequestDelete({ params, request, env }) {
  try {
    const user = await getUserContext(request, env);
    requireAdmin(user);

    const id = Number.parseInt(params.id, 10);
    if (!Number.isInteger(id)) {
      throw new HttpError(400, 'Invalid ID.');
    }

    const alumni = await readAlumni(env);
    const updated = alumni.filter(entry => entry.id !== id);

    if (updated.length === alumni.length) {
      throw new HttpError(404, 'Entry not found.');
    }

    await writeAlumni(env, updated);
    return json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
