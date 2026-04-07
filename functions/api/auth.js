import { errorResponse, getUserContext, json } from '../_lib/app.js';

export async function onRequestGet({ request, env }) {
  try {
    const user = await getUserContext(request, env);

    return json({
      auth_provider: 'cloudflare-access',
      user: {
        email: user.email,
        name: user.name
      },
      permissions: {
        is_admin: user.isAdmin,
        can_post: user.canPost
      }
    });
  } catch (error) {
    return errorResponse(error);
  }
}
