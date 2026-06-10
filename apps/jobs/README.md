# @getvinyls/jobs

Background jobs that need direct database access. Runs as an always-on worker: a scheduler daemon
stays up and fires each job on its own in-process cron. Consumes `@getvinyls/db` (the shared Prisma
client over the single `DATABASE_URL`), exactly like `apps/api`. It only writes rows; Prisma remains
the sole owner of the schema and migrations, so jobs never run DDL.

## Jobs

| Name              | Default schedule   | What it does                                                  |
| ----------------- | ------------------ | ------------------------------------------------------------ |
| `track-durations` | `0 3 * * *` (daily) | Fills `tracks.duration_seconds` by fetching each track's `preview_url` and reading the duration from the audio metadata. Idempotent and resumable: only touches tracks that have a preview and no duration yet. |

## Modes

The same binary runs the daemon or a single job:

```sh
pnpm --filter @getvinyls/jobs dev                   # scheduler daemon (tsx, no build)
pnpm --filter @getvinyls/jobs dev run track-durations  # run one job once and exit
pnpm --filter @getvinyls/jobs dev list              # list jobs and their schedules

pnpm --filter @getvinyls/jobs build                 # bundle to dist/
pnpm --filter @getvinyls/jobs start                 # scheduler daemon (the build)
pnpm --filter @getvinyls/jobs start run track-durations  # one-off (the build)
```

The daemon serves `GET /health` on `JOBS_PORT` with each job's schedule, next fire time, and last
run result, used as the platform liveness check.

## Configuration

All validated with Zod at boot (`src/env.ts`); the process fails fast on missing/invalid vars.

| Var                      | Default       | Purpose                                                        |
| ------------------------ | ------------- | -------------------------------------------------------------- |
| `DATABASE_URL`           | (required)    | Shared Postgres URL.                                           |
| `JOBS_PORT`              | `8080`        | Port for the daemon's `/health` endpoint.                      |
| `JOB_TIMEZONE`           | `UTC`         | IANA timezone the cron schedules are evaluated in.             |
| `TRACK_DURATIONS_CRON`   | `0 3 * * *`   | Cron expression for the track-durations job.                   |
| `JOB_CONCURRENCY`        | `8`           | Preview downloads in flight at once (be polite to hosts).      |
| `JOB_BATCH_SIZE`         | `100`         | Candidate tracks pulled per page (keyset paginated by `id`).   |
| `JOB_REQUEST_TIMEOUT_MS` | `15000`       | Per-download abort timeout.                                    |
| `JOB_MAX_TRACKS`         | (unset)       | Optional cap on tracks processed per run (handy for a smoke run). |

A job that is still running when its next tick arrives is skipped for that tick (no overlap).

## Deploy (Fly.io)

A separate, always-on Fly app, `getvinyls-jobs`, built from the repo root so the Dockerfile sees the
whole workspace. One machine stays up running the daemon; `fly.toml` keeps `min_machines_running = 1`
with auto-stop off and an internal `/health` check. See `fly.toml` for the exact commands: set the
`DATABASE_URL` secret, tune `TRACK_DURATIONS_CRON` / `JOB_TIMEZONE`, and (optionally) launch a manual
one-off run with `fly machine run`.
