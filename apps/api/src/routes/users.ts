import { createRoute, OpenAPIHono } from '@hono/zod-openapi';
import { prisma, Prisma } from '@getvinyls/db';
import { getUserId, unauthorized } from '../auth-helpers.js';
import {
  MyProfileSchema,
  UpdateProfileSchema,
  ClaimUsernameSchema,
  UsernameAvailabilitySchema,
  UsernameQuerySchema,
  UsernameParamSchema,
  PublicUserSchema,
  UserListSchema,
  CollectionListSchema,
  VinylListSchema,
  MutationResultSchema,
  ErrorSchema,
  PaginationQuerySchema,
  UsernameSchema,
  cursorArgs,
  toPage,
  vinylSummaryInclude,
  toVinylSummaryDto,
  toUserSummaryDto,
  toPublicUserDto,
  toCollectionDto,
} from '../schemas.js';
import { currencyContext, type CurrencyVariables } from '../currency/middleware.js';

// Social user routes: the signed-in user's own profile (read/edit, claim username), public profiles
// by username, follow/unfollow, follower/following lists, and a user's public favorites + collections.
// Profiles, favorites, and collections are PUBLIC (any signed-in user can view any user), so only the
// write routes (edit profile, claim username, follow) require a session. One route returns prices
// (a user's favorited vinyls), so the router carries the currency-converter variable.
export const usersRouter = new OpenAPIHono<{ Variables: CurrencyVariables }>();

usersRouter.use('/users/:username/favorites', currencyContext);

// Resolve a viewer's "following" set across a batch of user ids in one query, so follower/following
// lists can render each row's follow button without an N+1.
async function followingSet(
  viewerId: string | null,
  targetUserIds: readonly string[],
): Promise<Set<string>> {
  if (!viewerId || targetUserIds.length === 0) return new Set();
  const rows = await prisma.follow.findMany({
    where: { followerId: viewerId, followingId: { in: [...targetUserIds] } },
    select: { followingId: true },
  });
  return new Set(rows.map((r) => r.followingId));
}

// Look up a user by their public handle (only users who have claimed a username are resolvable).
async function findUserByUsername(username: string) {
  return prisma.user.findFirst({
    where: { profile: { username } },
    select: { id: true, profile: true },
  });
}

const userNotFound = { error: 'not_found', message: 'User not found' } as const;

// --- Signed-in user's own profile ---

const getMyProfileRoute = createRoute({
  method: 'get',
  path: '/me/profile',
  tags: ['users'],
  summary: 'Get the signed-in user profile',
  responses: {
    200: {
      description: 'The signed-in user profile (username is null until claimed during onboarding).',
      content: { 'application/json': { schema: MyProfileSchema } },
    },
    401: { description: 'Not signed in.', content: { 'application/json': { schema: ErrorSchema } } },
  },
});

usersRouter.openapi(getMyProfileRoute, async (c) => {
  const userId = await getUserId(c);
  if (!userId) return c.json(unauthorized, 401);

  // Lazily create the profile row on first read so the rest of the app can assume it exists.
  const profile = await prisma.userProfile.upsert({
    where: { userId },
    create: { userId },
    update: {},
    select: { username: true, displayName: true, bio: true, avatarUrl: true },
  });
  return c.json(profile, 200);
});

const updateMyProfileRoute = createRoute({
  method: 'put',
  path: '/me/profile',
  tags: ['users'],
  summary: 'Update the signed-in user profile',
  request: { body: { content: { 'application/json': { schema: UpdateProfileSchema } } } },
  responses: {
    200: {
      description: 'The updated profile.',
      content: { 'application/json': { schema: MyProfileSchema } },
    },
    401: { description: 'Not signed in.', content: { 'application/json': { schema: ErrorSchema } } },
  },
});

usersRouter.openapi(updateMyProfileRoute, async (c) => {
  const userId = await getUserId(c);
  if (!userId) return c.json(unauthorized, 401);

  const { displayName, bio, avatarUrl } = c.req.valid('json');
  // An omitted field is left unchanged; an explicit null clears it. Zod's `.nullish()` gives us
  // `undefined` (omitted) vs `null` (clear), which Prisma update honours directly.
  const profile = await prisma.userProfile.upsert({
    where: { userId },
    create: { userId, displayName, bio, avatarUrl },
    update: { displayName, bio, avatarUrl },
    select: { username: true, displayName: true, bio: true, avatarUrl: true },
  });
  return c.json(profile, 200);
});

