---
name: db
description: >-
  Conventions for packages/db: Prisma is the SOLE owner of the getvinyls Postgres schema and
  migrations. Read this when editing the Prisma schema, adding models or fields, running
  migrations, writing the seed script, or changing the snake_case table/column mapping that the
  Python scraper writes against. Covers the canonical Vinyl + ShopVinyl/Offer/Price/Track/Shop/Genre
  models, the matchKey identity, and the upsert keys the scraper writes against.
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

A vinyl is sold by many shops, so the data is normalized into a canonical release + per-shop layers:

- `Vinyl` (`vinyls`) is the **canonical, shop-agnostic release**, the unit of discovery. It carries NO
  source/shop identity, only the release (title, artist, year, coverArtUrl, label, catalogNumber, format).
  Identity is **`matchKey` (`@unique`)**, the **normalized catalog number and nothing else**: the same
  catalog from several shops collapses onto one row regardless of artist/title formatting. The scraper
  upserts on it ("match-or-create" == this upsert). A listing with no catalog number cannot be matched and
  is dropped by the scraper, so every `Vinyl` is catalog-keyed.
- `Track` (`tracks`) belongs to the canonical `Vinyl`, unique on `(vinylId, position)`. Holds `previewUrl`,
  the audio the player streams (per-track, not per-vinyl).
- `Shop` (`shops`) is an online reseller/marketplace, unique `slug`, with `country` (the Europe focus).
- `ShopVinyl` (`shop_vinyls`) is **one record as catalogued by one shop**: links a `Shop` to the `Vinyl` it
  matched (`vinylId`), holds the shop's catalog identity (`source`, `externalId`, `sourceUrl`,
  `coverArtUrl` — its own cover image) and the raw
  values it reported (`rawTitle`/`rawArtist`/`rawCatalogNumber`, for transparency + re-matching).
  **Unique on `(source, externalId)`** (source == the shop's slug). Do not drop it.
- `Offer` (`offers`) is a **purchasable offer for a `ShopVinyl`**: the commercial terms (`stockStatus` enum,
  `condition`, denormalized `currentPrice`/`currentCurrency`, `scrapedAt`). One for a single retailer, many
  for a marketplace listing (per-seller). **Unique on `(source, externalId)`**. Do not drop it.
- `Price` (`prices`) is append-only price history for an `Offer`; latest by `observedAt` is the current
  price (also denormalized onto `Offer`).
- `Genre` (`genres`, unique name/slug) joins to the canonical `Vinyl` through the explicit `VinylGenre`
  (`vinyl_genres`, composite PK `(vinylId, genreId)`) join table, so genres union across a vinyl's shops.
  `Genre.validated` (Boolean, `@default(false)`) is a curation gate: scraper-discovered genres start
  unvalidated and the public API hides them (the `/genres` list and the genres on a vinyl) until a
  human flips the flag. The scraper NEVER sets it true (insert relies on the DB default; the upsert's
  conflict path does not touch `validated`, so it preserves a human's decision). Curate it in the
  admin app (the genres list has a per-row validate toggle and a status filter).

The scraper's idempotency keys are `shops.slug`, **`vinyls.matchKey`**, `tracks (vinylId, position)`,
`genres.slug`, `vinyl_genres (vinylId, genreId)`, **`shop_vinyls (source, externalId)`**, and
`offers (source, externalId)`. Do not drop or rename them without updating the scraper skill.

## Auth tables (better-auth)

`User`, `Session`, `Account`, `Verification` (mapped to `users`, `sessions`, `accounts`,
`verifications`) back authentication. They MIRROR better-auth's core schema: better-auth reaches them
through the Prisma adapter (configured in `apps/api/src/auth.ts`) using the camelCase **field** names,
so those names must stay in lockstep with better-auth; the snake_case `@map`/`@@map` only renames the
physical columns and is invisible to better-auth. better-auth supplies its own ids, so these models
carry no `@default` on `id`. The scraper never touches these tables. If you bump better-auth or add an
auth plugin that needs new columns, regenerate the expected shape and migrate here (Prisma stays the
sole owner; never let the better-auth CLI run DDL against this database).

## Per-user data (favorites, settings)

`Favorite` (`favorites`) and `UserSetting` (`user_settings`) hang off `User` and are owned by the
app, not the scraper (it never touches them). `UserSetting` is a 1:1 with `User` (PK == `userId`),
holding the display `currency` (ISO-4217, defaults to `"EUR"`) the API converts all prices into; it
is kept as its own table rather than columns on `users` so the better-auth mirror stays exact. The
supported currency set is validated at the API boundary (Zod), not by a DB enum, mirroring how
`Offer.currentCurrency` is a plain string.

## Workflow

- Edit `prisma/schema.prisma`, then `pnpm --filter @getvinyls/db migrate` (creates a migration + applies it).
- `pnpm --filter @getvinyls/db generate` regenerates the client (also wired as the Turbo `db:generate` task).
- There is no seed: the database is populated solely by the scraper (`apps/scraper`). Catalog data comes
  from running the spiders; the app reads through whatever they have written.
- When you change a model, update this skill and the scraper skill in the same change if the mapping moves.
