import { z } from '@hono/zod-openapi';
import type { Prisma, ShopRow, GenreRow } from '@getvinyls/db';
import type { CurrencyConverter } from './currency/converter.js';
import type { VinylSearchDocument } from './search/meili.js';
import { SupportedCurrencySchema } from './currency/currencies.js';
import { SupportedLanguageSchema } from './language/languages.js';

// The wire shapes for the API. Zod schemas are the source of truth; the OpenAPI document
// and the generated client types both derive from these.

export const ShopSchema = z
  .object({
    id: z.string().openapi({ example: 'clz0a1b2c3d4e5f6g7h8i9j0' }),
    slug: z.string().openapi({ example: 'discogs' }),
    name: z.string().openapi({ example: 'Discogs' }),
    baseUrl: z.url().nullable().openapi({ example: 'https://www.discogs.com' }),
    address: z.string().nullable().openapi({ example: '12 Rue des Disques, 75011 Paris' }),
    country: z.string().nullable().openapi({ example: 'DE' }),
  })
  .openapi('Shop');

export const GenreSchema = z
  .object({
    id: z.string().openapi({ example: 'clz0a1b2c3d4e5f6g7h8i9j0' }),
    name: z.string().openapi({ example: 'Disco' }),
    slug: z.string().openapi({ example: 'disco' }),
  })
  .openapi('Genre');

export const TrackSchema = z
  .object({
    id: z.string().openapi({ example: 'clz0a1b2c3d4e5f6g7h8i9j0' }),
    position: z.string().openapi({ example: 'A1' }),
    title: z.string().openapi({ example: 'Night Drive' }),
    durationSeconds: z.number().int().nullable().openapi({ example: 254 }),
    previewUrl: z.url().nullable().openapi({ example: 'https://example.com/preview.mp3' }),
  })
  .openapi('Track');

export const StockStatusSchema = z
  .enum(['in_stock', 'out_of_stock', 'preorder', 'unknown'])
  .openapi('StockStatus');

export const OfferSchema = z
  .object({
    id: z.string().openapi({ example: 'clz0a1b2c3d4e5f6g7h8i9j0' }),
    shop: ShopSchema,
    sourceUrl: z.url().nullable().openapi({ example: 'https://www.discogs.com/release/123456' }),
    stockStatus: StockStatusSchema,
    condition: z.string().nullable().openapi({ example: 'NM' }),
    // `price`/`currency` are converted into the request's display currency (the signed-in user's
    // setting, a ?currency= override, or EUR). `originalPrice`/`originalCurrency` are the values the
    // shop actually listed, kept so the app can show what the offer was before conversion.
    price: z.number().nullable().openapi({ example: 24.99 }),
    currency: z.string().nullable().openapi({ example: 'EUR' }),
    originalPrice: z.number().nullable().openapi({ example: 21.5 }),
    originalCurrency: z.string().nullable().openapi({ example: 'GBP' }),
    scrapedAt: z.iso.datetime().nullable().openapi({ example: '2026-06-01T12:00:00.000Z' }),
  })
  .openapi('Offer');

export const VinylSummarySchema = z
  .object({
    id: z.string().openapi({ example: 'clz0a1b2c3d4e5f6g7h8i9j0' }),
    title: z.string().openapi({ example: 'Midnight Grooves' }),
    artist: z.string().openapi({ example: 'The Turntables' }),
    year: z.number().int().nullable().openapi({ example: 1979 }),
    coverArtUrl: z.url().nullable().openapi({ example: 'https://example.com/cover.jpg' }),
    label: z.string().nullable().openapi({ example: 'Groove Records' }),
    format: z.string().nullable().openapi({ example: 'LP' }),
    genres: z.array(GenreSchema),
    tracks: z.array(TrackSchema),
    // Cheapest current price across this vinyl's offers, CONVERTED into the request's display
    // currency (so "cheapest" is a like-for-like comparison even across mixed-currency offers), plus
    // that currency and how many shops list it.
    lowestPrice: z.number().nullable().openapi({ example: 24.99 }),
    currency: z.string().nullable().openapi({ example: 'EUR' }),
    shopCount: z.number().int().openapi({ example: 3 }),
  })
  .openapi('VinylSummary');