const claimUsernameRoute = createRoute({
  method: 'post',
  path: '/me/username',
  tags: ['users'],
  summary: 'Claim or change the signed-in user username',
  request: { body: { content: { 'application/json': { schema: ClaimUsernameSchema } } } },
  responses: {
    200: {
      description: 'The updated profile with the claimed username.',
      content: { 'application/json': { schema: MyProfileSchema } },
    },
    401: { description: 'Not signed in.', content: { 'application/json': { schema: ErrorSchema } } },
    409: {
      description: 'That username is already taken.',
      content: { 'application/json': { schema: ErrorSchema } },
    },
  },
});

usersRouter.openapi(claimUsernameRoute, async (c) => {
  const userId = await getUserId(c);
  if (!userId) return c.json(unauthorized, 401);

  const { username } = c.req.valid('json');
  try {
    const profile = await prisma.userProfile.upsert({
      where: { userId },
      create: { userId, username },
      update: { username },
      select: { username: true, displayName: true, bio: true, avatarUrl: true },
    });
    return c.json(profile, 200);
  } catch (e) {
    // The username `@unique` is the race-safe backstop: a concurrent claim of the same handle
    // surfaces as P2002, which we map to a 409 rather than a 500.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return c.json({ error: 'conflict', message: 'That username is already taken.' }, 409);
    }
    throw e;
  }
});

const usernameAvailableRoute = createRoute({
  method: 'get',
  path: '/usernames/available',
  tags: ['users'],
  summary: 'Check whether a username is available',
  request: { query: UsernameQuerySchema },
  responses: {
    200: {
      description: 'Whether the (normalized) username is valid and unclaimed.',
      content: { 'application/json': { schema: UsernameAvailabilitySchema } },
    },
  },
});

usersRouter.openapi(usernameAvailableRoute, async (c) => {
  const { username: raw } = c.req.valid('query');
  // Normalize + format-check with the same schema the claim uses; an invalid handle is "unavailable".
  const parsed = UsernameSchema.safeParse(raw);
  if (!parsed.success) {
    return c.json({ username: raw.trim().toLowerCase(), available: false }, 200);
  }
  const username = parsed.data;
  const existing = await prisma.userProfile.findUnique({
    where: { username },
    select: { userId: true },
  });
  return c.json({ username, available: existing === null }, 200);
});

// --- Public profile + follow ---

const getUserRoute = createRoute({
  method: 'get',
  path: '/users/{username}',
  tags: ['users'],
  summary: 'Get a public user profile by username',
  request: { params: UsernameParamSchema },
  responses: {
    200: {
      description: 'The public profile with social counts (viewer-aware follow state).',
      content: { 'application/json': { schema: PublicUserSchema } },
    },
    404: { description: 'User not found.', content: { 'application/json': { schema: ErrorSchema } } },
  },
});

usersRouter.openapi(getUserRoute, async (c) => {
  const viewerId = await getUserId(c);
  const { username } = c.req.valid('param');

  const user = await prisma.user.findFirst({
    where: { profile: { username } },
    select: {
      id: true,
      profile: { select: { username: true, displayName: true, bio: true, avatarUrl: true } },
      _count: { select: { followers: true, following: true, collections: true } },
    },
  });
  if (!user || !user.profile) return c.json(userNotFound, 404);

  const isMe = viewerId === user.id;
  const isFollowing =
    viewerId && !isMe ? (await followingSet(viewerId, [user.id])).has(user.id) : false;
  // Profile counts the favorited records (the Favorites the profile surfaces), not track favorites.
  const favoriteCount = await prisma.favorite.count({
    where: { userId: user.id, vinylId: { not: null } },
  });

  return c.json(
    toPublicUserDto(
      { ...user.profile, bio: user.profile.bio },
      { isFollowing, isMe },
      {
        followerCount: user._count.followers,
        followingCount: user._count.following,
        collectionCount: user._count.collections,
        favoriteCount,
      },
    ),
    200,
  );
});

