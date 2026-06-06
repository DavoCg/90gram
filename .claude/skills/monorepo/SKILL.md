---
name: monorepo
description: >-
  Conventions for the getvinyls monorepo: pnpm workspaces, Turborepo task graph,
  Node/pnpm versions, internal workspace deps, and the end-to-end type-safe contract
  pipeline (db -> api -> openapi.json -> api-client -> mobile). Read this when adding a
  package, wiring a Turbo task, changing build/dev/typecheck/lint scripts, or touching how
  generated API types flow from the server to the app.
---

# Monorepo

Stack: pnpm workspaces + Turborepo. Node 22 LTS, pnpm 10 (the env runs 10; treat the toolchain
as "pnpm current"). Every package owns its own `dev`, `build`, `lint`, `typecheck` scripts; Turbo
orchestrates them from the root.

## Layout

```
apps/      mobile (Expo), api (Hono), scraper (Python, not a pnpm member)
packages/  db (Prisma), api-client (generated), tsconfig (shared base)
```

- Internal deps use `workspace:*`. Mobile consumes `@getvinyls/api-client`; api consumes `@getvinyls/db`.
- `apps/scraper` is Python and is NOT a pnpm workspace member. Turbo still drives it through a thin
  `apps/scraper/package.json` whose `lint`/`typecheck`/`scrape` scripts shell out to `uv`/`ruff`/`pyright`.
- Shared tsconfig lives in `packages/tsconfig` (`base.json`, `node.json`, `expo.json`). Extend, do not copy.

## Turbo tasks

`dev` (persistent, uncached), `build` (depends on `^build` + `gen:api-types`), `typecheck`
(depends on `^build`, `db:generate`, `gen:api-types`), `lint`, `gen:api-types`, `db:generate`, `scrape`.
Declare `globalEnv` for any env var a task reads so caching stays correct.

## The type-safe contract pipeline (the spine, must always work)

1. API routes are `@hono/zod-openapi` `createRoute` definitions with Zod request/response schemas.
2. API serves OpenAPI 3.1 JSON at `/openapi.json`.
3. `gen:api-types` runs `openapi-typescript` against the spec and writes `packages/api-client/src/schema.d.ts`.
4. `packages/api-client` exports an `openapi-fetch` client typed against that schema and nothing else
   (no React, no react-query).
5. `apps/mobile` imports the client and defines its react-query hooks (`useVinyls`, `useVinyl`) against it.

Changing a Zod schema on the server must surface as a type error in mobile after `pnpm gen:api-types`.
Regen flow is documented in the root `README.md`. When the API exposes a new shape, regenerate before
relying on it in mobile.

## Rules

- No package reaches into another package's `src` directly; consume the published entrypoint.
- Keep `globalEnv`/`globalDependencies` in `turbo.json` in sync with what tasks actually read.
- One Postgres `DATABASE_URL` is shared by Prisma and the scraper; only Prisma migrates it.
