import { Link, createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { z } from 'zod';
import { listResource } from '@/lib/resources-fns';
import { formatCell } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export const Route = createFileRoute('/_authed/resources/$resource')({
  validateSearch: z.object({
    page: z.number().int().min(1).catch(1).default(1),
    q: z.string().catch('').default(''),
  }),
  loaderDeps: ({ search }) => ({ page: search.page, q: search.q }),
  loader: ({ params, deps }) =>
    listResource({ data: { resource: params.resource, page: deps.page, q: deps.q } }),
  component: ListPage,
});

function ListPage() {
  const data = Route.useLoaderData();
  const { resource } = Route.useParams();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const [term, setTerm] = useState(search.q);

  const totalPages = Math.max(1, Math.ceil(data.total / data.pageSize));

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    navigate({ to: '/resources/$resource', params: { resource }, search: { page: 1, q: term } });
  }

  function goToPage(page: number) {
    navigate({ to: '/resources/$resource', params: { resource }, search: { page, q: search.q } });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{data.label}</h1>
        <span className="text-sm text-muted-foreground">{data.total.toLocaleString()} rows</span>
      </div>

      <form onSubmit={submitSearch} className="flex max-w-md gap-2">
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
              navigate({ to: '/resources/$resource', params: { resource }, search: { page: 1, q: '' } });
            }}
          >
            Clear
          </Button>
        )}
      </form>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {data.columns.map((col) => (
                <TableHead key={col}>{col}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={data.columns.length} className="text-center text-muted-foreground">
                  No rows.
                </TableCell>
              </TableRow>
            ) : (
              data.rows.map((row, i) => (
                <TableRow key={i}>
                  {data.columns.map((col, ci) => {
                    const cell = formatCell(row[col]);
                    const isLink = data.hasDetail && ci === 0;
                    return (
                      <TableCell key={col} className="max-w-xs truncate font-mono text-xs">
                        {isLink ? (
                          <Link
                            to="/resources/$resource/$id"
                            params={{ resource, id: String(row[data.idField] ?? '') }}
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
                </TableRow>
              ))
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
            onClick={() => goToPage(data.page - 1)}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={data.page >= totalPages}
            onClick={() => goToPage(data.page + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
