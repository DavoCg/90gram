import { Link, createFileRoute } from '@tanstack/react-router';
import { getResourceRow } from '@/lib/resources-fns';
import { formatCell } from '@/lib/format';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export const Route = createFileRoute('/_authed/resources/$resource/$id')({
  loader: ({ params }) => getResourceRow({ data: { resource: params.resource, id: params.id } }),
  component: DetailPage,
});

function DetailPage() {
  const data = Route.useLoaderData();
  const { resource, id } = Route.useParams();

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link
          to="/resources/$resource"
          params={{ resource }}
          search={{ page: 1, q: '' }}
          className={buttonVariants({ variant: 'outline', size: 'sm' })}
        >
          Back to {data.label}
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-mono text-base">
            {data.label} / {id}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.row === null ? (
            <p className="text-sm text-muted-foreground">Not found.</p>
          ) : (
            <dl className="divide-y">
              {Object.entries(data.row).map(([key, value]) => (
                <div key={key} className="grid grid-cols-3 gap-4 py-2">
                  <dt className="text-sm font-medium text-muted-foreground">{key}</dt>
                  <dd className="col-span-2 break-all font-mono text-xs">{formatCell(value)}</dd>
                </div>
              ))}
            </dl>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
