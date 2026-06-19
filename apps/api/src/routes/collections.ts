import { createRoute, OpenAPIHono } from '@hono/zod-openapi';
import { prisma } from '@getvinyls/db';
import { getUserId, unauthorized } from '../auth-helpers.js';
import {
  CollectionSchema,
  CollectionListSchema,
  CreateCollectionSchema,
  UpdateCollectionSchema,
  AddCollectionVinylSchema,
  CollectionMembershipsSchema,
  CollectionVinylParamSchema,
  VinylListSchema,
  MutationResultSchema,
  ErrorSchema,
  IdParamSchema,
  PaginationQuerySchema,
  VinylIdQuerySchema,
  vinylSummaryInclude,
  toVinylSummaryDto,
  toUserSummaryDto,
  toCollectionDto,
} from '../schemas.js';
import { currencyContext, type CurrencyVariables } from '../currency/middleware.js';

// Collections (saved groups). Reading a collection is PUBLIC (anyone can view any user's groups);
// creating, editing, deleting, and adding/removing vinyls are owner-only (401 without a session,
// 403 when the collection belongs to someone else). The vinyls listing returns prices, so the
// router carries the currency-converter variable.
export const collectionsRouter = new OpenAPIHono<{ Variables: CurrencyVariables }>();

collectionsRouter.use('/collections/:id/vinyls', currencyContext);

// The include the collection DTO mapper expects: a vinyl count plus a few cover thumbnails.
const collectionCardInclude = {
  _count: { select: { vinyls: true } },
  vinyls: {
    orderBy: { createdAt: 'desc' },
    take: 4,
    select: { vinyl: { select: { coverArtUrl: true } } },
  },
} as const;

const collectionNotFound = { error: 'not_found', message: 'Collection not found' } as const;
const forbidden = { error: 'forbidden', message: 'You do not own this collection' } as const;

// Build the owner summary for a collection (viewer-aware follow state).
async function ownerSummary(
  ownerUserId: string,
  ownerProfile: { username: string | null; displayName: string | null; avatarUrl: string | null } | null,
  viewerId: string | null,
) {
  const isMe = ownerUserId === viewerId;
  let isFollowing = false;
  if (viewerId && !isMe) {
    const edge = await prisma.follow.findUnique({
      where: { followerId_followingId: { followerId: viewerId, followingId: ownerUserId } },
      select: { id: true },
    });
    isFollowing = edge !== null;
  }
  return toUserSummaryDto(ownerProfile, { isFollowing, isMe });
}

// --- The signed-in user's collections ---

const listMyCollectionsRoute = createRoute({
  method: 'get',
  path: '/me/collections',
  tags: ['collections'],
  summary: 'List the signed-in user collections',
  responses: {
    200: {
      description: 'The signed-in user saved groups (collections).',
      content: { 'application/json': { schema: CollectionListSchema } },
    },
    401: { description: 'Not signed in.', content: { 'application/json': { schema: ErrorSchema } } },
  },
});

collectionsRouter.openapi(listMyCollectionsRoute, async (c) => {
  const userId = await getUserId(c);
  if (!userId) return c.json(unauthorized, 401);

  const profile = await prisma.userProfile.findUnique({
    where: { userId },
    select: { username: true, displayName: true, avatarUrl: true },
  });
  const owner = toUserSummaryDto(profile, { isFollowing: false, isMe: true });

  const rows = await prisma.collection.findMany({
    where: { userId },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    include: collectionCardInclude,
  });
  return c.json({ collections: rows.map((row) => toCollectionDto(row, owner)) }, 200);
});

const createCollectionRoute = createRoute({
  method: 'post',
  path: '/me/collections',
  tags: ['collections'],
  summary: 'Create a collection',
  request: { body: { content: { 'application/json': { schema: CreateCollectionSchema } } } },
  responses: {
    201: {
      description: 'The created collection.',
      content: { 'application/json': { schema: CollectionSchema } },
    },
    401: { description: 'Not signed in.', content: { 'application/json': { schema: ErrorSchema } } },
  },
});

collectionsRouter.openapi(createCollectionRoute, async (c) => {
  const userId = await getUserId(c);
  if (!userId) return c.json(unauthorized, 401);

  const { name, description } = c.req.valid('json');
  const profile = await prisma.userProfile.findUnique({
    where: { userId },
    select: { username: true, displayName: true, avatarUrl: true },
  });
  const owner = toUserSummaryDto(profile, { isFollowing: false, isMe: true });

  const row = await prisma.collection.create({
    data: { userId, name, description: description ?? null },
    include: collectionCardInclude,
  });
  return c.json(toCollectionDto(row, owner), 201);
});

