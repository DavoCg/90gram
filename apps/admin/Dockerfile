# syntax=docker/dockerfile:1

# getvinyls admin (apps/admin) for Fly.io. Built from the monorepo ROOT (fly.toml sets the build
# context to "."), because the admin app imports @getvinyls/db by source. At image-build time Vite +
# Nitro bundle the TanStack Start app into .output/, and the Prisma client is generated so the bundle
# can query Postgres at runtime. The admin app runs NO migrations: apps/api owns `migrate deploy`.
FROM node:22.20.0-slim AS build

# pnpm via corepack, pinned to the repo's packageManager field.
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

# OpenSSL + CA certs: the Prisma CLI uses them during generate.
RUN apt-get update -y \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy every workspace manifest first so the pnpm workspace graph is complete and this layer caches
# across source-only changes. The --filter below limits the install to the admin app and its
# workspace deps (@getvinyls/db), skipping the mobile/expo native deps.
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml .npmrc ./
COPY packages/db/package.json packages/db/
COPY packages/api-client/package.json packages/api-client/
COPY packages/tsconfig/package.json packages/tsconfig/
COPY apps/admin/package.json apps/admin/
COPY apps/api/package.json apps/api/
COPY apps/jobs/package.json apps/jobs/
COPY apps/mobile/package.json apps/mobile/
COPY apps/scraper/package.json apps/scraper/

RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
  pnpm install --frozen-lockfile --filter @getvinyls/admin...

# Copy the rest of the repo, then build. `db generate` emits the Prisma client; `admin build` runs
# Vite + Nitro to produce .output/server/index.mjs. prisma.config.ts requires DATABASE_URL at load
# time but `generate` never connects, so a placeholder satisfies it for codegen only (the real URL
# comes from Fly secrets at runtime).
COPY . .

RUN DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder" \
  pnpm --filter @getvinyls/db generate \
  && pnpm --filter @getvinyls/admin build

ENV NODE_ENV=production
ENV ADMIN_PORT=8080
ENV PORT=8080
EXPOSE 8080

# start = `node .output/server/index.mjs` (see apps/admin/package.json). Nitro's node-server listens
# on PORT. No migrations here; apps/api applies them on its own boot.
CMD ["pnpm", "--filter", "@getvinyls/admin", "start"]
