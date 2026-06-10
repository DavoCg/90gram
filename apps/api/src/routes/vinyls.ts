import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import { prisma } from '@getvinyls/db';
import {
  VinylListSchema,
  VinylSchema,
  ShopListSchema,
  ShopDetailSchema,
  GenreListSchema,
  ErrorSchema,
  IdParamSchema,
  PaginationQuerySchema,
  cursorArgs,
  toPage,
  vinylSummaryInclude,
  toVinylSummaryDto,
  toVinylDto,
  toShopDto,
  toShopDetailDto,
  toGenreDto,
} from '../schemas.js';

export const vinylsRouter = new OpenAPIHono();

// The keyset cursor for GET /vinyls. Unlike the other lists (whose cursor is just the last row's id),
// this list is ordered "vinyls in 2+ distinct shops first", so the cursor has to carry every sort-key
// component to resume across the multi-shop / single-shop boundary: the tier (`m`), the formatted
// createdAt key (`ck`, a fixed-width string so lexical order matches chronological), and the id (`i`).
const VinylCursorSchema = z.object({ m: z.boolean(), ck: z.string(), i: z.string() });
type VinylCursor = z.infer<typeof VinylCursorSchema>;

function encodeVinylCursor(cursor: VinylCursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString('base64url');
}

// Decode an opaque cursor back into its sort-key parts. A malformed cursor is treated as "no cursor"
// (first page) rather than an error, so a stale client never gets wedged on a bad token.
function decodeVinylCursor(raw: string): VinylCursor | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  const result = VinylCursorSchema.safeParse(parsed);
  return result.success ? result.data : null;
}

const listVinylsRoute = createRoute({
  method: 'get',
  path: '/vinyls',
  tags: ['vinyls'],
  summary: 'List vinyls',
  request: { query: PaginationQuerySchema },
  responses: {
    200: {
      description:
        'A cursor-paginated page of vinyls with their tracks, genres, and a cheapest-price summary. ' +
        'Vinyls available in 2 or more distinct shops are listed first, then the rest, each ordered ' +
        'newest first.',
      content: { 'application/json': { schema: VinylListSchema } },
    },
  },
});

// One row of the ranking query: a vinyl id plus the sort-key parts the cursor needs to resume.
type RankedVinyl = { id: string; created_key: string; is_multi_shop: boolean };

vinylsRouter.openapi(listVinylsRoute, async (c) => {
  const { limit, cursor } = c.req.valid('query');
  const cur = cursor ? decodeVinylCursor(cursor) : null;
  const isFirst = cur === null;
  // Placeholder values for the first page: the WHERE short-circuits on isFirst, so they are unused.
  const curM = cur?.m ?? false;
  const curKey = cur?.ck ?? '';
  const curId = cur?.i ?? '';
  const take = limit + 1; // over-fetch by one to detect a further page

  // "Available in multiple shops" means 2+ DISTINCT shops, so we count distinct shop_ids rather than
  // raw shop_vinyls rows. Prisma's where/orderBy cannot express a distinct-relation count, so the
  // ranking and keyset live in SQL; the page is then hydrated through the normal Prisma include below.
  // created_key is a fixed-width timestamp string so a plain lexical tuple comparison resumes the
  // keyset correctly (newest first) across the multi-shop / single-shop boundary.
  const ranked = await prisma.$queryRaw<RankedVinyl[]>`
    WITH ranked AS (
      SELECT v.id AS id,
             to_char(v.created_at, 'YYYY-MM-DD HH24:MI:SS.MS') AS created_key,
             v.created_at AS created_at,
             COUNT(DISTINCT sv.shop_id) >= 2 AS is_multi_shop
      FROM vinyls v
      LEFT JOIN shop_vinyls sv ON sv.vinyl_id = v.id
      GROUP BY v.id, v.created_at
    )
    SELECT id, created_key, is_multi_shop
    FROM ranked
    WHERE ${isFirst}::boolean
       OR (is_multi_shop, created_key, id) < (${curM}::boolean, ${curKey}::text, ${curId}::text)
    ORDER BY is_multi_shop DESC, created_at DESC, id DESC
    LIMIT ${take}::int
  `;

  const hasMore = ranked.length > limit;
  const pageRanked = hasMore ? ranked.slice(0, limit) : ranked;
  const ids = pageRanked.map((r) => r.id);

  // Hydrate the ordered ids through the shared include/DTO so the wire shape matches every other list.
  const rows = await prisma.vinyl.findMany({
    where: { id: { in: ids } },
    include: vinylSummaryInclude,
  });
  const byId = new Map(rows.map((row) => [row.id, row]));
  const vinyls = pageRanked
    .map((r) => byId.get(r.id))
    .filter((row): row is NonNullable<typeof row> => row !== undefined)
    .map(toVinylSummaryDto);

  const last = pageRanked.at(-1);
  const nextCursor =
    hasMore && last ? encodeVinylCursor({ m: last.is_multi_shop, ck: last.created_key, i: last.id }) : null;
  return c.json({ vinyls, nextCursor }, 200);
});

