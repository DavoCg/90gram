import { Link, createFileRoute, useNavigate, useRouter } from '@tanstack/react-router';
import { useState } from 'react';
import { z } from 'zod';
import { listResource, setResourceFlag } from '@/lib/resources-fns';
import { formatCell } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const flagSchema = z.enum(['all', 'on', 'off']);

export const Route = createFileRoute('/_authed/resources/$resource')({
  validateSearch: z.object({
    page: z.number().int().min(1).catch(1).default(1),
    q: z.string().catch('').default(''),
    flag: flagSchema.catch('all').default('all'),
  }),
  loaderDeps: ({ search }) => ({ page: search.page, q: search.q, flag: search.flag }),
  loader: ({ params, deps }) =>
    listResource({
      data: { resource: params.resource, page: deps.page, q: deps.q, flag: deps.flag },
    }),
  component: ListPage,
});

function ListPage() {
  const data = Route.useLoaderData();
  const { resource } = Route.useParams();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const router = useRouter();
  const [term, setTerm] = useState(search.q);
  const [busyId, setBusyId] = useState<string | null>(null);

  const totalPages = Math.max(1, Math.ceil(data.total / data.pageSize));
  const colCount = data.columns.length + (data.toggleField ? 1 : 0);

  function navTo(next: { page?: number; q?: string; flag?: z.infer<typeof flagSchema> }) {
    navigate({
      to: '/resources/$resource',
      params: { resource },
      search: { page: next.page ?? search.page, q: next.q ?? search.q, flag: next.flag ?? search.flag },
    });
  }

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    navTo({ page: 1, q: term });
  }

  async function toggle(id: string, current: boolean) {
    setBusyId(id);
    try {
      await setResourceFlag({ data: { resource, id, value: !current } });
      await router.invalidate();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{data.label}</h1>
        <span className="text-sm text-muted-foreground">{data.total.toLocaleString()} rows</span>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <form onSubmit={submitSearch} className="flex max-w-md flex-1 gap-2">
          <Input
            placeholder={`Search ${data.label.toLowerCase()}...`}
            value={term}
            onChange={(e) => setTerm(e.target.value)}
          />
          <Button type="submit" variant="secondary">
            Search
          </Button>
          {search.q && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setTerm('');
                navTo({ page: 1, q: '' });
              }}
            >
              Clear
            </Button>
          )}
        </form>

        {data.toggleField && (
          <div className="flex items-center gap-1">
            <span className="mr-1 text-sm text-muted-foreground">{data.toggleField}:</span>
            {flagSchema.options.map((f) => (
              <Button
                key={f}
                size="sm"
                variant={search.flag === f ? 'default' : 'outline'}
                onClick={() => navTo({ page: 1, flag: f })}
              >
                {f === 'all' ? 'All' : f === 'on' ? data.toggleField : `Not ${data.toggleField}`}
              </Button>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {data.columns.map((col) => (
                <TableHead key={col}>{col}</TableHead>
              ))}
              {data.toggleField && <TableHead className="w-36">actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={colCount} className="text-center text-muted-foreground">
                  No rows.
                </TableCell>
              </TableRow>
            ) : (
              data.rows.map((row, i) => {
                const id = String(row[data.idField] ?? '');
                const flagOn = data.toggleField ? row[data.toggleField] === true : false;
                return (
                  <TableRow key={i}>
                    {data.columns.map((col, ci) => {
                      const cell = formatCell(row[col]);
                      const isLink = data.hasDetail && ci === 0;
                      return (
                        <TableCell key={col} className="max-w-xs truncate font-mono text-xs">
                          {isLink ? (
                            <Link
                              to="/resources/$resource/$id"
                              params={{ resource, id }}
                              className="text-primary underline-offset-2 hover:underline"
                            >
                              {cell}
                            </Link>
                          ) : (
                            cell
                          )}
                        </TableCell>
                      );
                    })}
                    {data.toggleField && (
                      <TableCell>
                        <Button
                          size="sm"
                          variant={flagOn ? 'secondary' : 'default'}
                          disabled={busyId === id}
                          onClick={() => toggle(id, flagOn)}
                        >
                          {flagOn ? `Unset ${data.toggleField}` : `Set ${data.toggleField}`}
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          Page {data.page} of {totalPages}
        </span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={data.page <= 1}
            onClick={() => navTo({ page: data.page - 1 })}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={data.page >= totalPages}
            onClick={() => navTo({ page: data.page + 1 })}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
