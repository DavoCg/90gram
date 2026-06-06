# syntax=docker/dockerfile:1

# getvinyls API for Fly.io.
#
# Built from the monorepo ROOT (fly.toml sets the build context to "."), because the API
# imports @getvinyls/db by source. At image-build time we bundle the API with tsup (esbuild)
# into a single dist/index.js: @getvinyls/db's TypeScript source and the generated Prisma client
# (which use bundler-style resolution, e.g. extensionless and `.js`-pointing-at-`.ts` specifiers)
# are inlined, so plain `node dist/index.js` runs it at boot with no TS loader needed. The Prisma
# runtime and the pg driver stay external and are resolved from node_modules.
# pnpm's hoisted symlink resolves @getvinyls/db to its real path under packages/db.
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

# Copy the rest of the repo, then build. `db generate` emits the Prisma client into
# packages/db/src/generated, and `api build` (tsup) bundles it together with the API source into
# apps/api/dist/index.js. Both run at build time so the runtime image needs no codegen or TS
# loader. Dev deps (prisma CLI, tsup) are present because the install step above keeps them.
COPY . .

# prisma.config.ts resolves env('DATABASE_URL') at load time and throws if it is unset, but
# `generate` never connects to the database (it only reads the schema). There is no DATABASE_URL
# during the build (the real one comes from Fly secrets at runtime for `migrate deploy`), so pass
# a placeholder to satisfy the config loader for codegen only.
RUN DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder" \
  pnpm --filter @getvinyls/db generate \
  && pnpm --filter @getvinyls/api build

ENV NODE_ENV=production
ENV API_PORT=8787
EXPOSE 8787

# start = `prisma migrate deploy && node dist/index.js` (see apps/api/package.json). Migrations
# run on boot against the real DATABASE_URL from Fly secrets; they are idempotent.
CMD ["pnpm", "--filter", "@getvinyls/api", "start"]