const followRoute = createRoute({
  method: 'post',
  path: '/users/{username}/follow',
  tags: ['users'],
  summary: 'Follow a user',
  request: { params: UsernameParamSchema },
  responses: {
    200: {
      description: 'Now following (idempotent: also 200 if already following).',
      content: { 'application/json': { schema: MutationResultSchema } },
    },
    400: {
      description: 'Cannot follow yourself.',
      content: { 'application/json': { schema: ErrorSchema } },
    },
    401: { description: 'Not signed in.', content: { 'application/json': { schema: ErrorSchema } } },
    404: { description: 'User not found.', content: { 'application/json': { schema: ErrorSchema } } },
  },
});

usersRouter.openapi(followRoute, async (c) => {
  const viewerId = await getUserId(c);
  if (!viewerId) return c.json(unauthorized, 401);

  const { username } = c.req.valid('param');
  const target = await findUserByUsername(username);
  if (!target) return c.json(userNotFound, 404);
  if (target.id === viewerId) {
    return c.json({ error: 'bad_request', message: 'You cannot follow yourself.' }, 400);
  }

  await prisma.follow.upsert({
    where: { followerId_followingId: { followerId: viewerId, followingId: target.id } },
    create: { followerId: viewerId, followingId: target.id },
    update: {},
  });
  return c.json({ success: true }, 200);
});

const unfollowRoute = createRoute({
  method: 'delete',
  path: '/users/{username}/follow',
  tags: ['users'],
  summary: 'Unfollow a user',
  request: { params: UsernameParamSchema },
  responses: {
    200: {
      description: 'No longer following (idempotent: also 200 if not following).',
      content: { 'application/json': { schema: MutationResultSchema } },
    },
    401: { description: 'Not signed in.', content: { 'application/json': { schema: ErrorSchema } } },
    404: { description: 'User not found.', content: { 'application/json': { schema: ErrorSchema } } },
  },
});

usersRouter.openapi(unfollowRoute, async (c) => {
  const viewerId = await getUserId(c);
  if (!viewerId) return c.json(unauthorized, 401);

  const { username } = c.req.valid('param');
  const target = await findUserByUsername(username);
  if (!target) return c.json(userNotFound, 404);

  await prisma.follow.deleteMany({
    where: { followerId: viewerId, followingId: target.id },
  });
  return c.json({ success: true }, 200);
});

const listFollowersRoute = createRoute({
  method: 'get',
  path: '/users/{username}/followers',
  tags: ['users'],
  summary: 'List a user followers',
  request: { params: UsernameParamSchema, query: PaginationQuerySchema },
  responses: {
    200: {
      description: 'A cursor-paginated page of users who follow this user.',
      content: { 'application/json': { schema: UserListSchema } },
    },
    404: { description: 'User not found.', content: { 'application/json': { schema: ErrorSchema } } },
  },
});

usersRouter.openapi(listFollowersRoute, async (c) => {
  const viewerId = await getUserId(c);
  const { username } = c.req.valid('param');
  const { limit, cursor } = c.req.valid('query');

  const target = await findUserByUsername(username);
  if (!target) return c.json(userNotFound, 404);

  // Edges where this user is the followed party == their followers.
  const rows = await prisma.follow.findMany({
    where: { followingId: target.id },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    ...cursorArgs(limit, cursor),
    include: {
      follower: {
        select: {
          id: true,
          profile: { select: { username: true, displayName: true, avatarUrl: true } },
        },
      },
    },
  });
  const { items, nextCursor } = toPage(rows, limit);
  const set = await followingSet(
    viewerId,
    items.map((r) => r.followerId),
  );
  const users = items.map((r) =>
    toUserSummaryDto(r.follower.profile, {
      isFollowing: set.has(r.followerId),
      isMe: r.followerId === viewerId,
    }),
  );
  return c.json({ users, nextCursor }, 200);
});

