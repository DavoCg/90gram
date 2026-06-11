import { getRequest } from '@tanstack/react-start/server';
import { redirect } from '@tanstack/react-router';
import { auth } from './auth';
import type { AdminUser } from './server-auth';

// Server-only session helpers. This module statically imports `auth` (which pulls in Prisma), so it
// must ONLY be reached through a dynamic import() inside a server-function handler, never statically
// from a client-reachable module. Keeping it isolated is what lets TanStack Start's import-protection
// pass (Prisma stays out of the client bundle). See server-auth.ts / resources-fns.ts.

function toAdminUser(user: {
  id: string;
  email: string;
  name: string;
  role?: string | null;
  image?: string | null;
}): AdminUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role ?? 'user',
    image: user.image ?? null,
  };
}

async function readSession() {
  return auth.api.getSession({ headers: getRequest().headers });
}

// Returns the signed-in admin, or null when the caller is not a signed-in admin.
export async function readAdminUser(): Promise<AdminUser | null> {
  const session = await readSession();
  const user = session?.user;
  if (!user || user.role !== 'admin') return null;
  return toAdminUser(user);
}

// Returns the admin, or throws a redirect to /login. Used to gate data access.
export async function assertAdmin(): Promise<AdminUser> {
  const session = await readSession();
  const user = session?.user;
  if (!user) throw redirect({ to: '/login', search: {} });
  if (user.role !== 'admin') throw redirect({ to: '/login', search: { error: 'forbidden' } });
  return toAdminUser(user);
}
