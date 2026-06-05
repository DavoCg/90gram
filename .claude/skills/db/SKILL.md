---
name: db
description: >-
  Conventions for packages/db: Prisma is the SOLE owner of the getvinyls Postgres schema and
  migrations. Read this when editing the Prisma schema, adding models or fields, running
  migrations, writing the seed script, or changing the snake_case table/column mapping that the
  Python scraper writes against. Covers the Vinyl/Track/Shop/Offer/Price/Genre models and the
  upsert keys the scraper writes against.
---

# Database (packages/db)

Prisma + PostgreSQL. **Prisma is the single source of truth for schema and migrations.** Nothing else
runs DDL against this database. The scraper (`apps/scraper`) only INSERTs/UPSERTs rows; it reflects the
live schema at runtime and never creates or alters tables.

## Generator and client

- Prisma 7 with the `prisma-client` generator, output to `src/generated/prisma` (gitignored, regenerated).
- `prisma.config.ts` points at `prisma/schema.prisma` and the seed command.
- `packages/db/src/index.ts` instantiates and re-exports a singleton `PrismaClient` plus the generated
  model/enum types. Consumers import from `@getvinyls/db`, never from the generated path directly.

## Naming and stability

- The TypeScript-facing model is camelCase; the physical schema is snake_case via explicit `@map`/`@@map`.
  This keeps the column names the scraper writes to stable and predictable. Never rename a mapped column
  without a migration and a matching update to the scraper skill.

## The model (normalized for cross-shop discovery)

A vinyl is sold by many shops, so the data is normalized rather than one flat listing row:

- `Vinyl` (`vinyls`) is the canonical release, the unit of discovery. Identified by
  `(catalogSource, catalogId)` (e.g. a Discogs release). Carries app/display fields (title, artist, year,
  coverArtUrl, label, catalogNumber, format).
- `Track` (`tracks`) belongs to a vinyl, unique on `(vinylId, position)`. Holds `previewUrl`, the audio the
  player streams (the preview now lives per-track, not per-vinyl).
- `Shop` (`shops`) is an online reseller/marketplace, unique `slug`, with `country` (the Europe focus).
- `Offer` (`offers`) is one vinyl listed at one shop: the scraped listing unit. Links `vinylId` + `shopId`,
  carries `stockStatus` (the `StockStatus` enum), `condition`, and the denormalized `currentPrice` /
  `currentCurrency`. **Unique on `(source, externalId)`** (source == the shop's slug) for idempotent
  upserts. Do not drop it.
- `Price` (`prices`) is append-only price history for an offer; the latest by `observedAt` is the current
  price (also denormalized onto `Offer`).
- `Genre` (`genres`, unique name/slug) joins to `Vinyl` through the explicit `VinylGenre` (`vinyl_genres`,
  composite PK `(vinylId, genreId)`) join table. Explicit (not Prisma's implicit `_GenreToVinyl`) so the
  reflective scraper can upsert named snake_case columns.

The scraper's idempotency keys are `shops.slug`, `vinyls (catalogSource, catalogId)`,
`tracks (vinylId, position)`, `genres.slug`, `vinyl_genres (vinylId, genreId)`, and
`offers (source, externalId)`. Do not drop or rename them without updating the scraper skill.

## Workflow

- Edit `prisma/schema.prisma`, then `pnpm --filter @getvinyls/db migrate` (creates a migration + applies it).
- `pnpm --filter @getvinyls/db generate` regenerates the client (also wired as the Turbo `db:generate` task).
- `pnpm --filter @getvinyls/db seed` loads sample vinyls (with tracks, a seed shop + offer + price, and
  genres) so the app works without the scraper. Track seeds must include real, reachable `previewUrl`s so
  the audio slice has something to play.
- When you change a model, update this skill and the scraper skill in the same change if the mapping moves.
