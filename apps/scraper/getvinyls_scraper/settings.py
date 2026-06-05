"""Scrapy settings for getvinyls_scraper.

Politeness is configured here (settings, not custom code): obey robots.txt, AutoThrottle,
a sane delay and per-domain concurrency cap, the built-in retry middleware for 429/5xx,
and a standard browser User-Agent. Where a source offers an official API we request its JSON.
"""

from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv


def _load_root_env() -> None:
    """Load the monorepo root .env (shared DATABASE_URL) by walking up from here."""
    for parent in Path(__file__).resolve().parents:
        candidate = parent / ".env"
        if candidate.exists():
            load_dotenv(candidate)
            return


_load_root_env()

BOT_NAME = "getvinyls_scraper"

SPIDER_MODULES = ["getvinyls_scraper.spiders"]
NEWSPIDER_MODULE = "getvinyls_scraper.spiders"

# Politeness ----------------------------------------------------------------
ROBOTSTXT_OBEY = True
USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)
# 300ms wait between requests to a domain (the floor); AutoThrottle keeps this as the minimum but
# still backs off when the server is slow or returns 429/5xx.
DOWNLOAD_DELAY = 0.3
CONCURRENT_REQUESTS = 8
CONCURRENT_REQUESTS_PER_DOMAIN = 2

AUTOTHROTTLE_ENABLED = True
AUTOTHROTTLE_START_DELAY = 0.3
AUTOTHROTTLE_MAX_DELAY = 30.0
AUTOTHROTTLE_TARGET_CONCURRENCY = 1.0

RETRY_ENABLED = True
RETRY_TIMES = 3
RETRY_HTTP_CODES = [408, 429, 500, 502, 503, 504, 522, 524]

# Pipelines -----------------------------------------------------------------
ITEM_PIPELINES = {"getvinyls_scraper.pipelines.PostgresPipeline": 300}

# Database (shared with Prisma; the scraper writes rows ONLY) ----------------
DATABASE_URL = os.environ.get("DATABASE_URL", "")

# Scrapy runtime defaults ---------------------------------------------------
REQUEST_FINGERPRINTER_IMPLEMENTATION = "2.7"
TWISTED_REACTOR = "twisted.internet.asyncioreactor.AsyncioSelectorReactor"
FEED_EXPORT_ENCODING = "utf-8"
LOG_LEVEL = "INFO"
# Log throughput (pages/items per minute) every 30s instead of the default 60s.
LOGSTATS_INTERVAL = 30.0
