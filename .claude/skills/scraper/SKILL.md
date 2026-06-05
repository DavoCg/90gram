---
name: scraper
description: >-
  Conventions for apps/scraper: a Python Scrapy project that writes vinyl listings straight into
  the shared Postgres (no API hop). Read this when adding or editing a spider, the PostgresPipeline,
  items, settings/politeness, or the uv/ruff/pyright tooling. Prisma owns the schema; the scraper
  reflects the live tables (SQLAlchemy autoload) and only upserts rows (one transaction per listing across
  the shop/vinyl/track/genre/offer/price tables).
---

# Scraper (apps/scraper)

Python 3.12+, Scrapy, managed by `uv`. Lint/format with `ruff`, type-check with `pyright` (strict).
NOT a pnpm workspace member; Turbo drives it via a thin `package.json` that shells out to `uv`/`ruff`/`pyright`
(`lint`, `typecheck`, `scrape` tasks). It shares `DATABASE_URL` with Prisma and writes rows ONLY.

## Layout

Standard Scrapy project under `getvinyls_scraper/`: `settings.py`, `items.py`, `pipelines.py`,
`middlewares.py`, and one spider per source in `spiders/`. Adding a reseller is adding a spider, nothing else.

## Politeness (Scrapy settings, not custom code)

`ROBOTSTXT_OBEY = True`, AutoThrottle enabled, a sane `DOWNLOAD_DELAY` and per-domain concurrency cap,
the built-in retry middleware for 429/5xx, and a real identifying `USER_AGENT`. Where a source offers an
official API, request its JSON instead of parsing HTML. Review the target's robots.txt and terms before crawling.

## PostgresPipeline (direct DB writes)

- Opens a connection / reflects tables in `open_spider`, closes in `close_spider`.
- Validates each item (pydantic `ListingItem`) before write. One `ListingItem` fans out across several
  tables, so it is written in **one transaction per item** that wires the foreign keys from the upserts'
  `RETURNING id` (we trade the old cross-item batch for correct relational writes; every step still upserts
  idempotently). The write order is shop -> vinyl -> tracks -> genres (+ `vinyl_genres`) -> offer -> price.
- Idempotency keys: `shops.slug`, `vinyls (catalog_source, catalog_id)`, `tracks (vinyl_id, position)`,
  `genres.slug`, `vinyl_genres (vinyl_id, genre_id)`, `offers (source, external_id)`. Re-running a crawl
  updates rows, never duplicates them. `prices` is append-only: a row is inserted only when the offer's
  price actually changed (compare against the existing `current_price` before upserting the offer).
- `id` and `updated_at` have no DB default (Prisma sets them app-side), so the pipeline supplies them for
  every table that has those columns; `vinyl_genres` is exempt (composite PK, no id/updated_at).
  `created_at` / `observed_at` have DB defaults.
- **No DDL, ever.** Reflect the live tables with SQLAlchemy Core `autoload_with` instead of hand-copying
  column names, so the scraper cannot drift from Prisma's schema. If Prisma renames a column, the reflection
  picks it up; never hardcode column names that duplicate the Prisma mapping.

## Schema ownership

Prisma (`packages/db`) is the single source of truth. The scraper writes the normalized tables it reflects
(`shops`, `vinyls`, `tracks`, `genres`, `vinyl_genres`, `offers`, `prices`) by their snake_case columns.
It must not migrate, create, or alter anything. See the db skill for the model and the upsert keys.

## Running

`uv run scrapy crawl <spider>` (Turbo `scrape` task). One-shot job, safe to schedule later (out of scope here).
The first/example spider is `discogs`. When `DISCOGS_TOKEN` is set it hits the official Discogs API; with
`DISCOGS_FIXTURE` set it reads a local JSON fixture (offline/dev). Both paths flow through the same pipeline,
so idempotency is identical.
