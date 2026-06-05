"""Juno (juno.co.uk) spider.

Juno is a UK vinyl / DJ store. Unlike Discogs it offers no public JSON API, so the
network path parses the HTML listing pages. Adding this reseller is adding this one
spider, nothing else; it flows through the same RecordItem pipeline as Discogs.

Two run modes share the same item pipeline, so idempotency is identical either way:
- Network mode (default): crawl Juno vinyl listing pages and parse the product cards.
  Set JUNO_START_URL to point at a different category/listing; JUNO_MAX_PAGES caps how
  many paginated pages we follow (politeness: keep this small unless you mean it).
  Politeness is enforced by settings.py (ROBOTSTXT_OBEY, AutoThrottle, retry on 429/5xx,
  identifying User-Agent). Always review Juno's robots.txt and terms before crawling.
- Fixture mode: set JUNO_FIXTURE to a local JSON file (and Scrapy reads it via a file://
  request) for offline/dev runs where outbound access to juno.co.uk is unavailable. Same
  pipeline, same upsert key, so re-running never duplicates rows.

The product URL is the stable identity: Juno products live at
``/products/<slug>/<id>-<variant>/`` and we use that ``<id>-<variant>`` as external_id.
The text-field selectors target Juno's listing cards; because the network path cannot be
exercised in offline CI, treat the fixture path as the verified one and validate the
selectors against the live DOM if Juno changes its markup (zero parsed products is logged).
"""

from __future__ import annotations

import json
import os
import re
from collections.abc import AsyncIterator, Iterator
from pathlib import Path
from typing import Any, cast

import scrapy
from scrapy.http import Request, Response, TextResponse

from ..items import RecordItem

DEFAULT_START_URL = "https://www.juno.co.uk/all/back-cat/"

# Juno products live at /products/<slug>/<id>-<variant>/ ; the <id>-<variant> pair is the
# stable identity we upsert on. Matching the href is far more robust than any CSS class.
_PRODUCT_ID_RE = re.compile(r"/products/[^/]+/(\d+-\d+)/?")
_PRICE_RE = re.compile(r"(\d+(?:[.,]\d{1,2})?)")
_YEAR_RE = re.compile(r"(19|20)\d{2}")


def _first(selector: Any, *css_queries: str) -> str | None:
    """First non-empty text match across a list of candidate CSS queries.

    Lets the parser tolerate small markup differences (and Juno A/B variants) by trying
    a few selectors in order instead of pinning to one brittle class name.
    """
    for query in css_queries:
        value = cast("str | None", selector.css(query).get())
        if value is not None:
            stripped = value.strip()
            if stripped:
                return stripped
    return None


def _parse_price(raw: str | None) -> float | None:
    if not raw:
        return None
    match = _PRICE_RE.search(raw)
    if match is None:
        return None
    try:
        return float(match.group(1).replace(",", "."))
    except ValueError:
        return None


def _parse_year(raw: str | None) -> int | None:
    if not raw:
        return None
    match = _YEAR_RE.search(raw)
    return int(match.group(0)) if match is not None else None


def _normalize_availability(raw: str | None) -> str | None:
    if not raw:
        return None
    text = raw.strip().lower()
    if "pre" in text and "order" in text:
        return "preorder"
    if "out of stock" in text or "sold out" in text:
        return "out_of_stock"
    if "stock" in text or "available" in text:
        return "in_stock"
    return None


