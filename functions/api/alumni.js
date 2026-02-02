function checkAuth(env, request) {
  if (!env.ADMIN_PASSWORD) return false;
  const header = request.headers.get('Authorization');
  return header === 'Bearer ' + env.ADMIN_PASSWORD;
}

async function readAlumni(env) {
  const raw = await env.ALUMNI_KV.get('alumni');
  return raw ? JSON.parse(raw) : [];
}

export async function onRequestGet({ env }) {
  if (!env.ALUMNI_KV) {
    return Response.json({ error: 'ALUMNI_KV binding not configured.' }, { status: 500 });
  }
  return Response.json(await readAlumni(env), {
    headers: { 'Cache-Control': 'no-store' }
  });
}

export async function onRequestPost({ request, env }) {
  if (!env.ALUMNI_KV) {
    return Response.json({ error: 'ALUMNI_KV binding not configured.' }, { status: 500 });
  }
  if (!checkAuth(env, request)) {
    return Response.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const name            = (body.name || '').trim();
  const graduation_year = Number(body.graduation_year);

  if (!name || !graduation_year) {
    return Response.json({ error: 'Name and graduation year are required.' }, { status: 400 });
  }

  const alumni = await readAlumni(env);
  const maxId  = alumni.reduce((m, a) => Math.max(m, a.id), 0);

  const entry = {
    id:               maxId + 1,
    name,
    email:            (body.email || '').trim(),
    phone:            (body.phone || '').trim(),
    graduation_year,
    notes:            (body.notes || '').trim()
  };

  alumni.push(entry);
  await env.ALUMNI_KV.put('alumni', JSON.stringify(alumni));

  return Response.json(entry, { status: 201 });
}