export const VinylSchema = VinylSummarySchema.extend({
  offers: z.array(OfferSchema),
}).openapi('Vinyl');

export type VinylSummary = z.infer<typeof VinylSummarySchema>;
export type Vinyl = z.infer<typeof VinylSchema>;

// Cursor-paginated vinyl page. `nextCursor` is the opaque cursor to pass back for the next page,
// or null when this is the last page. Used by the home feed, a shop's vinyls, and favorited vinyls.
export const VinylListSchema = z
  .object({
    vinyls: z.array(VinylSummarySchema),
    nextCursor: z.string().nullable().openapi({ example: 'clz0a1b2c3d4e5f6g7h8i9j0' }),
  })
  .openapi('VinylList');

export const ShopListSchema = z
  .object({
    shops: z.array(ShopSchema),
    total: z.number().int(),
  })
  .openapi('ShopList');

// The shop page: the shop's identity (name, address, ...) plus how many distinct vinyls it lists.
// The vinyls themselves are paginated separately via GET /shops/{id}/vinyls.
export const ShopDetailSchema = ShopSchema.extend({
  vinylCount: z.number().int().openapi({ example: 42 }),
}).openapi('ShopDetail');

export type ShopDetail = z.infer<typeof ShopDetailSchema>;

export const GenreListSchema = z
  .object({
    genres: z.array(GenreSchema),
    total: z.number().int(),
  })
  .openapi('GenreList');

export const ErrorSchema = z
  .object({
    error: z.string(),
    message: z.string(),
  })
  .openapi('Error');

// --- Currency (display currency + user setting) ---

// Optional ?currency= override for the price-returning routes. Used for ANONYMOUS browsing; a
// signed-in user's currency always comes from their saved setting (the server ignores this param
// for them). Validated against the supported set; an invalid value falls back to the default.
export const CurrencyQuerySchema = z.object({
  currency: SupportedCurrencySchema.optional().openapi({
    param: { name: 'currency', in: 'query' },
    example: 'GBP',
  }),
});

// The signed-in user's settings: the display currency (always present, defaults to EUR) and the
// preferred UI language (NULLABLE: null means the user has not chosen one, so the app falls back to
// the phone locale, then English). One read surface for every per-user preference.
export const UserSettingsSchema = z
  .object({
    currency: SupportedCurrencySchema,
    language: SupportedLanguageSchema.nullable(),
  })
  .openapi('UserSettings');

// Body for updating settings. Every field is optional so the client can PATCH just the currency or
// just the language; the server upserts only the keys that are present.
export const UpdateUserSettingsSchema = z
  .object({
    currency: SupportedCurrencySchema.optional(),
    language: SupportedLanguageSchema.optional(),
  })
  .openapi('UpdateUserSettings');

// The list of currencies the app supports (drives the picker, keeps mobile in sync with the server).
export const CurrencyListSchema = z
  .object({
    currencies: z.array(SupportedCurrencySchema),
  })
  .openapi('CurrencyList');

// The list of UI languages the app supports (drives the language picker; mirrors CurrencyList).
export const LanguageListSchema = z
  .object({
    languages: z.array(SupportedLanguageSchema),
  })
  .openapi('LanguageList');

// --- Favorites (per-user) ---

export const FavoriteTargetTypeSchema = z
  .enum(['vinyl', 'track'])
  .openapi('FavoriteTargetType');

// A favorited track, enriched with just enough of its parent vinyl to render and navigate
// in the Favorites tab without a follow-up fetch.
export const FavoriteTrackSchema = TrackSchema.extend({
  vinyl: z.object({
    id: z.string().openapi({ example: 'clz0a1b2c3d4e5f6g7h8i9j0' }),
    title: z.string().openapi({ example: 'Midnight Grooves' }),
    artist: z.string().openapi({ example: 'The Turntables' }),
    coverArtUrl: z.url().nullable().openapi({ example: 'https://example.com/cover.jpg' }),
  }),
}).openapi('FavoriteTrack');

// A cheap snapshot of WHICH targets the signed-in user has favorited (ids only). Drives the heart
// state everywhere without paging in the full favorited records, so a favorite tapped in any list
// reflects instantly. The favorited records/tracks themselves are fetched via the endpoints below.
export const FavoriteIdsSchema = z
  .object({
    vinylIds: z.array(z.string()),
    trackIds: z.array(z.string()),
  })
  .openapi('FavoriteIds');