class JunoSpider(scrapy.Spider):
    name = "juno"
    allowed_domains = ["juno.co.uk"]

    # Selector candidates for a single product card and its fields. Kept as class
    # attributes so they are easy to adjust in one place if Juno reworks its markup.
    _CARD_QUERIES = ("div.product-list-item", "div.dv-item", "div.productlist_widget_product")
    _ARTIST_QUERIES = (".product-artist a::text", ".dv-artist a::text", ".dv-artist::text")
    _TITLE_QUERIES = (
        "a.product-title::text",
        ".product-title a::text",
        ".dv-title a::text",
    )
    _LABEL_QUERIES = (".product-label a::text", ".dv-label a::text", ".dv-label::text")
    _PRICE_QUERIES = (".product-price::text", ".dv-price::text", "span.price::text")
    _DATE_QUERIES = (".product-date::text", ".dv-date::text")
    _AVAIL_QUERIES = (".product-availability::text", ".dv-stock::text")
    _COVER_QUERIES = ("img::attr(data-src)", "img::attr(src)")
    _PREVIEW_QUERIES = ("a[href$='.mp3']::attr(href)", "[data-mp3]::attr(data-mp3)")

    async def start(self) -> AsyncIterator[Request]:
        fixture = os.environ.get("JUNO_FIXTURE", "").strip()
        if fixture:
            path = Path(fixture)
            if not path.is_absolute():
                # Resolve relative to the project root (apps/scraper), two levels up.
                path = Path(__file__).resolve().parents[2] / fixture
            self.logger.info("Running in fixture mode from %s", path)
            yield Request(path.as_uri(), callback=self.parse_fixture, dont_filter=True)
            return

        start_url = os.environ.get("JUNO_START_URL", "").strip() or DEFAULT_START_URL
        yield Request(start_url, callback=self.parse, meta={"page": 1})

    def parse_fixture(self, response: Response, **kwargs: Any) -> Iterator[RecordItem]:
        entries: Any = json.loads(response.body.decode("utf-8"))
        if not isinstance(entries, list):
            return
        for entry in cast("list[Any]", entries):
            yield RecordItem.model_validate(entry)

    def parse(self, response: Response, **kwargs: Any) -> Iterator[Request | RecordItem]:
        if not isinstance(response, TextResponse):
            return

        cards: Any = []
        for query in self._CARD_QUERIES:
            cards = response.css(query)
            if cards:
                break

        count = 0
        for card in cards:
            item = self._card_to_item(card, response)
            if item is not None:
                count += 1
                yield item

        if count == 0:
            self.logger.warning(
                "Parsed 0 products from %s; Juno markup may have changed, check selectors.",
                response.url,
            )

        # Follow pagination up to JUNO_MAX_PAGES (politeness: default to a single page).
        page = int(response.meta.get("page", 1))
        max_pages = self._max_pages()
        if page < max_pages:
            next_href = _first(
                response,
                "a[rel='next']::attr(href)",
                "a.pagination-next::attr(href)",
                "link[rel='next']::attr(href)",
            )
            if next_href:
                yield Request(
                    response.urljoin(next_href),
                    callback=self.parse,
                    meta={"page": page + 1},
                )

    def _card_to_item(self, card: Any, response: TextResponse) -> RecordItem | None:
        # The product link is the anchor for identity; without it we skip the card.
        hrefs: list[str] = cast("list[str]", card.css("a::attr(href)").getall())
        external_id: str | None = None
        product_href: str | None = None
        for href in hrefs:
            match = _PRODUCT_ID_RE.search(href)
            if match is not None:
                external_id = match.group(1)
                product_href = href
                break
        if external_id is None or product_href is None:
            return None

        title = _first(card, *self._TITLE_QUERIES)
        if not title:
            return None

        cover = _first(card, *self._COVER_QUERIES)
        preview = _first(card, *self._PREVIEW_QUERIES)

        return RecordItem(
            source="juno",
            external_id=external_id,
            title=title,
            artist=_first(card, *self._ARTIST_QUERIES) or "Unknown",
            year=_parse_year(_first(card, *self._DATE_QUERIES)),
            cover_art_url=response.urljoin(cover) if cover else None,
            preview_url=response.urljoin(preview) if preview else None,
            source_url=response.urljoin(product_href),
            price=_parse_price(_first(card, *self._PRICE_QUERIES)),
            currency="GBP",
            availability=_normalize_availability(_first(card, *self._AVAIL_QUERIES)),
        )

    def _max_pages(self) -> int:
        try:
            return max(1, int(os.environ.get("JUNO_MAX_PAGES", "1")))
        except ValueError:
            return 1
