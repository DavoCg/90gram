import { z } from '@hono/zod-openapi';
import type { Prisma, ShopRow, GenreRow } from '@getvinyls/db';

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
    price: z.number().nullable().openapi({ example: 24.99 }),
    currency: z.string().nullable().openapi({ example: 'EUR' }),
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
    // Cheapest current price across this vinyl's offers, and how many shops list it.
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

// Prisma findMany args for keyset (cursor) pagination. Over-fetch by one row so the handler can tell
// whether a further page exists. Pair every use with a deterministic orderBy ending in `id`.
export function cursorArgs(limit: number, cursor: string | undefined) {
  return cursor
    ? ({ take: limit + 1, cursor: { id: cursor }, skip: 1 } as const)
    : ({ take: limit + 1 } as const);
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
  genres: { include: { genre: true } },
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

// An offer's shop and source URL live on its parent ShopVinyl, so the mapper takes both.
export function toOfferDto(
  offer: OfferRow,
  shopVinyl: ShopVinylWithOffersRow,
): z.infer<typeof OfferSchema> {
  return {
    id: offer.id,
    shop: toShopDto(shopVinyl.shop),
    sourceUrl: shopVinyl.sourceUrl,
    stockStatus: offer.stockStatus,
    condition: offer.condition,
    price: offer.currentPrice === null ? null : Number(offer.currentPrice),
    currency: offer.currentCurrency,
    scrapedAt: offer.scrapedAt === null ? null : offer.scrapedAt.toISOString(),
  };
}

// Compute the cheapest current price (and its currency) across all offers on all of a vinyl's
// shop listings.
function lowestOffer(
  shopVinyls: { offers: { currentPrice: Prisma.Decimal | null; currentCurrency: string | null }[] }[],
): { lowestPrice: number | null; currency: string | null } {
  let lowestPrice: number | null = null;
  let currency: string | null = null;
  for (const shopVinyl of shopVinyls) {
    for (const offer of shopVinyl.offers) {
      if (offer.currentPrice === null) continue;
      const value = Number(offer.currentPrice);
      if (lowestPrice === null || value < lowestPrice) {
        lowestPrice = value;
        currency = offer.currentCurrency;
      }
    }
  }
  return { lowestPrice, currency };
}

export function toVinylSummaryDto(row: VinylSummaryRow): VinylSummary {
  const { lowestPrice, currency } = lowestOffer(row.shopVinyls);
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

export function toVinylDto(row: VinylDetailRow): Vinyl {
  return {
    ...toVinylSummaryDto(row),
    offers: row.shopVinyls.flatMap((sv) => sv.offers.map((offer) => toOfferDto(offer, sv))),
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
