# syntax=docker/dockerfile:1

# getvinyls jobs service for Fly.io.
#
# Built from the monorepo ROOT (apps/jobs/fly.toml sets the build context to ".") because the jobs
# service imports @getvinyls/db by source. At image-build time we bundle the entry with tsup
# (esbuild) into a single dist/index.js: @getvinyls/db's TypeScript source and the generated Prisma
# client are inlined, so plain `node dist/index.js <job>` runs at boot with no TS loader. The Prisma
# runtime and the pg driver stay external and are resolved from node_modules. Mirrors apps/api.
#
# Unlike the API this is a worker, not a server: a machine runs one job and exits. It does NOT run
# `prisma migrate deploy` (the API owns applying migrations); the jobs service only writes rows.
FROM node:22.20.0-slim AS build

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

# OpenSSL + CA certs: the Prisma CLI uses them during generate; CA certs also let the runtime fetch
# HTTPS preview audio.
RUN apt-get update -y \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy every workspace manifest first so the pnpm workspace graph is complete and this layer caches
# across source-only changes. The --filter below limits what actually installs to the jobs service
# and its workspace deps (@getvinyls/db).
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml .npmrc ./
COPY packages/db/package.json packages/db/
COPY packages/api-client/package.json packages/api-client/
COPY packages/tsconfig/package.json packages/tsconfig/
COPY apps/api/package.json apps/api/
COPY apps/jobs/package.json apps/jobs/
COPY apps/mobile/package.json apps/mobile/
COPY apps/scraper/package.json apps/scraper/

RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
  pnpm install --frozen-lockfile --filter @getvinyls/jobs...

# Copy the rest of the repo, then build. `db generate` emits the Prisma client into
# packages/db/src/generated, and `jobs build` (tsup) bundles it together with the jobs source into
# apps/jobs/dist/index.js. Both run at build time so the runtime image needs no codegen or TS loader.
COPY . .

# generate never connects to the database (it only reads the schema), but prisma.config.ts throws if
# DATABASE_URL is unset, so pass a placeholder for codegen only. The real one comes from Fly secrets.
RUN DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder" \
  pnpm --filter @getvinyls/db generate \
  && pnpm --filter @getvinyls/jobs build

ENV NODE_ENV=production

# Default job for a plain `fly deploy` machine / scheduled machine. Override the job name by passing
# a different command to `fly machine run`, e.g. `... @getvinyls/jobs start <other-job>`.
CMD ["pnpm", "--filter", "@getvinyls/jobs", "start", "track-durations"]
