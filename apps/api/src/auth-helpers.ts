import type { Context } from 'hono';
import { auth } from './auth.js';

// Shared helpers for the authenticated write surfaces (favorites, settings, profile, follows,
// collections). Each handler resolves the better-auth session from the request headers; the mobile
// client forwards the session cookie, so these authenticate without a CORS change.

// Resolve the signed-in user id, or null when the request carries no valid session.
export async function getUserId(c: Context): Promise<string | null> {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  return session?.user.id ?? null;
}

// The standard 401 body, typed against ErrorSchema.
export const unauthorized = { error: 'unauthorized', message: 'Sign in required' } as const;
