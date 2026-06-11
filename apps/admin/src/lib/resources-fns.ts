import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';

// Server-function boundary for the resource browser. Top-level imports are all client-safe. The
// Prisma data layer (./db-queries) and session check (./session-server) are pulled in via dynamic
// import() INSIDE each handler, whose body the compiler strips from the client bundle, so neither
// reaches the client (TanStack Start import-protection). Every handler asserts admin access first
// because server functions are publicly callable endpoints; the route guard is only for UX.

const listInput = z.object({
  resource: z.string(),
  page: z.number().int().min(1).default(1),
  q: z.string().default(''),
  // Boolean (toggleField) filter: 'all' ignores it, 'on'/'off' keep only that state.
  flag: z.enum(['all', 'on', 'off']).default('all'),
});

export const listResource = createServerFn({ method: 'GET' })
  .validator((input: unknown) => listInput.parse(input))
  .handler(async ({ data }) => {
    const { assertAdmin } = await import('./session-server');
    await assertAdmin();
    const { listRows } = await import('./db-queries');
    const flag = data.flag === 'all' ? undefined : data.flag === 'on';
    return listRows(data.resource, data.page, data.q, flag);
  });

const setFlagInput = z.object({
  resource: z.string(),
  id: z.string(),
  value: z.boolean(),
});

export const setResourceFlag = createServerFn({ method: 'POST' })
  .validator((input: unknown) => setFlagInput.parse(input))
  .handler(async ({ data }) => {
    const { assertAdmin } = await import('./session-server');
    await assertAdmin();
    const { setFlag } = await import('./db-queries');
    await setFlag(data.resource, data.id, data.value);
    return { success: true };
  });

const getInput = z.object({ resource: z.string(), id: z.string() });

export const getResourceRow = createServerFn({ method: 'GET' })
  .validator((input: unknown) => getInput.parse(input))
  .handler(async ({ data }) => {
    const { assertAdmin } = await import('./session-server');
    await assertAdmin();
    const { getRow } = await import('./db-queries');
    return getRow(data.resource, data.id);
  });

export const getCounts = createServerFn({ method: 'GET' }).handler(async () => {
  const { assertAdmin } = await import('./session-server');
  await assertAdmin();
  const { countAll } = await import('./db-queries');
  return countAll();
});
