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

export const VinylListSchema = z
  .object({
    vinyls: z.array(VinylSummarySchema),
    total: z.number().int(),
  })
  .openapi('VinylList');

export const ShopListSchema = z
  .object({
    shops: z.array(ShopSchema),
    total: z.number().int(),
  })
  .openapi('ShopList');

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

export const IdParamSchema = z.object({
  id: z
    .string()
    .min(1)
    .openapi({ param: { name: 'id', in: 'path' }, example: 'clz0a1b2c3d4e5f6g7h8i9j0' }),
});

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
  return { id: row.id, slug: row.slug, name: row.name, baseUrl: row.baseUrl, country: row.country };
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