const collectionMembershipsRoute = createRoute({
  method: 'get',
  path: '/me/collection-memberships',
  tags: ['collections'],
  summary: 'Which of the signed-in user collections contain a vinyl',
  request: { query: VinylIdQuerySchema },
  responses: {
    200: {
      description: 'The ids of the signed-in user collections that contain the vinyl.',
      content: { 'application/json': { schema: CollectionMembershipsSchema } },
    },
    401: { description: 'Not signed in.', content: { 'application/json': { schema: ErrorSchema } } },
  },
});

collectionsRouter.openapi(collectionMembershipsRoute, async (c) => {
  const userId = await getUserId(c);
  if (!userId) return c.json(unauthorized, 401);

  const { vinylId } = c.req.valid('query');
  // Only the signed-in user's collections that contain this vinyl (scoped through the owner so a
  // membership in someone else's collection never leaks).
  const rows = await prisma.collectionVinyl.findMany({
    where: { vinylId, collection: { userId } },
    select: { collectionId: true },
  });
  return c.json({ collectionIds: rows.map((r) => r.collectionId) }, 200);
});

// --- A collection by id (public read, owner-only writes) ---

const getCollectionRoute = createRoute({
  method: 'get',
  path: '/collections/{id}',
  tags: ['collections'],
  summary: 'Get a collection by id',
  request: { params: IdParamSchema },
  responses: {
    200: {
      description: 'The collection metadata and owner. Its vinyls are paginated separately.',
      content: { 'application/json': { schema: CollectionSchema } },
    },
    404: {
      description: 'Collection not found.',
      content: { 'application/json': { schema: ErrorSchema } },
    },
  },
});

collectionsRouter.openapi(getCollectionRoute, async (c) => {
  const viewerId = await getUserId(c);
  const { id } = c.req.valid('param');

  const row = await prisma.collection.findUnique({
    where: { id },
    include: {
      ...collectionCardInclude,
      user: {
        select: {
          id: true,
          profile: { select: { username: true, displayName: true, avatarUrl: true } },
        },
      },
    },
  });
  if (!row) return c.json(collectionNotFound, 404);

  const owner = await ownerSummary(row.user.id, row.user.profile, viewerId);
  return c.json(toCollectionDto(row, owner), 200);
});

const updateCollectionRoute = createRoute({
  method: 'put',
  path: '/collections/{id}',
  tags: ['collections'],
  summary: 'Update a collection',
  request: {
    params: IdParamSchema,
    body: { content: { 'application/json': { schema: UpdateCollectionSchema } } },
  },
  responses: {
    200: {
      description: 'The updated collection.',
      content: { 'application/json': { schema: CollectionSchema } },
    },
    401: { description: 'Not signed in.', content: { 'application/json': { schema: ErrorSchema } } },
    403: { description: 'Not the owner.', content: { 'application/json': { schema: ErrorSchema } } },
    404: {
      description: 'Collection not found.',
      content: { 'application/json': { schema: ErrorSchema } },
    },
  },
});

collectionsRouter.openapi(updateCollectionRoute, async (c) => {
  const userId = await getUserId(c);
  if (!userId) return c.json(unauthorized, 401);

  const { id } = c.req.valid('param');
  const existing = await prisma.collection.findUnique({ where: { id }, select: { userId: true } });
  if (!existing) return c.json(collectionNotFound, 404);
  if (existing.userId !== userId) return c.json(forbidden, 403);

  const { name, description } = c.req.valid('json');
  const profile = await prisma.userProfile.findUnique({
    where: { userId },
    select: { username: true, displayName: true, avatarUrl: true },
  });
  const owner = toUserSummaryDto(profile, { isFollowing: false, isMe: true });

  const row = await prisma.collection.update({
    where: { id },
    data: { name, description: description ?? null },
    include: collectionCardInclude,
  });
  return c.json(toCollectionDto(row, owner), 200);
});

const deleteCollectionRoute = createRoute({
  method: 'delete',
  path: '/collections/{id}',
  tags: ['collections'],
  summary: 'Delete a collection',
  request: { params: IdParamSchema },
  responses: {
    200: {
      description: 'The collection was deleted.',
      content: { 'application/json': { schema: MutationResultSchema } },
    },
    401: { description: 'Not signed in.', content: { 'application/json': { schema: ErrorSchema } } },
    403: { description: 'Not the owner.', content: { 'application/json': { schema: ErrorSchema } } },
    404: {
      description: 'Collection not found.',
      content: { 'application/json': { schema: ErrorSchema } },
    },
  },
});

collectionsRouter.openapi(deleteCollectionRoute, async (c) => {
  const userId = await getUserId(c);
  if (!userId) return c.json(unauthorized, 401);

  const { id } = c.req.valid('param');
  const existing = await prisma.collection.findUnique({ where: { id }, select: { userId: true } });
  if (!existing) return c.json(collectionNotFound, 404);
  if (existing.userId !== userId) return c.json(forbidden, 403);

  await prisma.collection.delete({ where: { id } });
  return c.json({ success: true }, 200);
});

