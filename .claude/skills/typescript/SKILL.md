---
name: typescript
description: >-
  Strict TypeScript conventions enforced across every getvinyls workspace (api, mobile,
  db, api-client, scripts). Read this whenever writing or reviewing TypeScript: it defines
  the compiler strictness, the zero-any / no-unjustified-ts-ignore rules, env validation,
  and import/typing patterns the repo requires.
---

# TypeScript conventions

All TS extends `@getvinyls/tsconfig`. Non-negotiable compiler options: `strict: true`,
`noUncheckedIndexedAccess: true`, `noImplicitOverride`, `noFallthroughCasesInSwitch`,
`forceConsistentCasingInFileNames`, `isolatedModules`.

## Hard rules

- Zero `any`. If a value is truly unknown, type it `unknown` and narrow. ESLint flags `any` as an error.
- No `@ts-ignore`. If a suppression is unavoidable, use `@ts-expect-error` WITH a comment explaining why;
  bare `ts-ignore` is an ESLint error.
- `noUncheckedIndexedAccess` is on: indexing arrays/records yields `T | undefined`. Handle the `undefined`,
  do not assert it away with `!` unless the invariant is provably local and commented.
- Prefer `type` aliases for object shapes and unions; use `interface` only when declaration merging is needed.
- Derive types from a single source of truth. API types come from the generated `@getvinyls/api-client`
  schema; DB types come from the Prisma client. Do not re-declare these shapes by hand.
- Validate all external input at the boundary with Zod (env, request bodies, scraped/fetched JSON), then
  work with the inferred types inward.

## Env loading

Every app validates its environment with Zod at boot and fails fast on missing/invalid vars. No raw
`process.env.X` reads scattered through the code; centralize in an `env.ts` that exports a typed object.

## Style

- No em dashes in comments or strings. Use commas, parentheses, or two sentences.
- Keep modules focused; colocate types with the code that owns them.
