# getvinyls

A vinyl record discovery app where audio playback is the centerpiece. This repo is the
foundation: a type-safe data pipeline wired end to end, plus one working vertical slice
(a list screen that fetches from the API and plays an audio preview), and one reseller
spider feeding the database.

## Stack

- **Monorepo:** pnpm workspaces + Turborepo. Node 22, pnpm 10.
- **Mobile:** Expo SDK 56 (dev build via `expo prebuild`, not Expo Go), Expo Router (typed routes),
  Uniwind (Tailwind v4 for RN), TanStack Query v5, FlashList.
- **Audio:** `react-native-audio-api` (Software Mansion, Web Audio model) with a hand-built player layer.
- **API:** Hono + `@hono/zod-openapi` (Zod is the source of truth; OpenAPI 3.1 is generated).
- **API client:** `openapi-typescript` types + an `openapi-fetch` client (no React).
- **DB:** PostgreSQL + Prisma 7 (sole owner of schema and migrations).
- **Scraper:** Python 3.12 + Scrapy, managed by `uv`, writing directly to Postgres.

See `CLAUDE.md` and `.claude/skills/<area>/SKILL.md` for the per-area conventions.

## Layout

```
apps/
  api/        Hono + zod-openapi server (read-only public API)
  mobile/     Expo app (Expo Router, Uniwind, react-query, react-native-audio-api)
  scraper/    Scrapy spiders -> Postgres (Python, uv; thin package.json for Turbo)
packages/
  db/         Prisma schema, generated client, migrations, seed
  api-client/ generated openapi types + openapi-fetch client
  tsconfig/   shared base tsconfig
```

## Prerequisites

- Node 22 and pnpm 10 (`corepack enable` or install pnpm directly).
- A running PostgreSQL 16. Set its URL in `.env` (see below).
- `uv` (for the scraper). It provisions Python 3.12 on first `uv sync`.
- For mobile: Xcode and/or Android SDK to build the **dev build** (audio needs native modules,
  so Expo Go will not work).

## Setup

```bash
cp .env.example .env          # then edit DATABASE_URL etc.
pnpm install                  # installs all JS workspaces
pnpm --filter @getvinyls/db generate   # generate the Prisma client
pnpm --filter @getvinyls/db migrate    # create/apply migrations
pnpm --filter @getvinyls/db seed       # seed sample records (with real preview URLs)
pnpm --filter @getvinyls/scraper setup # uv sync: create the scraper venv
```

### Environment

All vars live in `.env` (validated with Zod at boot for the API and mobile; the scraper reads them too).
A single `DATABASE_URL` is shared by Prisma and the scraper. Prisma is the only thing that migrates it.

| Var                        | Used by        | Notes                                                       |
| -------------------------- | -------------- | ----------------------------------------------------------- |
| `DATABASE_URL`             | db, api, scraper | One Postgres URL. Prisma owns the schema; scraper writes rows. |
| `API_PORT`                 | api            | Defaults to 8787.                                           |
| `EXPO_PUBLIC_API_BASE_URL` | mobile         | Use your LAN IP (not 127.0.0.1) so a device can reach the API. |
| `DISCOGS_TOKEN`            | scraper        | Official Discogs API token. Empty -> spider runs in fixture mode. |
| `DISCOGS_FIXTURE`          | scraper        | Local JSON fixture for offline/dev crawls.                  |

## Run

```bash
pnpm dev          # boots the API and Metro together (Turbo)
pnpm typecheck    # strict TS across all packages + pyright on the scraper
pnpm lint         # ESLint across TS + ruff on the scraper
pnpm build        # builds where applicable
```

- API only: `pnpm --filter @getvinyls/api dev` -> http://127.0.0.1:8787
  (`/records`, `/records/:id`, `/openapi.json`, `/docs`).
- Mobile: build via **EAS** (recommended, no local Xcode/Android needed) or locally. See below.

## Mobile build (EAS)

The app is a dev build (not Expo Go) because `react-native-audio-api` needs native modules. EAS Build
compiles it in the cloud, so you do not need Xcode or Android Studio locally. Config lives in
`apps/mobile/eas.json` (profiles: `development`, `preview`, `production`), and Metro is configured for this
pnpm monorepo (watches the workspace root, resolves the hoisted `node_modules`).

One-time, from `apps/mobile`:

```bash
pnpm dlx eas-cli login        # log into your Expo account
pnpm dlx eas-cli init         # creates the EAS project and writes extra.eas.projectId into app.json
```

