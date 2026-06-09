# getvinyls

Vinyl record discovery app. Monorepo: Expo mobile app + Hono API + Python scraper, sharing one Postgres.
Audio playback and runtime performance are first-class concerns.

## Repo skills are authoritative

Detailed, per-area conventions live in `.claude/skills/<name>/SKILL.md`. They are NOT optional background.
Before working in an area, read its skill first and follow it. A repo skill outranks generic habits.
If a skill conflicts with another skill or with a task instruction, stop and surface it rather than guessing.

| Area        | Skill                          | Covers                                                        |
| ----------- | ------------------------------ | ------------------------------------------------------------- |
| monorepo    | `.claude/skills/monorepo`      | pnpm workspaces, Turborepo tasks, the type-safe spec pipeline |
| db          | `.claude/skills/db`            | Prisma schema ownership, snake_case mapping, migrations       |
| api         | `.claude/skills/api`           | Hono + zod-openapi, generated OpenAPI, read-only routes       |
| api-client  | `.claude/skills/api-client`    | openapi-typescript + openapi-fetch, no React deps             |
| mobile      | `.claude/skills/mobile`        | Expo Router, Uniwind, react-query hooks, LegendList          |
| audio       | `.claude/skills/audio`         | react-native-audio-api graph, player store, lock screen       |
| scraper     | `.claude/skills/scraper`       | Scrapy, politeness, PostgresPipeline, reflected schema        |
| typescript  | `.claude/skills/typescript`    | strict TS rules everywhere                                    |

## Always-on basics

- Package manager: **pnpm** (workspaces). Node 22 LTS. Run everything from the repo root via Turbo.
- `pnpm install` once. Then: `pnpm dev` (API + Metro), `pnpm typecheck`, `pnpm lint`, `pnpm build`.
- `pnpm gen:api-types` regenerates the typed API client from the API's OpenAPI spec. Run after changing API schemas.
- `pnpm scrape` runs the scraper one-shot via Turbo (shells out to `uv`).
- Workspaces: `apps/mobile`, `apps/api`, `apps/scraper` (Python), `packages/db`, `packages/api-client`, `packages/tsconfig`.
- Internal deps use the `workspace:*` protocol. Mobile consumes `@getvinyls/api-client`; the API consumes `@getvinyls/db`.

## Hard rules

- **Strict TypeScript everywhere.** `strict: true`, `noUncheckedIndexedAccess: true`. Zero `any`. No `ts-ignore`
  without a comment justifying it (prefer `ts-expect-error` with a description).
- **No hand-written fetch calls** to the API and no `any` in the client. The client is generated from the OpenAPI spec.
- **Zod schemas are the source of truth** for the API; the OpenAPI document is generated, never authored by hand.
- **Prisma is the sole owner** of the database schema and migrations. The scraper only writes rows, never DDL.
- **No em dashes** in generated docs, comments, or copy. Use commas, parentheses, or separate sentences.
- **Pull requests target `develop`**, never `main`. Always open PRs with `develop` as the base branch.
- **Env via a typed loader**: validate with Zod at boot, fail fast on missing vars. Document every var in `.env.example`.

## The type-safe contract pipeline (the spine)

`packages/db` Prisma model -> `apps/api` zod-openapi routes -> `/openapi.json` -> `pnpm gen:api-types`
-> `packages/api-client/src/schema.d.ts` -> typed `openapi-fetch` client -> `apps/mobile` react-query hooks.
Changing a Zod schema on the server must surface as a type error in mobile after regen. See the `monorepo` skill.
