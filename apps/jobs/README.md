# @getvinyls/jobs

Background jobs that need direct database access. A small CLI: each job is addressable by name and
runs once, then the process exits. Consumes `@getvinyls/db` (the shared Prisma client over the single
`DATABASE_URL`), exactly like `apps/api`. It only writes rows; Prisma remains the sole owner of the
schema and migrations, so jobs never run DDL.

## Jobs

| Name              | What it does                                                                       |
| ----------------- | ---------------------------------------------------------------------------------- |
| `track-durations` | Fills `tracks.duration_seconds` by fetching each track's `preview_url` and reading the duration from the audio metadata. Idempotent and resumable: only touches tracks that have a preview and no duration yet. |

## Run locally

From the repo root (with `.env` populated, same `DATABASE_URL` as the rest of the stack):

```sh
pnpm --filter @getvinyls/jobs dev track-durations     # tsx, no build
pnpm --filter @getvinyls/jobs build                   # bundle to dist/
pnpm --filter @getvinyls/jobs start track-durations   # run the build
```

## Configuration

All validated with Zod at boot (`src/env.ts`); the run fails fast on missing/invalid vars.

| Var                      | Default       | Purpose                                                        |
| ------------------------ | ------------- | -------------------------------------------------------------- |
| `DATABASE_URL`           | (required)    | Shared Postgres URL.                                           |
| `JOB_CONCURRENCY`        | `8`           | Preview downloads in flight at once (be polite to hosts).      |
| `JOB_BATCH_SIZE`         | `100`         | Candidate tracks pulled per page (keyset paginated by `id`).   |
| `JOB_REQUEST_TIMEOUT_MS` | `15000`       | Per-download abort timeout.                                    |
| `JOB_MAX_TRACKS`         | (unset)       | Optional cap on tracks processed per run (handy for a smoke run). |

## Deploy (Fly.io)

A separate Fly app, `getvinyls-jobs`, built from the repo root so the Dockerfile sees the whole
workspace. See `fly.toml` for the exact commands: set the `DATABASE_URL` secret, run a job on demand
with `fly machine run`, or attach a Fly scheduled machine (`--schedule daily`) for new tracks.
