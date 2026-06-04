---
name: db
description: >-
  Conventions for packages/db: Prisma is the SOLE owner of the getvinyls Postgres schema and
  migrations. Read this when editing the Prisma schema, adding models or fields, running
  migrations, writing the seed script, or changing the snake_case table/column mapping that the
  Python scraper writes against. Covers the Record model and the (source, externalId) upsert key.
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
- The `Record` model carries app fields (title, artist, year, coverArtUrl, previewUrl) AND the marketplace
  fields the scraper populates: source, externalId, sourceUrl, price, currency, availability, scrapedAt.
- Unique constraint on `(source, externalId)` enables idempotent upserts. Do not drop it.

## Workflow

- Edit `prisma/schema.prisma`, then `pnpm --filter @getvinyls/db migrate` (creates a migration + applies it).
- `pnpm --filter @getvinyls/db generate` regenerates the client (also wired as the Turbo `db:generate` task).
- `pnpm --filter @getvinyls/db seed` loads sample records so the app works without the scraper. Seeds must
  include real, reachable `previewUrl`s so the audio slice has something to play.
- When you change a model, update this skill and the scraper skill in the same change if the mapping moves.
