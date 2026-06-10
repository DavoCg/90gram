import { createRoute, OpenAPIHono } from '@hono/zod-openapi';
import type { Context } from 'hono';
import { prisma } from '@getvinyls/db';
import { auth } from '../auth.js';
import {
  FavoriteIdsSchema,
  FavoriteTracksSchema,
  VinylListSchema,
  CreateFavoriteSchema,
  FavoriteRefSchema,
  MutationResultSchema,
  TargetTypeParamSchema,
  ErrorSchema,
  PaginationQuerySchema,
  cursorArgs,
  toPage,
  vinylSummaryInclude,
  toVinylSummaryDto,
  toFavoriteTrackDto,
} from '../schemas.js';
import { currencyContext, type CurrencyVariables } from '../currency/middleware.js';

// Favorites are the API's only per-user WRITE surface (the vinyl routes stay read-only). Each
// handler resolves the better-auth session from the request and 401s when there is none; the
// mobile client forwards the session cookie, so these authenticate without a CORS change.
export const favoritesRouter = new OpenAPIHono<{ Variables: CurrencyVariables }>();

// Favorited vinyls carry prices, so convert them into the signed-in user's display currency. (The
// other favorites routes return ids/tracks with no prices, so they skip this.)
favoritesRouter.use('/favorites/vinyls', currencyContext);

// Resolve the signed-in user id, or null when the request carries no valid session.
async function getUserId(c: Context): Promise<string | null> {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  return session?.user.id ?? null;
}

const unauthorized = { error: 'unauthorized', message: 'Sign in required' } as const;

const listFavoriteIdsRoute = createRoute({
  method: 'get',
  path: '/favorites',
  tags: ['favorites'],
  summary: 'List the ids of the signed-in user favorites',
  responses: {
    200: {
      description: 'The ids of the vinyls and tracks the user has favorited (drives the heart state).',
      content: { 'application/json': { schema: FavoriteIdsSchema } },
    },
    401: {
      description: 'Not signed in.',
      content: { 'application/json': { schema: ErrorSchema } },
    },
  },
});

favoritesRouter.openapi(listFavoriteIdsRoute, async (c) => {
  const userId = await getUserId(c);
  if (!userId) return c.json(unauthorized, 401);

  const rows = await prisma.favorite.findMany({
    where: { userId },
    select: { vinylId: true, trackId: true },
  });
  const vinylIds = rows.flatMap((row) => (row.vinylId ? [row.vinylId] : []));
  const trackIds = rows.flatMap((row) => (row.trackId ? [row.trackId] : []));
  return c.json({ vinylIds, trackIds }, 200);
});

const listFavoriteVinylsRoute = createRoute({
  method: 'get',
  path: '/favorites/vinyls',
  tags: ['favorites'],
  summary: "List the signed-in user's favorited vinyls",
  request: { query: PaginationQuerySchema },
  responses: {
    200: {
      description: "A cursor-paginated page of the user's favorited vinyls.",
      content: { 'application/json': { schema: VinylListSchema } },
    },
    401: {
      description: 'Not signed in.',
      content: { 'application/json': { schema: ErrorSchema } },
    },
  },
});

favoritesRouter.openapi(listFavoriteVinylsRoute, async (c) => {
  const userId = await getUserId(c);
  if (!userId) return c.json(unauthorized, 401);

  const { limit, cursor } = c.req.valid('query');
  // Paginate Favorite rows by keyset (cursor is a Favorite id) so the page order matches the order
  // they were favorited (newest first), independent of the vinyls' own creation order.
  const rows = await prisma.favorite.findMany({
    where: { userId, vinylId: { not: null } },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    ...cursorArgs(limit, cursor),
    include: { vinyl: { include: vinylSummaryInclude } },
  });
  const { items, nextCursor } = toPage(rows, limit);
  const converter = c.var.converter;
  const vinyls = items.flatMap((row) => (row.vinyl ? [toVinylSummaryDto(row.vinyl, converter)] : []));
  return c.json({ vinyls, nextCursor }, 200);
});

