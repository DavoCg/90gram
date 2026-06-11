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
# Header set a real Chrome 124 sends, kept consistent with USER_AGENT above. The bare UA-without-
# headers shape is an easy bot tell for a Cloudflare-fronted origin; sending the matching Accept /
# client-hint headers reduces how often the HTML collection pages get challenged or rate-limited.
# (It does NOT change the TLS fingerprint; that needs an impersonating download handler, see below.)
DEFAULT_REQUEST_HEADERS = {
    "Accept": (
        "text/html,application/xhtml+xml,application/xml;q=0.9,"
        "image/avif,image/webp,image/apng,*/*;q=0.8"
    ),
    "Accept-Language": "en-GB,en;q=0.9",
    "Sec-Ch-Ua": '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
    "Sec-Ch-Ua-Mobile": "?0",
    "Sec-Ch-Ua-Platform": '"macOS"',
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
    "Upgrade-Insecure-Requests": "1",
}
# coldcutshotwax.uk is a single Cloudflare-fronted origin, so per-domain concurrency is the binding
# constraint. Crawl it effectively serially with a 1s floor between requests: the catalog is small
# (JSON metadata is ~20 pages) and the heavy phase B HTML crawl is exactly what trips Cloudflare's
# rate limiter, so trading a little wall-clock for not getting throttled is the right call.
DOWNLOAD_DELAY = 1.0
CONCURRENT_REQUESTS = 8
CONCURRENT_REQUESTS_PER_DOMAIN = 1

AUTOTHROTTLE_ENABLED = True
AUTOTHROTTLE_START_DELAY = 1.0
AUTOTHROTTLE_MAX_DELAY = 60.0
# Aim below one concurrent request on average so AutoThrottle errs toward slower. Note AutoThrottle
# keys off latency, not status codes, so it cannot react to a (fast) 429 on its own; the explicit
# backoff in CloudflareBackoffRetryMiddleware is what actually handles rate limiting.
AUTOTHROTTLE_TARGET_CONCURRENCY = 0.5

# Retry: the built-in middleware is disabled (below) in favour of CloudflareBackoffRetryMiddleware,
# which honours Retry-After and backs off on 429/503. RETRY_HTTP_CODES still drives the inherited
# immediate-retry path for the remaining transient codes; 429/503 are handled by the backoff path.
RETRY_ENABLED = True
RETRY_TIMES = 3
RETRY_HTTP_CODES = [408, 429, 500, 502, 503, 504, 522, 524]
CLOUDFLARE_RETRY_HTTP_CODES = [429, 503]

DOWNLOADER_MIDDLEWARES = {
    "scrapy.downloadermiddlewares.retry.RetryMiddleware": None,
    "getvinyls_scraper.middlewares.CloudflareBackoffRetryMiddleware": 550,
}

# Fallback for TLS-fingerprint challenges (403 / 503 "Just a moment..." pages rather than 429s):
# if backing off is not enough because Cloudflare has classified the crawler as a bot from its TLS
# handshake, install scrapy-impersonate and uncomment the block below to present a real browser's
# TLS/HTTP2 fingerprint. Reach for this only after the backoff above proves insufficient.
# DOWNLOAD_HANDLERS = {
#     "http": "scrapy_impersonate.ImpersonateDownloadHandler",
#     "https": "scrapy_impersonate.ImpersonateDownloadHandler",
# }
# IMPERSONATE_BROWSER = "chrome124"

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