// The signed-in user's favorited tracks, each enriched for direct rendering. Tracks are not a vinyls
// list, so they are returned in one shot (favorited vinyls are paginated via GET /favorites/vinyls).
export const FavoriteTracksSchema = z
  .object({
    tracks: z.array(FavoriteTrackSchema),
  })
  .openapi('FavoriteTracks');

export const CreateFavoriteSchema = z
  .object({
    targetType: FavoriteTargetTypeSchema,
    targetId: z
      .string()
      .min(1)
      .openapi({ example: 'clz0a1b2c3d4e5f6g7h8i9j0' }),
  })
  .openapi('CreateFavorite');

export const FavoriteRefSchema = z
  .object({
    id: z.string().openapi({ example: 'clz0a1b2c3d4e5f6g7h8i9j0' }),
    targetType: FavoriteTargetTypeSchema,
    targetId: z.string().openapi({ example: 'clz0a1b2c3d4e5f6g7h8i9j0' }),
    createdAt: z.iso.datetime().openapi({ example: '2026-06-05T12:00:00.000Z' }),
  })
  .openapi('FavoriteRef');

export const MutationResultSchema = z
  .object({ success: z.boolean() })
  .openapi('MutationResult');

export const TargetTypeParamSchema = z.object({
  targetType: FavoriteTargetTypeSchema.openapi({
    param: { name: 'targetType', in: 'path' },
    example: 'vinyl',
  }),
  targetId: z
    .string()
    .min(1)
    .openapi({ param: { name: 'targetId', in: 'path' }, example: 'clz0a1b2c3d4e5f6g7h8i9j0' }),
});

export const IdParamSchema = z.object({
  id: z
    .string()
    .min(1)
    .openapi({ param: { name: 'id', in: 'path' }, example: 'clz0a1b2c3d4e5f6g7h8i9j0' }),
});

// --- Social: profiles, follows, collections ---

// The public username handle: 3-20 chars, lowercase letters / digits / underscore. Trimmed and
// lowercased before validation so the handle is normalized at the boundary; the UserProfile.username
// `@unique` is the race-safe backstop (a duplicate insert is caught as P2002 -> 409). Mirrors how the
// supported currency set is validated at the API boundary rather than by a DB constraint.
export const USERNAME_REGEX = /^[a-z0-9_]{3,20}$/;
export const UsernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(
    USERNAME_REGEX,
    'Username must be 3 to 20 characters: lowercase letters, numbers, or underscore.',
  );

// Username as a path param (other users' profiles, follow, their content).
export const UsernameParamSchema = z.object({
  username: z
    .string()
    .min(1)
    .openapi({ param: { name: 'username', in: 'path' }, example: 'vinyl_lover' }),
});

// A lightweight user, for follower/following lists and as the owner on a collection. `isFollowing`
// is relative to the signed-in viewer (false when anonymous or when it is the viewer themselves);
// `isMe` marks the viewer's own row.
export const UserSummarySchema = z
  .object({
    username: z.string().nullable().openapi({ example: 'vinyl_lover' }),
    displayName: z.string().nullable().openapi({ example: 'Vinyl Lover' }),
    avatarUrl: z.url().nullable().openapi({ example: 'https://example.com/me.jpg' }),
    isFollowing: z.boolean().openapi({ example: false }),
    isMe: z.boolean().openapi({ example: false }),
  })
  .openapi('UserSummary');

// A user's public profile: the summary plus the social counts shown on the profile screen.
export const PublicUserSchema = UserSummarySchema.extend({
  bio: z.string().nullable().openapi({ example: 'Digging deep house since 2009.' }),
  followerCount: z.number().int().openapi({ example: 42 }),
  followingCount: z.number().int().openapi({ example: 12 }),
  collectionCount: z.number().int().openapi({ example: 3 }),
  favoriteCount: z.number().int().openapi({ example: 87 }),
}).openapi('PublicUser');

// The signed-in user's own profile (used by onboarding to decide whether a username is set yet, and
// by the edit screen). `username` is null until claimed during onboarding.
export const MyProfileSchema = z
  .object({
    username: z.string().nullable().openapi({ example: 'vinyl_lover' }),
    displayName: z.string().nullable(),
    bio: z.string().nullable(),
    avatarUrl: z.url().nullable(),
  })
  .openapi('MyProfile');

