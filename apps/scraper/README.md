# getvinyls scraper

A Scrapy project that crawls vinyl resellers and writes listings straight into the shared
Postgres. It does NOT go through the API. Prisma (in `packages/db`) owns the schema; this
scraper only writes rows and never runs DDL.

## Tooling

- Python 3.12+, managed by `uv` (`pyproject.toml` + `uv.lock`).
- `ruff` for lint + format, `pyright` (strict) for types.
- Not a real pnpm dependency: the sibling `package.json` is a thin Turbo wrapper whose scripts
  shell out to `uv` / `ruff` / `pyright`.

```bash
uv sync            # create the venv and install deps (provisions Python 3.12)
uv run ruff check . && uv run ruff format --check .
uv run pyright
uv run scrapy crawl discogs
```

From the repo root these are also `pnpm --filter @getvinyls/scraper {lint,typecheck,scrape}` and are
covered by `pnpm lint` / `pnpm typecheck` / `pnpm scrape`.

## Layout

```
getvinyls_scraper/
  settings.py      politeness + pipeline registration + DATABASE_URL loading
  items.py         RecordItem (pydantic) validated before write
  pipelines.py     PostgresPipeline: reflected schema + batched upsert
  middlewares.py   placeholder (politeness is all built-in via settings)
  spiders/
    discogs.py          Discogs spider (official API mode or offline fixture mode)
    coldcutshotwax.py   ColdCuts // HotWax spider (Shopify catalog JSON)
fixtures/
  discogs_sample.json        offline sample data (Discogs)
  coldcutshotwax_sample.json offline sample data (raw Shopify products)
```

Adding a reseller is adding a spider in `spiders/`, nothing else.

## How it writes

`PostgresPipeline` reflects the live `records` table with SQLAlchemy Core (`autoload_with`), so it never
hand-maintains column names and cannot drift from Prisma. It upserts in batches with
`INSERT ... ON CONFLICT (source, external_id) DO UPDATE`. `id` and `updated_at` have no database default
(Prisma sets them in app code), so the pipeline supplies them; on conflict it updates everything except the
natural key, `id`, and `created_at`.

## Run modes

- **API mode:** set `DISCOGS_TOKEN` (https://www.discogs.com/settings/developers). The spider queries the
  official Discogs search JSON API. Politeness (robots.txt, AutoThrottle, retry on 429/5xx, identifying
  User-Agent) is configured in `settings.py`. Always review a source's robots.txt and terms before crawling;
  here we use the sanctioned official API rather than scraping HTML.
- **Fixture mode:** set `DISCOGS_FIXTURE` (and leave `DISCOGS_TOKEN` empty) to read a local JSON file via a
  `file://` request. Useful offline. Same pipeline, same idempotency.

### `coldcutshotwax` (ColdCuts // HotWax)

`uv run scrapy crawl coldcutshotwax`. ColdCuts // HotWax runs on Shopify, which serves its public catalog
as JSON, so the spider uses that for metadata (robots.txt confirms collection/product JSON is crawlable).
The one thing the JSON lacks is the tracklist; that lives in a server-rendered metafield exposed nowhere in
the bulk JSON (not `products.json`, `/products/<h>.js`, the embedded ProductJson, nor the Storefront API),
but it IS rendered onto every collection page as `<span data-producturl data-track data-src>` elements.
Metadata is cheap (250/page) and tracks are slow, so we load metadata first and stream inserts during the
track crawl. Three phases hand off on the `spider_idle` signal:

1. **Metadata (phase A):** walk the whole catalog via `/products.json` into an in-memory `handle -> product`
   map of NEW products. Fast, emits nothing yet.
2. **Tracks + streaming insert (phase B):** walk every non-second-hand collection's HTML pages (~36
   products/page). For each product whose track spans appear on a page, emit its listing immediately
   (joined with the cached metadata), so rows are inserted per collection page as the crawl proceeds.
3. **Flush (phase C):** emit the remaining new products that had no audio preview (never appeared in a track
   span) with empty tracklists, so the catalog is covered in full.

A record's genres come from its own `product_type` and music `tags` (a noise filter drops sale batches,
seller codes and pressing notes), not the collection title, so the genres table stays clean. New vinyl only:
used records (`2nd-hand`/`vatmarginscheme`) are excluded from the metadata map in phase A, and second-hand
collections are skipped in phase B. A listing emitted with no tracks logs a `WARNING` with its product URL.

- **Live mode (default):** no credentials, the catalog is public.
- **`-a collections=handle1,handle2`:** restrict phase B to those collections (targeted re-crawl / test);
  phase A still walks the whole catalog.
- **Fixture mode:** set `CCHW_FIXTURE` to a local JSON file (raw Shopify product objects, each optionally
  carrying a `tracklist_html` of collection-style track spans) to read via `file://` instead of crawling.

Re-running a crawl updates rows instead of duplicating them (unique on `source` + `external_id`).
