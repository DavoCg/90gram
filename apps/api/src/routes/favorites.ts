import { createRoute, OpenAPIHono } from '@hono/zod-openapi';
import type { Context } from 'hono';
import { prisma } from '@getvinyls/db';
import { auth } from '../auth.js';
import {
  FavoritesSchema,
  CreateFavoriteSchema,
  FavoriteRefSchema,
  MutationResultSchema,
  TargetTypeParamSchema,
  ErrorSchema,
  toVinylSummaryDto,
  toFavoriteTrackDto,
} from '../schemas.js';

// Favorites are the API's only per-user WRITE surface (the vinyl routes stay read-only). Each
// handler resolves the better-auth session from the request and 401s when there is none; the
// mobile client forwards the session cookie, so these authenticate without a CORS change.
export const favoritesRouter = new OpenAPIHono();

// The same `include` shape toVinylSummaryDto expects, reused for a favorited vinyl.
const vinylSummaryInclude = {
  tracks: { orderBy: { position: 'asc' } },
  genres: { include: { genre: true } },
  shopVinyls: {
    select: { shopId: true, offers: { select: { currentPrice: true, currentCurrency: true } } },
  },
} as const;

// Resolve the signed-in user id, or null when the request carries no valid session.
async function getUserId(c: Context): Promise<string | null> {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  return session?.user.id ?? null;
}

const unauthorized = { error: 'unauthorized', message: 'Sign in required' } as const;

const listFavoritesRoute = createRoute({
  method: 'get',
  path: '/favorites',
  tags: ['favorites'],
  summary: 'List the signed-in user favorites',
  responses: {
    200: {
      description: "The user's favorited vinyls and tracks, each enriched for direct rendering.",
      content: { 'application/json': { schema: FavoritesSchema } },
    },
    401: {
      description: 'Not signed in.',
      content: { 'application/json': { schema: ErrorSchema } },
    },
  },
});

favoritesRouter.openapi(listFavoritesRoute, async (c) => {
  const userId = await getUserId(c);
  if (!userId) return c.json(unauthorized, 401);

  const rows = await prisma.favorite.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    include: {
      vinyl: { include: vinylSummaryInclude },
      track: { include: { vinyl: true } },
    },
  });

  const vinyls = rows.flatMap((row) => (row.vinyl ? [toVinylSummaryDto(row.vinyl)] : []));
  const tracks = rows.flatMap((row) => (row.track ? [toFavoriteTrackDto(row.track)] : []));
  return c.json({ vinyls, tracks, total: rows.length }, 200);
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
