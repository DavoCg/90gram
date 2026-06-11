# syntax=docker/dockerfile:1
#
# Scrapyd server for the getvinyls scrapers (the getvinyls-scraper Fly app). Scrapyd is a long-running
# daemon that runs the Scrapy spiders; apps/jobs drives the timing by POSTing to its schedule.json.
#
# Built from the repo ROOT (apps/scraper/fly.toml is deployed from root, mirroring apps/jobs) but only
# uses apps/scraper: the Scrapy project writes to Postgres directly and has no workspace deps. The
# project is baked into the image as a Scrapy egg and pre-loaded into Scrapyd's eggs dir, so deploying
# is just shipping the image (no runtime egg upload, no public addversion endpoint). Scrapyd binds
# 0.0.0.0:6800 and is reached privately by apps/jobs at getvinyls-scraper.internal:6800.
FROM python:3.12-slim AS base

# uv for fast, reproducible installs straight from the project's uv.lock.
COPY --from=ghcr.io/astral-sh/uv:0.8.17 /uv /uvx /bin/

# Keep the venv on PATH so `scrapyd` and the spider subprocesses it spawns resolve from the same
# environment (the subprocesses inherit scrapy + the DB driver from this venv).
ENV UV_PROJECT_ENVIRONMENT=/app/.venv
ENV PATH="/app/.venv/bin:$PATH"
ENV UV_COMPILE_BYTECODE=1
ENV UV_LINK_MODE=copy

WORKDIR /app

# Install deps first so this layer caches across source-only changes (lock + manifest only).
COPY apps/scraper/pyproject.toml apps/scraper/uv.lock ./
RUN --mount=type=cache,target=/root/.cache/uv \
  uv sync --frozen --no-install-project --no-dev

# Copy the project source, finish the install, then build the egg and register it under Scrapyd's
# eggs dir as a single version. find_packages picks up getvinyls_scraper; the egg holds only code.
COPY apps/scraper/ ./
RUN --mount=type=cache,target=/root/.cache/uv \
  uv sync --frozen --no-dev \
  && python setup.py bdist_egg \
  && mkdir -p /app/eggs/getvinyls_scraper \
  && cp dist/getvinyls_scraper-*.egg /app/eggs/getvinyls_scraper/1_0.egg \
  && rm -rf build dist getvinyls_scraper.egg-info

EXPOSE 6800

# Start the Scrapyd daemon. It reads ./scrapyd.conf (bind 0.0.0.0:6800) and serves the JSON API that
# apps/jobs calls. DATABASE_URL comes from Fly secrets and is inherited by each spider subprocess.
CMD ["scrapyd"]
