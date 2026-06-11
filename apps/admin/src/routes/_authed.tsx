import { Outlet, createFileRoute, redirect } from '@tanstack/react-router';
import { getAdminUser } from '@/lib/server-auth';
import { AppSidebar } from '@/components/app-sidebar';

// Pathless layout guarding every data route. beforeLoad resolves the admin session server-side and
// bounces non-admins to /login. The resolved user is put on the route context for child routes.
export const Route = createFileRoute('/_authed')({
  beforeLoad: async () => {
    const user = await getAdminUser();
    if (!user) throw redirect({ to: '/login', search: {} });
    return { user };
  },
  component: AuthedLayout,
});

function AuthedLayout() {
  const { user } = Route.useRouteContext();
  return (
    <div className="flex min-h-screen">
      <AppSidebar user={user} />
      <main className="flex-1 overflow-x-hidden p-6">
        <Outlet />
      </main>
    </div>
  );
}