// Body for editing the signed-in user's profile (everything except the username, which is claimed
// separately). A field omitted is left unchanged; null clears it.
export const UpdateProfileSchema = z
  .object({
    displayName: z.string().trim().max(50).nullish(),
    bio: z.string().trim().max(300).nullish(),
    avatarUrl: z.url().nullish(),
  })
  .openapi('UpdateProfile');

// Body for claiming / changing the username (onboarding and later edits).
export const ClaimUsernameSchema = z
  .object({ username: UsernameSchema })
  .openapi('ClaimUsername');

// Username availability check (drives the onboarding field's live validation).
export const UsernameAvailabilitySchema = z
  .object({
    username: z.string().openapi({ example: 'vinyl_lover' }),
    available: z.boolean().openapi({ example: true }),
  })
  .openapi('UsernameAvailability');

// Query for the availability check.
export const UsernameQuerySchema = z.object({
  username: z
    .string()
    .min(1)
    .openapi({ param: { name: 'username', in: 'query' }, example: 'vinyl_lover' }),
});

// A cursor-paginated page of users (followers / following).
export const UserListSchema = z
  .object({
    users: z.array(UserSummarySchema),
    nextCursor: z.string().nullable().openapi({ example: 'clz0a1b2c3d4e5f6g7h8i9j0' }),
  })
  .openapi('UserList');

// A saved group of vinyls. Carries a small preview of cover art and its owner so a card renders
// without a follow-up fetch. The vinyls themselves are paginated via GET /collections/{id}/vinyls.
export const CollectionSchema = z
  .object({
    id: z.string().openapi({ example: 'clz0a1b2c3d4e5f6g7h8i9j0' }),
    name: z.string().openapi({ example: 'Best techno 2026' }),
    description: z.string().nullable().openapi({ example: 'Peak-time cuts from this year.' }),
    vinylCount: z.number().int().openapi({ example: 12 }),
    coverArtUrls: z.array(z.url()).openapi({ example: ['https://example.com/cover.jpg'] }),
    owner: UserSummarySchema,
    createdAt: z.iso.datetime().openapi({ example: '2026-06-05T12:00:00.000Z' }),
    updatedAt: z.iso.datetime().openapi({ example: '2026-06-05T12:00:00.000Z' }),
  })
  .openapi('Collection');

export const CollectionListSchema = z
  .object({ collections: z.array(CollectionSchema) })
  .openapi('CollectionList');

export const CreateCollectionSchema = z
  .object({
    name: z.string().trim().min(1).max(80).openapi({ example: 'Best techno 2026' }),
    description: z.string().trim().max(300).nullish(),
  })
  .openapi('CreateCollection');

export const UpdateCollectionSchema = z
  .object({
    name: z.string().trim().min(1).max(80).openapi({ example: 'Best techno 2026' }),
    description: z.string().trim().max(300).nullish(),
  })
  .openapi('UpdateCollection');

// Body for adding a vinyl to a collection.
export const AddCollectionVinylSchema = z
  .object({ vinylId: z.string().min(1).openapi({ example: 'clz0a1b2c3d4e5f6g7h8i9j0' }) })
  .openapi('AddCollectionVinyl');

// Which of the signed-in user's collections contain a given vinyl (drives the "add to collection"
// sheet's checkmarks). Ids only, mirroring FavoriteIds.
export const CollectionMembershipsSchema = z
  .object({ collectionIds: z.array(z.string()) })
  .openapi('CollectionMemberships');

// Query carrying a target vinyl id (the collection-memberships lookup for the add-to-collection sheet).
export const VinylIdQuerySchema = z.object({
  vinylId: z
    .string()
    .min(1)
    .openapi({ param: { name: 'vinylId', in: 'query' }, example: 'clz0a1b2c3d4e5f6g7h8i9j0' }),
});

// Path params for a collection-vinyl membership (remove a vinyl from a collection).
export const CollectionVinylParamSchema = z.object({
  id: z
    .string()
    .min(1)
    .openapi({ param: { name: 'id', in: 'path' }, example: 'clz0a1b2c3d4e5f6g7h8i9j0' }),
  vinylId: z
    .string()
    .min(1)
    .openapi({ param: { name: 'vinylId', in: 'path' }, example: 'clz0a1b2c3d4e5f6g7h8i9j0' }),
});

