import { z } from '@hono/zod-openapi';
import type { RecordRow } from '@getvinyls/db';

// The wire shape for a record. Zod schemas are the source of truth for the API;
// the OpenAPI document and the generated client types both derive from these.
export const RecordSchema = z
  .object({
    id: z.string().openapi({ example: 'clz0a1b2c3d4e5f6g7h8i9j0' }),
    title: z.string().openapi({ example: 'Midnight Grooves' }),
    artist: z.string().openapi({ example: 'The Turntables' }),
    year: z.number().int().nullable().openapi({ example: 1979 }),
    coverArtUrl: z.url().nullable().openapi({ example: 'https://example.com/cover.jpg' }),
    previewUrl: z.url().nullable().openapi({ example: 'https://example.com/preview.mp3' }),
    source: z.string().openapi({ example: 'discogs' }),
    externalId: z.string().openapi({ example: '123456' }),
    sourceUrl: z.url().nullable().openapi({ example: 'https://www.discogs.com/release/123456' }),
    price: z.number().nullable().openapi({ example: 24.99 }),
    currency: z.string().nullable().openapi({ example: 'USD' }),
    availability: z.string().nullable().openapi({ example: 'in_stock' }),
    scrapedAt: z.iso.datetime().nullable().openapi({ example: '2026-06-01T12:00:00.000Z' }),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .openapi('Record');

export type Record = z.infer<typeof RecordSchema>;

export const RecordListSchema = z
  .object({
    records: z.array(RecordSchema),
    total: z.number().int(),
  })
  .openapi('RecordList');

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

// Map a Prisma row to the wire shape: Decimal -> number, Date -> ISO string.
export function toRecordDto(row: RecordRow): Record {
  return {
    id: row.id,
    title: row.title,
    artist: row.artist,
    year: row.year,
    coverArtUrl: row.coverArtUrl,
    previewUrl: row.previewUrl,
    source: row.source,
    externalId: row.externalId,
    sourceUrl: row.sourceUrl,
    price: row.price === null ? null : Number(row.price),
    currency: row.currency,
    availability: row.availability,
    scrapedAt: row.scrapedAt === null ? null : row.scrapedAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
