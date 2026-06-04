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
    discogs.py     the one reseller spider (API mode or offline fixture mode)
fixtures/
  discogs_sample.json   offline sample data
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

Re-running a crawl updates rows instead of duplicating them (unique on `source` + `external_id`).
