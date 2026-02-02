function checkAuth(env, request) {
  if (!env.ADMIN_PASSWORD) return false;
  const header = request.headers.get('Authorization');
  return header === 'Bearer ' + env.ADMIN_PASSWORD;
}

export async function onRequestDelete({ params, request, env }) {
  if (!env.ALUMNI_KV) {
    return Response.json({ error: 'ALUMNI_KV binding not configured.' }, { status: 500 });
  }
  if (!checkAuth(env, request)) {
    return Response.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const id = parseInt(params.id, 10);
  if (isNaN(id)) {
    return Response.json({ error: 'Invalid ID.' }, { status: 400 });
  }

  const raw     = await env.ALUMNI_KV.get('alumni');
  const alumni  = raw ? JSON.parse(raw) : [];
  const updated = alumni.filter(a => a.id !== id);

  if (updated.length === alumni.length) {
    return Response.json({ error: 'Entry not found.' }, { status: 404 });
  }

  await env.ALUMNI_KV.put('alumni', JSON.stringify(updated));
  return Response.json({ ok: true });
}