// --- Cursor pagination (shared by every paginated list) ---

// Query for a cursor-paginated list: a page size and an opaque cursor (the id of the last row of
// the previous page). Omit `cursor` for the first page. `limit` is coerced from the query string.
export const PaginationQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20).openapi({
    param: { name: 'limit', in: 'query' },
    example: 20,
  }),
  cursor: z
    .string()
    .min(1)
    .optional()
    .openapi({ param: { name: 'cursor', in: 'query' }, example: 'clz0a1b2c3d4e5f6g7h8i9j0' }),
});

export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;

// Optional genre filter for the vinyls list: a comma-separated list of genre slugs (e.g.
// `?genres=disco,funk`). Comma-separated (rather than a repeated query param) keeps the value a
// plain string, which both `@hono/zod-openapi` query parsing and the generated client handle
// cleanly. Matching is OR: a vinyl shows if it carries ANY of the selected genres. Parse the raw
// value with `parseGenreSlugs`.
export const GenreFilterQuerySchema = z.object({
  genres: z
    .string()
    .optional()
    .openapi({ param: { name: 'genres', in: 'query' }, example: 'disco,funk' }),
});

// Split the raw `genres` query value into clean slugs (trimmed, empties dropped, deduped).
export function parseGenreSlugs(raw: string | undefined): string[] {
  if (!raw) return [];
  const slugs = raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return [...new Set(slugs)];
}

// Query for full-text search (GET /vinyls/search). `q` is the search text. Results are relevance
// ranked (not keyset friendly), so this list pages by offset carried in `cursor`, like GET /vinyls;
// the response reuses VinylListSchema so the client and react-query machinery are shared.
export const SearchQuerySchema = z.object({
  q: z
    .string()
    .min(1)
    .openapi({ param: { name: 'q', in: 'query' }, example: 'aphex twin' }),
  limit: z.coerce.number().int().min(1).max(50).default(20).openapi({
    param: { name: 'limit', in: 'query' },
    example: 20,
  }),
  cursor: z
    .string()
    .min(1)
    .optional()
    .openapi({ param: { name: 'cursor', in: 'query' }, example: '20' }),
});

// Prisma findMany args for keyset (cursor) pagination. Over-fetch by one row so the handler can tell
// whether a further page exists. Pair every use with a deterministic orderBy ending in `id`. The
// explicit return type (rather than a `... as const` union) keeps the spread assignable to Prisma's
// findMany args: a `cursor`-as-const union widens to `cursor?: {id} | undefined`, which trips up the
// generated arg type.
export function cursorArgs(
  limit: number,
  cursor: string | undefined,
): { take: number; cursor?: { id: string }; skip?: number } {
  return cursor ? { take: limit + 1, cursor: { id: cursor }, skip: 1 } : { take: limit + 1 };
}

// Slice the over-fetched rows into a single page plus the cursor for the following page (the id of
// the page's last row, or null when there are no further rows). The cursor is the ordered row's id.
export function toPage<T extends { id: string }>(
  rows: T[],
  limit: number,
): { items: T[]; nextCursor: string | null } {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const last = items.at(-1);
  return { items, nextCursor: hasMore && last ? last.id : null };
}

// The `include` shape `toVinylSummaryDto` expects: tracks, genres, and the per-shop offers needed to
// compute the cheapest price and shop count. Shared by every route that returns vinyl summaries.
export const vinylSummaryInclude = {
  tracks: { orderBy: { position: 'asc' } },
  // Only surface validated genres; unreviewed ones the scraper discovered stay hidden.
  genres: { where: { genre: { validated: true } }, include: { genre: true } },
  shopVinyls: {
    select: { shopId: true, offers: { select: { currentPrice: true, currentCurrency: true } } },
  },
} as const;

// --- Prisma row -> wire DTO mappers (Decimal -> number, Date -> ISO string) ---

// The shapes the route queries produce, declared via Prisma's payload helper so the mappers
// stay in lockstep with the `include`s in routes/vinyls.ts.
type VinylSummaryRow = Prisma.VinylGetPayload<{
  include: {
    tracks: true;
    genres: { include: { genre: true } };
    shopVinyls: { select: { shopId: true; offers: { select: { currentPrice: true; currentCurrency: true } } } };
  };
}>;

