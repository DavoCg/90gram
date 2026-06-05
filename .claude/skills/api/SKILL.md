---
name: api
description: >-
  Conventions for apps/api: a read-only public API built with Hono and @hono/zod-openapi.
  Read this when adding or changing endpoints, request/response Zod schemas, the generated
  OpenAPI document at /openapi.json, the docs UI, or how the API reads through @getvinyls/db.
  Zod schemas are the source of truth; the OpenAPI spec is generated, never authored by hand.
---

# API (apps/api)

Hono + `@hono/zod-openapi` (requires Zod v4). Read-only public API over the shared Postgres via
`@getvinyls/db`. The scraper writes to Postgres directly, so there is NO write or ingestion endpoint here.

## Rules

- Define every route with `createRoute` and `OpenAPIHono`. Request params/query and responses are Zod
  schemas; validation and typing both come from them. Never hand-author OpenAPI JSON.
- Register schemas/routes on an `OpenAPIHono` instance; expose the generated document at `GET /openapi.json`
  as OpenAPI **3.1**, and a docs UI (Scalar) at `GET /docs`.
- Endpoints for the slice: `GET /vinyls` (list, returns vinyl summaries with tracks/genres and a
  cheapest-price summary), `GET /vinyls/{id}` (detail, adds the shop offers), plus `GET /shops` and
  `GET /genres`. The list returns the lighter `VinylSummary`; detail extends it with `offers`. Add new read
  endpoints the same way; keep the API read-only.
- Centralize env in `src/env.ts` (Zod-validated, fail fast). Read `DATABASE_URL` and `API_PORT` there.
- Responses are typed from Zod output schemas. Map Prisma rows to the response schema explicitly (dates to
  ISO strings, Decimal to number/string) so the wire shape is stable and matches what openapi-typescript sees.
- No `any`. Errors return a typed problem shape with the right status code.

## Why this matters

`/openapi.json` is the contract consumed by `pnpm gen:api-types`. If a route's Zod schema changes, the
generated client types change, and mobile must be regenerated. Keep the schemas honest and complete
(every field, correct nullability) because the whole type-safe pipeline derives from them.
