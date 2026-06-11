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
    deejay.py           deejay.de spider (paginated listing HTML)
    dancingvinyl.py     Dancing Vinyl spider (Common-Ground GraphQL API)
fixtures/
  discogs_sample.json        offline sample data (Discogs)
  coldcutshotwax_sample.json offline sample data (raw Shopify products)
  deejay_sample.json         offline sample data (deejay product pages)
  dancingvinyl_sample.json   offline sample data (raw inventory items)
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

### `dancingvinyl` (Dancing Vinyl Record Shop)

`uv run scrapy crawl dancingvinyl`. Dancing Vinyl (EUR) runs on the Common-Ground.io platform: a
JavaScript storefront backed by a public GraphQL endpoint at `/graphql`. We query that structured
JSON straight rather than scraping markup (robots.txt allows the default user-agent everywhere; only
named AI crawlers are disallowed, and our identifying browser User-Agent is not one of them). The
catalogue (`/catalogue?stock=instock`) is the `inventory(stock: "instock", page, limit)` query; one
call returns a page of fully-formed items (release metadata, label/catalog number, formats, genres,
tracklist with MP3 previews, and the shop's listings with price + stock) plus `pagination.pages`. The
spider walks every page and emits each item as it goes, so rows stream as pages arrive. The numeric
release `id` is the offer's stable `external_id`.

New vinyl only: the `stock=instock` filter still returns second-hand copies, so the spider drops any
release whose only listing is `secondHand` and always picks the new listing when one exists; a
non-vinyl `format` is a backstop guard. The free-text `duration` field is mapped to
`duration_seconds` only when it parses as an actual time, never guessed.

- **Live mode (default):** no credentials, the GraphQL catalogue is public.
- **`-a stock=preorder`:** query a different stock filter (default `instock`). `-a limit=N` sets the
  page size; `-a max_pages=N` / `-a max_items=N` cap the crawl (handy for a quick test run).
- **Fixture mode:** set `DANCINGVINYL_FIXTURE` to a local JSON file (a list of raw `inventory.items`
  objects) to read via `file://` instead of crawling.

Re-running a crawl updates rows instead of duplicating them (unique on `source` + `external_id`).

## Running in the cloud (Scrapyd on Fly.io)

Locally you run a spider one-shot with `uv run scrapy crawl <spider>`. In the cloud the spiders run on
**Scrapyd**, a long-running daemon that runs Scrapy projects from a packaged egg and exposes a JSON API.
It lives in its own always-on Fly app, `getvinyls-scraper`, deployed exactly like `apps/jobs` and
`apps/api` (`Dockerfile` + `fly.toml` + `.github/workflows/fly-deploy-scraper.yml` on pushes to
`develop`).

- **Baked egg.** The image builds the project into a Scrapy egg at build time (`setup.py` ->
  `bdist_egg`) and pre-loads it into Scrapyd's eggs dir, so deploying is just shipping the image. There
  is no runtime egg upload and no public `addversion` endpoint.
- **Private only.** Scrapyd binds `0.0.0.0:6800` (`scrapyd.conf`) but publishes NO public ports, so it
  is reachable only over Fly's private network at `getvinyls-scraper.internal:6800`. Health is checked
  via `GET /daemonstatus.json`.
- **Writes to Postgres.** Each spider subprocess inherits `DATABASE_URL` (a Fly secret) and writes
  through the same `PostgresPipeline` as a local run, so idempotency is identical.

### Scheduling

Scrapyd has no scheduler of its own. The `apps/jobs` cron daemon owns the timing: it runs one
`scrape-<spider>` job per spider, each POSTing a run to Scrapyd's `schedule.json` on its cron and
polling `listjobs.json` until it finishes. Every shop runs every 30 minutes by default, and each job
also fires once when the jobs daemon launches (see `apps/jobs/README.md`). Tune the crons via the
`SCRAPE_*_CRON` env vars on the jobs app.

### One-time setup

```bash
fly apps create getvinyls-scraper
fly secrets set -c apps/scraper/fly.toml DATABASE_URL=postgres://...
fly deploy -c apps/scraper/fly.toml          # from the repo root
```

Kick a spider by hand (over the private network, e.g. from another Fly app in the org):

```bash
curl -d project=getvinyls_scraper -d spider=discogs http://getvinyls-scraper.internal:6800/schedule.json
```