Build a development client (iOS Simulator + Android APK, no store credentials needed to start):

```bash
cd apps/mobile
pnpm dlx eas-cli build --profile development --platform ios       # or android, or all
```

When it finishes, install the artifact (drag the simulator build onto a booted simulator, or scan the QR
for the APK), then start Metro and connect the dev client:

```bash
pnpm --filter @getvinyls/mobile dev   # expo start --dev-client
```

Notes:
- Set `EXPO_PUBLIC_API_BASE_URL` to a host the device/simulator can reach (a LAN IP for a physical device;
  the dev profile defaults to `http://127.0.0.1:8787` for the simulator). EAS reads build-time env from the
  profile's `env` block.
- `preview` builds an internal-distribution build for testers; `production` builds for the stores
  (`pnpm dlx eas-cli submit` to upload). Those need Apple/Google credentials, which EAS can manage.
- Local alternative (requires Xcode/Android SDK): `pnpm --filter @getvinyls/mobile prebuild` then
  `... ios` / `... android`.

### EAS Workflows (CI/CD)

Cloud CI/CD lives in `apps/mobile/.eas/workflows/` (run on Expo's infra, triggered from git or manually):

| Workflow                 | Trigger                       | What it does                                                  |
| ------------------------ | ----------------------------- | ------------------------------------------------------------ |
| `ci.yml`                 | pull request to `main`        | Installs, regenerates API types, typechecks + lints mobile (no build credits). |
| `development-build.yml`  | manual (`workflow_dispatch`)  | Builds dev clients (iOS Simulator + Android APK).            |
| `deploy-production.yml`  | manual (`workflow_dispatch`)  | Builds production iOS + Android; store-submit jobs are included but commented until credentials are set. |

Run a workflow manually:

```bash
pnpm dlx eas-cli@latest workflow:run development-build.yml
```

To auto-build on merge, change `deploy-production.yml`'s trigger to `push: { branches: ['main'] }`. The
CI workflow runs as a custom job (it does not consume EAS Build minutes); the build/submit jobs do.

## The type-safe contract pipeline (regenerating client types)

Zod route schemas in `apps/api` are the single source of truth. The flow:

```
packages/db (Prisma model)
  -> apps/api (@hono/zod-openapi routes)
  -> GET /openapi.json  (OpenAPI 3.1, generated)
  -> apps/api/openapi.json  (committed snapshot via `gen:openapi`)
  -> packages/api-client/src/schema.d.ts  (openapi-typescript)
  -> openapi-fetch client (@getvinyls/api-client)
  -> apps/mobile react-query hooks
```

Regenerate after changing any API schema:

```bash
pnpm gen:api-types
# equivalent to: regenerate apps/api/openapi.json from the Zod routes,
# then run openapi-typescript to write packages/api-client/src/schema.d.ts
```

Changing a Zod schema on the server surfaces as a type error in the mobile app after regen. That is the
point: there are no hand-written fetch calls and no `any` in the client.

## Crawling (scraper)

The Discogs spider writes vinyl listings straight into Postgres (no API hop), upserting on
`(source, external_id)` so re-running never duplicates.

```bash
pnpm scrape
# or: cd apps/scraper && uv run scrapy crawl discogs
```

- With `DISCOGS_TOKEN` set, it queries the official Discogs JSON API (politeness via Scrapy settings:
  robots.txt, AutoThrottle, retry/backoff, a real User-Agent).
- With only `DISCOGS_FIXTURE` set (no token), it reads a local JSON fixture via a `file://` request. This
  is for offline/dev runs and still flows through the same upsert pipeline, so idempotency is identical.

Scraped rows appear in `GET /records` and the mobile list. Run it twice to confirm no duplicates.

## What is verified vs. what needs a device

This foundation was built and checked against a local Postgres:

- `pnpm install && pnpm typecheck` and `pnpm lint` pass across every package (incl. scraper ruff/pyright).
- Prisma migrate + seed; the API serves seeded records; `/openapi.json` is valid OpenAPI 3.1.
- `gen:api-types` regenerates the client; mobile compiles against it with no `any`.
- `uv run scrapy crawl discogs` writes a batch to Postgres idempotently; rows show up in `GET /records`.

The mobile runtime (rendering, audio playback, lock-screen controls, the visualizer) requires an actual
dev build on a simulator or device and is not exercised by `pnpm typecheck` alone.

## Out of scope (not built yet)

End-user auth, search, collections, recommendations, additional reseller spiders, scraper
scheduling/deployment, CI.