const getVinylRoute = createRoute({
  method: 'get',
  path: '/vinyls/{id}',
  tags: ['vinyls'],
  summary: 'Get a vinyl by id',
  request: { params: IdParamSchema },
  responses: {
    200: {
      description: 'The requested vinyl with its tracks, genres, and shop offers.',
      content: { 'application/json': { schema: VinylSchema } },
    },
    404: {
      description: 'Vinyl not found.',
      content: { 'application/json': { schema: ErrorSchema } },
    },
  },
});

vinylsRouter.openapi(getVinylRoute, async (c) => {
  const { id } = c.req.valid('param');
  const row = await prisma.vinyl.findUnique({
    where: { id },
    include: {
      tracks: { orderBy: { position: 'asc' } },
      genres: { include: { genre: true } },
      shopVinyls: { include: { shop: true, offers: { orderBy: { currentPrice: 'asc' } } } },
    },
  });
  if (!row) {
    return c.json({ error: 'not_found', message: `No vinyl with id ${id}` }, 404);
  }
  return c.json(toVinylDto(row), 200);
});

const listShopsRoute = createRoute({
  method: 'get',
  path: '/shops',
  tags: ['shops'],
  summary: 'List shops',
  responses: {
    200: {
      description: 'A list of shops.',
      content: { 'application/json': { schema: ShopListSchema } },
    },
  },
});

vinylsRouter.openapi(listShopsRoute, async (c) => {
  const rows = await prisma.shop.findMany({ orderBy: { name: 'asc' } });
  return c.json({ shops: rows.map(toShopDto), total: rows.length }, 200);
});

const getShopRoute = createRoute({
  method: 'get',
  path: '/shops/{id}',
  tags: ['shops'],
  summary: 'Get a shop by id',
  request: { params: IdParamSchema },
  responses: {
    200: {
      description: "The shop's identity and how many distinct vinyls it lists.",
      content: { 'application/json': { schema: ShopDetailSchema } },
    },
    404: {
      description: 'Shop not found.',
      content: { 'application/json': { schema: ErrorSchema } },
    },
  },
});

vinylsRouter.openapi(getShopRoute, async (c) => {
  const { id } = c.req.valid('param');
  const row = await prisma.shop.findUnique({ where: { id } });
  if (!row) {
    return c.json({ error: 'not_found', message: `No shop with id ${id}` }, 404);
  }
  // One shop can carry several ShopVinyl rows for the same canonical vinyl (different listings), so
  // count distinct vinyls for the header rather than raw listings.
  const distinct = await prisma.shopVinyl.findMany({
    where: { shopId: id },
    distinct: ['vinylId'],
    select: { vinylId: true },
  });
  return c.json(toShopDetailDto(row, distinct.length), 200);
});

const listShopVinylsRoute = createRoute({
  method: 'get',
  path: '/shops/{id}/vinyls',
  tags: ['shops'],
  summary: "List a shop's vinyls",
  request: { params: IdParamSchema, query: PaginationQuerySchema },
  responses: {
    200: {
      description: 'A cursor-paginated page of the vinyls this shop lists.',
      content: { 'application/json': { schema: VinylListSchema } },
    },
  },
});

vinylsRouter.openapi(listShopVinylsRoute, async (c) => {
  const { id } = c.req.valid('param');
  const { limit, cursor } = c.req.valid('query');
  // Paginate the shop's listings (ShopVinyl) by keyset; the cursor is a ShopVinyl id. A shop may list
  // the same canonical vinyl more than once, so the client dedupes by vinyl id across pages.
  const rows = await prisma.shopVinyl.findMany({
    where: { shopId: id },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    ...cursorArgs(limit, cursor),
    include: { vinyl: { include: vinylSummaryInclude } },
  });
  const { items, nextCursor } = toPage(rows, limit);
  return c.json({ vinyls: items.map((sv) => toVinylSummaryDto(sv.vinyl)), nextCursor }, 200);
});

const listGenresRoute = createRoute({
  method: 'get',
  path: '/genres',
  tags: ['genres'],
  summary: 'List genres',
  responses: {
    200: {
      description: 'A list of genres.',
      content: { 'application/json': { schema: GenreListSchema } },
    },
  },
});

vinylsRouter.openapi(listGenresRoute, async (c) => {
  const rows = await prisma.genre.findMany({ orderBy: { name: 'asc' } });
  return c.json({ genres: rows.map(toGenreDto), total: rows.length }, 200);
});
