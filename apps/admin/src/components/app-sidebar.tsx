import { Link, useNavigate } from '@tanstack/react-router';
import { Database, LogOut } from 'lucide-react';
import { authClient } from '@/lib/auth-client';
import { RESOURCES } from '@/lib/resources';
import { Button } from '@/components/ui/button';
import type { AdminUser } from '@/lib/server-auth';

export function AppSidebar({ user }: { user: AdminUser }) {
  const navigate = useNavigate();

  async function signOut() {
    await authClient.signOut();
    await navigate({ to: '/login', search: {} });
  }

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r bg-card">
      <div className="flex items-center gap-2 px-4 py-4 text-sm font-semibold">
        <Database className="size-4" />
        getvinyls admin
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2">
        <Link
          to="/"
          activeOptions={{ exact: true }}
          activeProps={{ className: 'bg-accent text-accent-foreground' }}
          className="block rounded-md px-3 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
        >
          Dashboard
        </Link>
        <div className="px-3 pb-1 pt-3 text-xs font-medium uppercase text-muted-foreground">
          Resources
        </div>
        {RESOURCES.map((r) => (
          <Link
            key={r.key}
            to="/resources/$resource"
            params={{ resource: r.key }}
            search={{ page: 1, q: '' }}
            activeProps={{ className: 'bg-accent text-accent-foreground' }}
            className="block rounded-md px-3 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
          >
            {r.label}
          </Link>
        ))}
      </nav>
      <div className="border-t p-3">
        <div className="truncate px-1 pb-2 text-xs text-muted-foreground" title={user.email}>
          {user.email}
        </div>
        <Button variant="outline" size="sm" className="w-full" onClick={signOut}>
          <LogOut className="size-4" />
          Sign out
        </Button>
      </div>
    </aside>
  );
}