const listFavoriteTracksRoute = createRoute({
  method: 'get',
  path: '/favorites/tracks',
  tags: ['favorites'],
  summary: "List the signed-in user's favorited tracks",
  responses: {
    200: {
      description: "The user's favorited tracks, each enriched for direct rendering.",
      content: { 'application/json': { schema: FavoriteTracksSchema } },
    },
    401: {
      description: 'Not signed in.',
      content: { 'application/json': { schema: ErrorSchema } },
    },
  },
});

favoritesRouter.openapi(listFavoriteTracksRoute, async (c) => {
  const userId = await getUserId(c);
  if (!userId) return c.json(unauthorized, 401);

  const rows = await prisma.favorite.findMany({
    where: { userId, trackId: { not: null } },
    orderBy: { createdAt: 'desc' },
    // A track belongs to a shop_vinyl; its canonical album is that shop_vinyl's vinyl.
    include: { track: { include: { shopVinyl: { include: { vinyl: true } } } } },
  });
  const tracks = rows.flatMap((row) => (row.track ? [toFavoriteTrackDto(row.track)] : []));
  return c.json({ tracks }, 200);
});

const addFavoriteRoute = createRoute({
  method: 'post',
  path: '/favorites',
  tags: ['favorites'],
  summary: 'Add a vinyl or track to favorites',
  request: {
    body: { content: { 'application/json': { schema: CreateFavoriteSchema } } },
  },
  responses: {
    201: {
      description: 'The favorite (idempotent: returns the existing one if already favorited).',
      content: { 'application/json': { schema: FavoriteRefSchema } },
    },
    401: {
      description: 'Not signed in.',
      content: { 'application/json': { schema: ErrorSchema } },
    },
    404: {
      description: 'The target vinyl or track does not exist.',
      content: { 'application/json': { schema: ErrorSchema } },
    },
  },
});

favoritesRouter.openapi(addFavoriteRoute, async (c) => {
  const userId = await getUserId(c);
  if (!userId) return c.json(unauthorized, 401);

  const { targetType, targetId } = c.req.valid('json');

  if (targetType === 'vinyl') {
    const exists = await prisma.vinyl.findUnique({ where: { id: targetId }, select: { id: true } });
    if (!exists) {
      return c.json({ error: 'not_found', message: `No vinyl with id ${targetId}` }, 404);
    }
    const favorite = await prisma.favorite.upsert({
      where: { userId_vinylId: { userId, vinylId: targetId } },
      create: { userId, vinylId: targetId },
      update: {},
    });
    return c.json(
      { id: favorite.id, targetType, targetId, createdAt: favorite.createdAt.toISOString() },
      201,
    );
  }

  const exists = await prisma.track.findUnique({ where: { id: targetId }, select: { id: true } });
  if (!exists) {
    return c.json({ error: 'not_found', message: `No track with id ${targetId}` }, 404);
  }
  const favorite = await prisma.favorite.upsert({
    where: { userId_trackId: { userId, trackId: targetId } },
    create: { userId, trackId: targetId },
    update: {},
  });
  return c.json(
    { id: favorite.id, targetType, targetId, createdAt: favorite.createdAt.toISOString() },
    201,
  );
});

const removeFavoriteRoute = createRoute({
  method: 'delete',
  path: '/favorites/{targetType}/{targetId}',
  tags: ['favorites'],
  summary: 'Remove a vinyl or track from favorites',
  request: { params: TargetTypeParamSchema },
  responses: {
    200: {
      description: 'The favorite was removed (idempotent: also 200 if it was not favorited).',
      content: { 'application/json': { schema: MutationResultSchema } },
    },
    401: {
      description: 'Not signed in.',
      content: { 'application/json': { schema: ErrorSchema } },
    },
  },
});

favoritesRouter.openapi(removeFavoriteRoute, async (c) => {
  const userId = await getUserId(c);
  if (!userId) return c.json(unauthorized, 401);

  const { targetType, targetId } = c.req.valid('param');
  await prisma.favorite.deleteMany({
    where: targetType === 'vinyl' ? { userId, vinylId: targetId } : { userId, trackId: targetId },
  });
  return c.json({ success: true }, 200);
});
