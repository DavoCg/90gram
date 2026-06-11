import { createRoute, OpenAPIHono } from '@hono/zod-openapi';
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
  SearchQuerySchema,
  CurrencyQuerySchema,
  cursorArgs,
  toPage,
  vinylSummaryInclude,
  toVinylSummaryDto,
  toVinylDto,
  toShopDto,
  toShopDetailDto,
  toGenreDto,
} from '../schemas.js';
import { currencyContext, type CurrencyVariables } from '../currency/middleware.js';
import { searchVinylIds } from '../search/meili.js';

// The price-returning routes resolve a display currency per request (see currencyContext) and expose
// the converter on the typed context, so this router carries that variable type.
export const vinylsRouter = new OpenAPIHono<{ Variables: CurrencyVariables }>();

// Resolve a display currency + converter only on the price-returning routes (the list, the detail,
// and a shop's vinyls). /shops, /shops/{id}, and /genres carry no prices, so they skip it.
vinylsRouter.use('/vinyls', currencyContext);
vinylsRouter.use('/vinyls/:id', currencyContext);
vinylsRouter.use('/shops/:id/vinyls', currencyContext);

// GET /vinyls is ranked by shop count (most shops first), a relation aggregate that Prisma's keyset
// `cursor` cannot resume from, so this one list pages by offset and carries that offset in `cursor`.
// A missing or malformed cursor starts at the first page.
function parseOffset(cursor: string | undefined): number {
  if (cursor === undefined) return 0;
  const n = Number(cursor);
  return Number.isInteger(n) && n >= 0 ? n : 0;
}

const listVinylsRoute = createRoute({
  method: 'get',
  path: '/vinyls',
  tags: ['vinyls'],
  summary: 'List vinyls',
  request: { query: PaginationQuerySchema.extend(CurrencyQuerySchema.shape) },
  responses: {
    200: {
      description:
        'A paginated page of vinyls with their tracks, genres, and a cheapest-price summary. Vinyls ' +
        'listed by more shops come first (so records available in multiple shops lead), then newest ' +
        'first. The cursor is an offset into this ranking.',
      content: { 'application/json': { schema: VinylListSchema } },
    },
  },
});

vinylsRouter.openapi(listVinylsRoute, async (c) => {
  const { limit, cursor } = c.req.valid('query');
  const offset = parseOffset(cursor);
  const rows = await prisma.vinyl.findMany({
    // Most shops first (records sold in multiple shops lead), then newest, id as a stable tiebreaker.
    orderBy: [{ shopVinyls: { _count: 'desc' } }, { createdAt: 'desc' }, { id: 'desc' }],
    skip: offset,
    take: limit + 1, // over-fetch by one to detect a further page
    include: vinylSummaryInclude,
  });
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? String(offset + limit) : null;
  const converter = c.var.converter;
  return c.json({ vinyls: items.map((row) => toVinylSummaryDto(row, converter)), nextCursor }, 200);
});

// GET /vinyls/search: full-text search over the canonical vinyls. Meilisearch does the matching and
// ranking and returns vinyl ids; the row data is then HYDRATED from Postgres through the same
// include + DTO mapper as every other vinyls list, so the wire shape is identical to GET /vinyls and
// the price is converted into the request's display currency here (never baked into the index). The
// `/vinyls/:id` currency middleware above also matches `/vinyls/search`, so c.var.converter is set.
// This route is registered before GET /vinyls/{id}; Hono's router prefers the static path anyway.
const searchVinylsRoute = createRoute({
  method: 'get',
  path: '/vinyls/search',
  tags: ['vinyls'],
  summary: 'Search vinyls',
  request: { query: SearchQuerySchema.extend(CurrencyQuerySchema.shape) },
  responses: {
    200: {
      description:
        'A page of vinyls matching the query, in relevance order. Same shape as GET /vinyls; the ' +
        'cursor is an offset into the ranked results.',
      content: { 'application/json': { schema: VinylListSchema } },
    },
    503: {
      description: 'Search is unavailable (not configured, or the search server is unreachable).',
      content: { 'application/json': { schema: ErrorSchema } },
    },
  },
});

vinylsRouter.openapi(searchVinylsRoute, async (c) => {
  const { q, limit, cursor } = c.req.valid('query');
  const offset = parseOffset(cursor);

  let result;
  try {
    result = await searchVinylIds(q, limit, offset);
  } catch (error) {
    console.error('[search] Meilisearch query failed:', error);
    return c.json(
      { error: 'search_unavailable', message: 'Search is temporarily unavailable.' },
      503,
    );
  }
  if (result === null) {
    return c.json({ error: 'search_unavailable', message: 'Search is not configured.' }, 503);
  }

  // Hydrate the matched ids from Postgres. `findMany` ignores the order of `id: { in }`, so re-sort
  // the rows back into Meilisearch's relevance ranking before mapping.
  const rows = await prisma.vinyl.findMany({
    where: { id: { in: result.ids } },
    include: vinylSummaryInclude,
  });
  const byId = new Map(rows.map((row) => [row.id, row]));
  const converter = c.var.converter;
  const vinyls = result.ids
    .map((id) => byId.get(id))
    .filter((row): row is NonNullable<typeof row> => row !== undefined)
    .map((row) => toVinylSummaryDto(row, converter));

  const nextCursor = offset + limit < result.total ? String(offset + limit) : null;
  return c.json({ vinyls, nextCursor }, 200);
});

const getVinylRoute = createRoute({
  method: 'get',
  path: '/vinyls/{id}',
  tags: ['vinyls'],
  summary: 'Get a vinyl by id',
  request: { params: IdParamSchema, query: CurrencyQuerySchema },
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
      // Only surface validated genres (see vinylSummaryInclude).
      genres: { where: { genre: { validated: true } }, include: { genre: true } },
      shopVinyls: { include: { shop: true, offers: { orderBy: { currentPrice: 'asc' } } } },
    },
  });
  if (!row) {
    return c.json({ error: 'not_found', message: `No vinyl with id ${id}` }, 404);
  }
  return c.json(toVinylDto(row, c.var.converter), 200);
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
  request: { params: IdParamSchema, query: PaginationQuerySchema.extend(CurrencyQuerySchema.shape) },
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
  const converter = c.var.converter;
  return c.json(
    { vinyls: items.map((sv) => toVinylSummaryDto(sv.vinyl, converter)), nextCursor },
    200,
  );
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
  const rows = await prisma.genre.findMany({
    where: { validated: true },
    orderBy: { name: 'asc' },
  });
  return c.json({ genres: rows.map(toGenreDto), total: rows.length }, 200);
});
