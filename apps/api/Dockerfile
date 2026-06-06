# syntax=docker/dockerfile:1

# getvinyls API for Fly.io.
#
# Built from the monorepo ROOT (fly.toml sets the build context to "."), because the API
# imports @getvinyls/db by source: at runtime `node dist/index.js` loads the db package's
# TypeScript (and the generated Prisma client) directly, relying on Node's native type
# stripping (Node >= 22.18). pnpm's hoisted symlink resolves @getvinyls/db to its real path
# under packages/db (outside node_modules), so stripping applies. Keep the base image on a
# Node release that ships type stripping by default.
FROM node:22.20.0-slim AS build

# pnpm via corepack, pinned to the repo's packageManager field.
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

# OpenSSL + CA certs: the Prisma CLI uses them during generate / migrate deploy.
RUN apt-get update -y \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy every workspace manifest first so the pnpm workspace graph is complete and this
# layer caches across source-only changes. The --filter below limits what actually installs
# to the API and its workspace deps (@getvinyls/db), so the mobile/expo native deps are skipped.
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml .npmrc ./
COPY packages/db/package.json packages/db/
COPY packages/api-client/package.json packages/api-client/
COPY packages/tsconfig/package.json packages/tsconfig/
COPY apps/api/package.json apps/api/
COPY apps/mobile/package.json apps/mobile/
COPY apps/scraper/package.json apps/scraper/

# Install api + db (and their deps). Dev deps are included on purpose: the start script runs
# the Prisma CLI (generate + migrate deploy) at boot. Pruning dev deps would break that.
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
  pnpm install --frozen-lockfile --filter @getvinyls/api...

# Copy the rest of the repo. The API runs from TypeScript source via tsx (see the api `start`
# script), exactly like dev: @getvinyls/db is consumed as source (its package `main` is a .ts
# file that imports the generated Prisma client with a `.js` specifier, which only a TS-aware
# loader like tsx resolves). So there is no tsc build here. The start script runs
# `prisma generate` + `prisma migrate deploy` at boot, with the real DATABASE_URL from Fly secrets.
COPY . .

ENV NODE_ENV=production
ENV API_PORT=8787
EXPOSE 8787

# start = `prisma generate && prisma migrate deploy && node dist/index.js`
# (see apps/api/package.json). Migrations run on boot; they are idempotent.
CMD ["pnpm", "--filter", "@getvinyls/api", "start"]
