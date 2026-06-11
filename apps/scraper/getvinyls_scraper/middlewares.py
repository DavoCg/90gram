"""Spider/downloader middlewares.

Most politeness (robots.txt, AutoThrottle, User-Agent) is handled by Scrapy's built-in
middlewares via settings.py. The one thing the built-ins get wrong for a Cloudflare-fronted
origin is throttling: ``CloudflareBackoffRetryMiddleware`` below replaces the stock retry for
429/503 so a rate-limited crawl backs off instead of hammering the origin harder.
"""

from __future__ import annotations

from datetime import UTC, datetime
from email.utils import parsedate_to_datetime
from typing import Any, cast

from scrapy.downloadermiddlewares.retry import RetryMiddleware, get_retry_request
from scrapy.http import Request, Response
from scrapy.utils.httpobj import urlparse_cached
from scrapy.utils.response import response_status_message
from twisted.internet import defer, reactor


class CloudflareBackoffRetryMiddleware(RetryMiddleware):
    """Retry 429/503 politely: wait for ``Retry-After`` (then back off) before retrying.

    Scrapy's built-in :class:`RetryMiddleware` retries 429/5xx *immediately* and ignores the
    ``Retry-After`` header Cloudflare sends, so a rate-limited crawl keeps re-firing rejected
    requests and digs the hole deeper. AutoThrottle does not save us either: it keys its delay
    off response *latency*, and a 429 is a tiny, fast response, so it reads the rejection as
    "server is quick" and speeds back up.

    This middleware takes over the throttling codes (default 429 and 503). On one of those it:

    1. waits for the interval the server asked for via ``Retry-After`` (integer seconds or an
       HTTP-date), falling back to exponential backoff when the header is absent, then retries;
    2. raises the per-domain download slot delay so the requests already in flight (which all
       tend to get throttled together) slow down too, not just the one that was rejected.

    Every other retryable code (transient 5xx, connection errors) keeps the stock immediate-retry
    behaviour inherited from the base class.
    """

    def __init__(self, settings: Any) -> None:
        super().__init__(settings)
        self.throttle_codes = {
            int(code) for code in settings.getlist("CLOUDFLARE_RETRY_HTTP_CODES", [429, 503])
        }
        # Exponential backoff floor used when the server sends no Retry-After header.
        self.backoff_base = settings.getfloat("CLOUDFLARE_RETRY_BACKOFF_BASE", 5.0)
        # Hard cap so a hostile or bogus Retry-After cannot park the crawl for minutes.
        self.max_backoff = settings.getfloat("CLOUDFLARE_RETRY_MAX_BACKOFF", 120.0)

    @classmethod
    def from_crawler(cls, crawler: Any) -> CloudflareBackoffRetryMiddleware:
        middleware = cls(crawler.settings)
        middleware.crawler = crawler
        return middleware

    # Scrapy's downloader middleware chain awaits a Deferred returned here, which is how the
    # delayed retry is scheduled; the base signature is typed Request | Response only, so the
    # widened return is correct at runtime but not expressible against the base type. The spider
    # argument is deprecated (Scrapy reads it from self.crawler now), so it defaults to None and
    # is unused, matching the base class.
    def process_response(  # pyright: ignore[reportIncompatibleMethodOverride]
        self, request: Request, response: Response, spider: Any = None
    ) -> Request | Response | defer.Deferred[Request | Response]:
        if request.meta.get("dont_retry", False):
            return response
        if response.status in self.throttle_codes:
            retries = request.meta.get("retry_times", 0)
            delay = self._backoff_delay(response, retries)
            assert self.crawler.spider is not None
            new_request = get_retry_request(
                request,
                spider=self.crawler.spider,
                reason=response_status_message(response.status),
                max_retry_times=request.meta.get("max_retry_times", self.max_retry_times),
                priority_adjust=request.meta.get("priority_adjust", self.priority_adjust),
            )
            if new_request is None:
                # Retries exhausted: hand the 429/503 back so the caller sees the failure.
                return response
            self._slow_down_slot(request, delay)
            return self._retry_after(new_request, delay)
        # Non-throttling retry codes (transient 5xx, etc.) keep the stock immediate retry.
        return super().process_response(request, response)

    def _backoff_delay(self, response: Response, retries: int) -> float:
        """Seconds to wait before retrying: honour Retry-After, else exponential backoff."""
        header = response.headers.get("Retry-After")
        if header:
            seconds = self._parse_retry_after(header.decode("latin-1").strip())
            if seconds is not None:
                return min(seconds, self.max_backoff)
        return min(self.backoff_base * (2.0**retries), self.max_backoff)

    @staticmethod
    def _parse_retry_after(value: str) -> float | None:
        """Retry-After is either delta-seconds (an integer) or an HTTP-date."""
        if value.isdigit():
            return float(value)
        try:
            when = parsedate_to_datetime(value)
        except (TypeError, ValueError):
            return None
        if when.tzinfo is None:
            when = when.replace(tzinfo=UTC)
        seconds = (when - datetime.now(UTC)).total_seconds()
        return seconds if seconds > 0 else None

    def _retry_after(self, request: Request, delay: float) -> defer.Deferred[Request | Response]:
        """Reschedule ``request`` after ``delay`` seconds via a deferred the downloader awaits."""
        deferred: defer.Deferred[Request | Response] = defer.Deferred()
        cast(Any, reactor).callLater(delay, deferred.callback, request)
        return deferred

    def _slow_down_slot(self, request: Request, delay: float) -> None:
        """Bump the domain's download slot delay so in-flight requests brake too (best effort)."""
        engine = getattr(self.crawler, "engine", None)
        downloader = getattr(engine, "downloader", None)
        if downloader is None:
            return
        slot_key = request.meta.get("download_slot") or urlparse_cached(request).hostname
        slot = downloader.slots.get(slot_key)
        if slot is not None:
            slot.delay = max(slot.delay, min(delay, self.max_backoff))
