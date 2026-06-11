import { createServerFn } from '@tanstack/react-start';

// Client-reachable auth boundary. This file is imported by route components (_authed.tsx) and other
// server-function modules, so it must NOT statically import anything server-only (auth/Prisma) and
// must NOT bridge to server code through a plain function: import-protection traces dynamic import()
// edges too. The only safe boundary is a createServerFn handler, whose body the compiler strips from
// the client bundle. So all session work lives in session-server.ts, pulled in via import() INSIDE
// the handler below. Data functions assert admin the same way (see resources-fns.ts).

// A serializable view of the signed-in admin, safe to return across the server/client boundary.
export type AdminUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  image: string | null;
};

// Server fn for route beforeLoad and the layout: returns the admin user, or null when the caller is
// not a signed-in admin.
export const getAdminUser = createServerFn({ method: 'GET' }).handler(
  async (): Promise<AdminUser | null> => {
    const { readAdminUser } = await import('./session-server');
    return readAdminUser();
  },
);