type VinylDetailRow = Prisma.VinylGetPayload<{
  include: {
    tracks: true;
    genres: { include: { genre: true } };
    shopVinyls: { include: { shop: true; offers: true } };
  };
}>;

type ShopVinylWithOffersRow = VinylDetailRow['shopVinyls'][number];
type OfferRow = ShopVinylWithOffersRow['offers'][number];

export function toShopDto(row: ShopRow): z.infer<typeof ShopSchema> {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    baseUrl: row.baseUrl,
    address: row.address,
    country: row.country,
  };
}

export function toGenreDto(row: GenreRow): z.infer<typeof GenreSchema> {
  return { id: row.id, name: row.name, slug: row.slug };
}

export function toTrackDto(row: VinylSummaryRow['tracks'][number]): z.infer<typeof TrackSchema> {
  return {
    id: row.id,
    position: row.position,
    title: row.title,
    durationSeconds: row.durationSeconds,
    previewUrl: row.previewUrl,
  };
}

// An offer's shop and source URL live on its parent ShopVinyl, so the mapper takes both. The
// converter turns the shop's listed (original) price into the request's display currency; both the
// converted and the original price/currency are returned.
export function toOfferDto(
  offer: OfferRow,
  shopVinyl: ShopVinylWithOffersRow,
  converter: CurrencyConverter,
): z.infer<typeof OfferSchema> {
  const originalPrice = offer.currentPrice === null ? null : Number(offer.currentPrice);
  const converted =
    originalPrice === null ? null : converter.convert(originalPrice, offer.currentCurrency);
  return {
    id: offer.id,
    shop: toShopDto(shopVinyl.shop),
    sourceUrl: shopVinyl.sourceUrl,
    stockStatus: offer.stockStatus,
    condition: offer.condition,
    price: converted === null ? null : converted.amount,
    currency: converted === null ? converter.target : converted.currency,
    originalPrice,
    originalCurrency: offer.currentCurrency,
    scrapedAt: offer.scrapedAt === null ? null : offer.scrapedAt.toISOString(),
  };
}

// Compute the cheapest current price across all offers on all of a vinyl's shop listings, comparing
// in the display currency (so a cheaper GBP offer beats a pricier EUR one correctly). Returns the
// converted amount and the currency it is expressed in (the converter's target).
function lowestOffer(
  shopVinyls: { offers: { currentPrice: Prisma.Decimal | null; currentCurrency: string | null }[] }[],
  converter: CurrencyConverter,
): { lowestPrice: number | null; currency: string | null } {
  let lowestPrice: number | null = null;
  let currency: string | null = null;
  for (const shopVinyl of shopVinyls) {
    for (const offer of shopVinyl.offers) {
      if (offer.currentPrice === null) continue;
      const converted = converter.convert(Number(offer.currentPrice), offer.currentCurrency);
      if (lowestPrice === null || converted.amount < lowestPrice) {
        lowestPrice = converted.amount;
        currency = converted.currency;
      }
    }
  }
  return { lowestPrice, currency };
}

export function toVinylSummaryDto(row: VinylSummaryRow, converter: CurrencyConverter): VinylSummary {
  const { lowestPrice, currency } = lowestOffer(row.shopVinyls, converter);
  // One ShopVinyl per shop that lists this record; count the distinct shops.
  const shopCount = new Set(row.shopVinyls.map((sv) => sv.shopId)).size;
  return {
    id: row.id,
    title: row.title,
    artist: row.artist,
    year: row.year,
    coverArtUrl: row.coverArtUrl,
    label: row.label,
    format: row.format,
    genres: row.genres.map((vg) => toGenreDto(vg.genre)),
    tracks: row.tracks.map(toTrackDto),
    lowestPrice,
    currency,
    shopCount,
  };
}

