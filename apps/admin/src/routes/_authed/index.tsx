import { Link, createFileRoute } from '@tanstack/react-router';
import { getCounts } from '@/lib/resources-fns';
import { Card, CardContent, CardTitle } from '@/components/ui/card';

export const Route = createFileRoute('/_authed/')({
  loader: () => getCounts(),
  component: Dashboard,
});

function Dashboard() {
  const counts = Route.useLoaderData();
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {counts.map((c) => (
          <Link
            key={c.key}
            to="/resources/$resource"
            params={{ resource: c.key }}
            search={{ page: 1, q: '' }}
          >
            <Card className="transition-colors hover:bg-accent/50">
              <CardContent className="pt-6">
                <CardTitle className="text-3xl">{c.count.toLocaleString()}</CardTitle>
                <p className="pt-1 text-sm text-muted-foreground">{c.label}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