const listCollectionVinylsRoute = createRoute({
  method: 'get',
  path: '/collections/{id}/vinyls',
  tags: ['collections'],
  summary: 'List a collection vinyls',
  request: { params: IdParamSchema, query: PaginationQuerySchema },
  responses: {
    200: {
      description: 'A cursor-paginated page of the vinyls saved in this collection.',
      content: { 'application/json': { schema: VinylListSchema } },
    },
    404: {
      description: 'Collection not found.',
      content: { 'application/json': { schema: ErrorSchema } },
    },
  },
});

collectionsRouter.openapi(listCollectionVinylsRoute, async (c) => {
  const { id } = c.req.valid('param');
  const { limit, cursor } = c.req.valid('query');

  const collection = await prisma.collection.findUnique({ where: { id }, select: { id: true } });
  if (!collection) return c.json(collectionNotFound, 404);

  // Paginate the join rows by keyset; the cursor is a CollectionVinyl... but its PK is composite, so
  // there is no single `id`. Order by createdAt + vinylId and carry the vinylId as the cursor.
  const rows = await prisma.collectionVinyl.findMany({
    where: { collectionId: id },
    orderBy: [{ createdAt: 'desc' }, { vinylId: 'desc' }],
    take: limit + 1,
    ...(cursor
      ? { cursor: { collectionId_vinylId: { collectionId: id, vinylId: cursor } }, skip: 1 }
      : {}),
    include: { vinyl: { include: vinylSummaryInclude } },
  });
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const last = items.at(-1);
  const nextCursor = hasMore && last ? last.vinylId : null;
  const converter = c.var.converter;
  return c.json(
    { vinyls: items.map((cv) => toVinylSummaryDto(cv.vinyl, converter)), nextCursor },
    200,
  );
});

const addCollectionVinylRoute = createRoute({
  method: 'post',
  path: '/collections/{id}/vinyls',
  tags: ['collections'],
  summary: 'Add a vinyl to a collection',
  request: {
    params: IdParamSchema,
    body: { content: { 'application/json': { schema: AddCollectionVinylSchema } } },
  },
  responses: {
    200: {
      description: 'The vinyl was added (idempotent: also 200 if already in the collection).',
      content: { 'application/json': { schema: MutationResultSchema } },
    },
    401: { description: 'Not signed in.', content: { 'application/json': { schema: ErrorSchema } } },
    403: { description: 'Not the owner.', content: { 'application/json': { schema: ErrorSchema } } },
    404: {
      description: 'Collection or vinyl not found.',
      content: { 'application/json': { schema: ErrorSchema } },
    },
  },
});

collectionsRouter.openapi(addCollectionVinylRoute, async (c) => {
  const userId = await getUserId(c);
  if (!userId) return c.json(unauthorized, 401);

  const { id } = c.req.valid('param');
  const { vinylId } = c.req.valid('json');

  const collection = await prisma.collection.findUnique({
    where: { id },
    select: { userId: true },
  });
  if (!collection) return c.json(collectionNotFound, 404);
  if (collection.userId !== userId) return c.json(forbidden, 403);

  const vinyl = await prisma.vinyl.findUnique({ where: { id: vinylId }, select: { id: true } });
  if (!vinyl) return c.json({ error: 'not_found', message: `No vinyl with id ${vinylId}` }, 404);

  await prisma.collectionVinyl.upsert({
    where: { collectionId_vinylId: { collectionId: id, vinylId } },
    create: { collectionId: id, vinylId },
    update: {},
  });
  return c.json({ success: true }, 200);
});

const removeCollectionVinylRoute = createRoute({
  method: 'delete',
  path: '/collections/{id}/vinyls/{vinylId}',
  tags: ['collections'],
  summary: 'Remove a vinyl from a collection',
  request: { params: CollectionVinylParamSchema },
  responses: {
    200: {
      description: 'The vinyl was removed (idempotent: also 200 if it was not in the collection).',
      content: { 'application/json': { schema: MutationResultSchema } },
    },
    401: { description: 'Not signed in.', content: { 'application/json': { schema: ErrorSchema } } },
    403: { description: 'Not the owner.', content: { 'application/json': { schema: ErrorSchema } } },
    404: {
      description: 'Collection not found.',
      content: { 'application/json': { schema: ErrorSchema } },
    },
  },
});

collectionsRouter.openapi(removeCollectionVinylRoute, async (c) => {
  const userId = await getUserId(c);
  if (!userId) return c.json(unauthorized, 401);

  const { id, vinylId } = c.req.valid('param');
  const collection = await prisma.collection.findUnique({
    where: { id },
    select: { userId: true },
  });
  if (!collection) return c.json(collectionNotFound, 404);
  if (collection.userId !== userId) return c.json(forbidden, 403);

  await prisma.collectionVinyl.deleteMany({ where: { collectionId: id, vinylId } });
  return c.json({ success: true }, 200);
});