const listFollowingRoute = createRoute({
  method: 'get',
  path: '/users/{username}/following',
  tags: ['users'],
  summary: 'List the users a user follows',
  request: { params: UsernameParamSchema, query: PaginationQuerySchema },
  responses: {
    200: {
      description: 'A cursor-paginated page of users this user follows.',
      content: { 'application/json': { schema: UserListSchema } },
    },
    404: { description: 'User not found.', content: { 'application/json': { schema: ErrorSchema } } },
  },
});

usersRouter.openapi(listFollowingRoute, async (c) => {
  const viewerId = await getUserId(c);
  const { username } = c.req.valid('param');
  const { limit, cursor } = c.req.valid('query');

  const target = await findUserByUsername(username);
  if (!target) return c.json(userNotFound, 404);

  // Edges where this user is the follower == the users they follow.
  const rows = await prisma.follow.findMany({
    where: { followerId: target.id },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    ...cursorArgs(limit, cursor),
    include: {
      following: {
        select: {
          id: true,
          profile: { select: { username: true, displayName: true, avatarUrl: true } },
        },
      },
    },
  });
  const { items, nextCursor } = toPage(rows, limit);
  const set = await followingSet(
    viewerId,
    items.map((r) => r.followingId),
  );
  const users = items.map((r) =>
    toUserSummaryDto(r.following.profile, {
      isFollowing: set.has(r.followingId),
      isMe: r.followingId === viewerId,
    }),
  );
  return c.json({ users, nextCursor }, 200);
});

// --- A user's public content ---

const listUserFavoritesRoute = createRoute({
  method: 'get',
  path: '/users/{username}/favorites',
  tags: ['users'],
  summary: 'List a user favorited vinyls',
  request: { params: UsernameParamSchema, query: PaginationQuerySchema },
  responses: {
    200: {
      description: 'A cursor-paginated page of the vinyls this user has favorited.',
      content: { 'application/json': { schema: VinylListSchema } },
    },
    404: { description: 'User not found.', content: { 'application/json': { schema: ErrorSchema } } },
  },
});

usersRouter.openapi(listUserFavoritesRoute, async (c) => {
  const { username } = c.req.valid('param');
  const { limit, cursor } = c.req.valid('query');

  const target = await findUserByUsername(username);
  if (!target) return c.json(userNotFound, 404);

  const rows = await prisma.favorite.findMany({
    where: { userId: target.id, vinylId: { not: null } },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    ...cursorArgs(limit, cursor),
    include: { vinyl: { include: vinylSummaryInclude } },
  });
  const { items, nextCursor } = toPage(rows, limit);
  const converter = c.var.converter;
  const vinyls = items.flatMap((row) =>
    row.vinyl ? [toVinylSummaryDto(row.vinyl, converter)] : [],
  );
  return c.json({ vinyls, nextCursor }, 200);
});

const listUserCollectionsRoute = createRoute({
  method: 'get',
  path: '/users/{username}/collections',
  tags: ['users'],
  summary: 'List a user collections',
  request: { params: UsernameParamSchema },
  responses: {
    200: {
      description: 'The user saved groups (collections), each with a cover preview and count.',
      content: { 'application/json': { schema: CollectionListSchema } },
    },
    404: { description: 'User not found.', content: { 'application/json': { schema: ErrorSchema } } },
  },
});

usersRouter.openapi(listUserCollectionsRoute, async (c) => {
  const viewerId = await getUserId(c);
  const { username } = c.req.valid('param');

  const target = await findUserByUsername(username);
  if (!target || !target.profile) return c.json(userNotFound, 404);

  const isMe = target.id === viewerId;
  const isFollowing =
    viewerId && !isMe ? (await followingSet(viewerId, [target.id])).has(target.id) : false;
  const owner = toUserSummaryDto(target.profile, { isFollowing, isMe });

  const rows = await prisma.collection.findMany({
    where: { userId: target.id },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    include: {
      _count: { select: { vinyls: true } },
      vinyls: {
        orderBy: { createdAt: 'desc' },
        take: 4,
        select: { vinyl: { select: { coverArtUrl: true } } },
      },
    },
  });
  const collections = rows.map((row) => toCollectionDto(row, owner));
  return c.json({ collections }, 200);
});
