export async function onRequestPost({ request, env }) {
  if (!env.ADMIN_PASSWORD) {
    return Response.json({ error: 'ADMIN_PASSWORD environment variable is not set.' }, { status: 500 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  if (body.password === env.ADMIN_PASSWORD) {
    return Response.json({ ok: true });
  }

  return Response.json({ error: 'Invalid password.' }, { status: 401 });
}