// Map a self-contained search document straight to the `VinylSummary` wire shape (no Postgres). The
// document already holds the cheapest offer's ORIGINAL price + currency; convert that single pair into
// the request's display currency, exactly as `lowestOffer` does for the DB path. When the document has
// no priced offer, both price and currency are null (matching the DB path's empty-offers result).
export function meiliDocToVinylSummary(
  doc: VinylSearchDocument,
  converter: CurrencyConverter,
): VinylSummary {
  const converted = doc.lowestPrice === null ? null : converter.convert(doc.lowestPrice, doc.lowestCurrency);
  return {
    id: doc.id,
    title: doc.title,
    artist: doc.artist,
    year: doc.year,
    coverArtUrl: doc.coverArtUrl,
    label: doc.label,
    format: doc.format,
    genres: doc.genres.map((g) => ({ id: g.id, name: g.name, slug: g.slug })),
    tracks: doc.tracks.map((t) => ({
      id: t.id,
      position: t.position,
      title: t.title,
      durationSeconds: t.durationSeconds,
      previewUrl: t.previewUrl,
    })),
    lowestPrice: converted === null ? null : converted.amount,
    currency: converted === null ? null : converted.currency,
    shopCount: doc.shopCount,
  };
}

export function toVinylDto(row: VinylDetailRow, converter: CurrencyConverter): Vinyl {
  return {
    ...toVinylSummaryDto(row, converter),
    offers: row.shopVinyls.flatMap((sv) =>
      sv.offers.map((offer) => toOfferDto(offer, sv, converter)),
    ),
  };
}

// A shop's identity plus how many distinct vinyls it lists. The vinyls themselves are paginated via
// GET /shops/{id}/vinyls, so the detail only carries the count for the header.
export function toShopDetailDto(row: ShopRow, vinylCount: number): ShopDetail {
  return { ...toShopDto(row), vinylCount };
}

// A favorited track row carries its parent vinyl (for display + navigation in the Favorites tab).
// The track belongs to a shop_vinyl, so its canonical album comes through that shop_vinyl.
type FavoriteTrackRow = Prisma.TrackGetPayload<{
  include: { shopVinyl: { include: { vinyl: true } } };
}>;

export function toFavoriteTrackDto(row: FavoriteTrackRow): z.infer<typeof FavoriteTrackSchema> {
  const vinyl = row.shopVinyl.vinyl;
  return {
    ...toTrackDto(row),
    vinyl: {
      id: vinyl.id,
      title: vinyl.title,
      artist: vinyl.artist,
      coverArtUrl: vinyl.coverArtUrl,
    },
  };
}

// --- Social row -> wire DTO mappers ---

// The viewer-relative flags every user DTO carries.
type ViewerFlags = { isFollowing: boolean; isMe: boolean };

// The profile fields used to render a user. Absent (null) when the user has no profile row yet.
type ProfileFields = {
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
} | null;

export function toUserSummaryDto(
  profile: ProfileFields,
  flags: ViewerFlags,
): z.infer<typeof UserSummarySchema> {
  return {
    username: profile?.username ?? null,
    displayName: profile?.displayName ?? null,
    avatarUrl: profile?.avatarUrl ?? null,
    isFollowing: flags.isFollowing,
    isMe: flags.isMe,
  };
}

export function toPublicUserDto(
  profile: NonNullable<ProfileFields> & { bio: string | null },
  flags: ViewerFlags,
  counts: {
    followerCount: number;
    followingCount: number;
    collectionCount: number;
    favoriteCount: number;
  },
): z.infer<typeof PublicUserSchema> {
  return {
    ...toUserSummaryDto(profile, flags),
    bio: profile.bio,
    ...counts,
  };
}

// The collection shape the mapper expects: the row plus a count of its vinyls and a few cover
// thumbnails for the card. The route's `include`/`select` must match this (see routes/collections.ts).
type CollectionRowForDto = {
  id: string;
  name: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
  _count: { vinyls: number };
  vinyls: { vinyl: { coverArtUrl: string | null } }[];
};

export function toCollectionDto(
  row: CollectionRowForDto,
  owner: z.infer<typeof UserSummarySchema>,
): z.infer<typeof CollectionSchema> {
  // Up to four real cover images for the card's preview grid (skip records with no cover).
  const coverArtUrls = row.vinyls
    .flatMap((cv) => (cv.vinyl.coverArtUrl ? [cv.vinyl.coverArtUrl] : []))
    .slice(0, 4);
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    vinylCount: row._count.vinyls,
    coverArtUrls,
    owner,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
