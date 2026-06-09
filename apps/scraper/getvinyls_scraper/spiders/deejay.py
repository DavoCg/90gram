"""deejay.de spider (https://www.deejay.de).

deejay.de is a large German DJ record store (new releases). Unlike a Shopify shop it exposes no
public products JSON, and its sitemap is NOT a catalog index (each ``siteMap_<n>.xml`` lists only a
single recently-updated product). The catalog is only reachable through the paginated listing
pages, so the crawl walks those:

- Phase A (discovery): page through the all-music listing (``/m_All`` -> ``/m_All/sm_News/page_N``,
  ~45 products per page). Each page links to product pages via relative ``..._Vinyl__<id>`` hrefs;
  we keep the vinyl ones, dedupe by id, and queue a product request for each. Pagination stops at
  the first page with no product links.
- Phase B (parse + emit): fetch each product page (forced to ``/lang_en`` so labels like
  "In Stock" parse deterministically), map it to a ListingItem and emit immediately. Every product
  page is fully server-rendered and self-contained (artist, title, label, catalog number, format,
  genres, price, stock, tracklist).

The numeric id at the tail of the URL is the offer's stable ``external_id`` (it also keys the
datalayer ``view_item`` blob and the cover image filename).

Rules:
- NEW vinyl only: deejay also sells CDs, equipment and fashion. The listing links carry the format
  in the slug, so non-vinyl links are pre-filtered there (cheaper, politer), and the product-page
  format guard (format text contains "Vinyl") is a backstop. deejay is a new-release store and does
  not list second-hand stock, so there is no used filter to apply, but the standing "new vinyl only"
  rule is honoured by the format guard.
- Track audio lives at ``/streamit/<a>/<b>/<id><letter>.mp3``: ``<a>/<b>`` is the id's last two
  digits (same as the cover image path) and ``<letter>`` is the track's order, read from its
  ``playTrack_<id>_<letter>`` element id. ``/streamit/`` is not disallowed by robots.txt, so we
  build the ``preview_url`` from the page without fetching anything (see ``_stream_base``).

Useful flags: ``-a listing_path=/m_House/sm_News`` crawls a different listing; ``-a max_pages=N``
caps how many listing pages are walked; ``-a max_products=N`` caps how many products are queued.

Two run modes share the same item pipeline, so idempotency is identical either way:
- Live mode (default): the listing walk above.
- Fixture mode: set DEEJAY_FIXTURE to a local JSON file (a list of ``{"url", "html"}`` product-page
  snapshots) read via a file:// request, for offline/dev runs.
"""

from __future__ import annotations

import html as html_mod
import json
import os
import re
from collections.abc import AsyncIterator, Iterator
from pathlib import Path
from typing import Any, cast

import scrapy
from parsel import Selector
from scrapy.http import Request, Response, TextResponse

from ..items import ListingItem, TrackItem

BASE_URL = "https://www.deejay.de"
# Default listing: all music, sorted by news. Pagination is /<path>/page_N.
LISTING_PATH = "/m_All/sm_News"
SHOP_SLUG = "deejay"
SHOP_NAME = "deejay.de"
SHOP_COUNTRY = "DE"
SOURCE = "deejay"
CURRENCY = "EUR"

# A product URL ends in "__<id>"; we read the id from there as the offer external_id.
_PRODUCT_ID = re.compile(r"__(\d+)$")
# Listing pages link products via slugs that carry the format, e.g. "..._Vinyl__1210427". Match the
# vinyl ones (and capture the id) so CDs / equipment are never even fetched.
_LISTING_VINYL = re.compile(r"_Vinyl__(\d+)$")
# Release line reads "Release: 27.02.2026"; we only keep the year.
_YEAR = re.compile(r"(\d{4})")
# The GA datalayer "view_item" blob carries the canonical id, price and currency.
_DATALAYER = re.compile(r"\{&quot;event&quot;:&quot;view_item&quot;.*?\}\]\}\}")


def _to_float(value: Any) -> float | None:
    try:
        return float(str(value))
    except (TypeError, ValueError):
        return None


def _as_dict(value: Any) -> dict[str, Any]:
    return cast("dict[str, Any]", value) if isinstance(value, dict) else {}


def _as_list(value: Any) -> list[Any]:
    return cast("list[Any]", value) if isinstance(value, list) else []


def _clean(text: str | None) -> str:
    """Collapse runs of whitespace and trim; '' for None."""
    return re.sub(r"\s+", " ", text).strip() if text else ""


def _join(sel: Selector, css: str) -> str:
    return _clean(" ".join(sel.css(css).getall()))


def _parse_datalayer(html: str) -> dict[str, Any]:
    """Pull the first ``view_item`` ecommerce item out of the GA datalayer blob (HTML-escaped)."""
    match = _DATALAYER.search(html)
    if not match:
        return {}
    try:
        payload = _as_dict(json.loads(html_mod.unescape(match.group(0))))
    except json.JSONDecodeError:
        return {}
    items = _as_list(_as_dict(payload.get("ecommerce")).get("items"))
    return _as_dict(items[0]) if items else {}


def _is_vinyl(format_text: str) -> bool:
    return "vinyl" in format_text.lower()


def _stream_base(external_id: str, cover: str | None) -> str | None:
    """Base URL for a product's track audio, minus the per-track letter and extension.

    deejay serves each track at ``/streamit/<a>/<b>/<id><letter>.mp3``, where ``<a>/<b>`` is the
    same directory pair as the cover image (``/images/xl/<a>/<b>/<id>.jpg``), i.e. the id's last two
    digits, and ``<letter>`` (a, b, c, ...) is the track's order, carried in its
    ``playTrack_<id>_<letter>`` element id. ``/streamit/`` is not disallowed by robots.txt. Derives
    the pair from the cover when present, else from the id."""
    match = re.search(r"/images/\w+/([^/]+)/([^/]+)/\d+\.", cover or "")
    if match:
        seg1, seg2 = match.group(1), match.group(2)
    elif len(external_id) >= 2:
        seg1, seg2 = external_id[-2], external_id[-1]
    else:
        return None
    return f"{BASE_URL}/streamit/{seg1}/{seg2}/{external_id}"


def _parse_tracks(sel: Selector, stream_base: str | None) -> list[TrackItem]:
    tracks: list[TrackItem] = []
    seen: set[str] = set()
    for el in sel.css("ul.playtrack li a.track"):
        position = _clean(el.css("b::text").get())
        title = _clean(el.css("span.trackname::text").get())
        if not title:
            continue
        if not position:
            position = str(len(tracks) + 1)
        if position in seen:
            continue
        seen.add(position)
        # The track's audio letter (a, b, c, ...) is the suffix of its `playTrack_<id>_<letter>` id;
        # combine it with the stream base to get the mp3 the player streams.
        letter = (el.attrib.get("id") or "").rsplit("_", 1)[-1]
        preview = f"{stream_base}{letter}.mp3" if stream_base and letter.isalpha() else None
        tracks.append(TrackItem(position=position, title=title, preview_url=preview))
    return tracks


def _parse_genres(sel: Selector) -> list[str]:
    names: list[str] = []
    seen: set[str] = set()
    for raw in sel.css("[itemprop='genre'] em::text").getall():
        name = _clean(raw)
        if not name or name.lower() in seen:
            continue
        seen.add(name.lower())
        names.append(name)
    return names


def _parse_price(sel: Selector, datalayer: dict[str, Any]) -> float | None:
    price = _to_float(datalayer.get("price"))
    if price is not None:
        return price
    # Fallback: the visible price reads like "32,52 €" (German decimal comma).
    raw = _clean(sel.css(".price::text").get())
    match = re.search(r"(\d+(?:[.,]\d+)?)", raw)
    return _to_float(match.group(1).replace(",", ".")) if match else None


def _parse_stock(sel: Selector) -> str:
    text = _join(sel, ".stockstatus .first::text").lower()
    if "in stock" in text:
        return "in_stock"
    if "sold" in text or "out of stock" in text:
        return "out_of_stock"
    return "unknown"


def _parse_product(html: str, url: str) -> ListingItem | None:
    sel = Selector(text=html)
    datalayer = _parse_datalayer(html)

    format_text = _join(sel, ".infos .medium::text") or _clean(datalayer.get("item_category"))
    # New vinyl only: drop CDs, equipment, fashion and anything non-vinyl.
    if not _is_vinyl(format_text):
        return None

    id_match = _PRODUCT_ID.search(url)
    external_id = str(datalayer.get("item_id") or (id_match.group(1) if id_match else "")).strip()
    artist = _join(sel, ".artist h1 ::text")
    title = _join(sel, ".title h1::text")
    if not external_id or not artist or not title:
        return None

    catalog_number = _join(sel, ".labelContainer h1[itemprop='alternateName']::text") or None
    label = _join(sel, ".labelContainer h3[itemprop='provider']::text") or None

    year_match = _YEAR.search(_join(sel, ".date::text"))
    year = int(year_match.group(1)) if year_match else None

    cover = sel.css(".cover .img1 a::attr(href)").get() or sel.css(".cover img::attr(src)").get()

    price = _parse_price(sel, datalayer)

    # Drop the trailing /lang_en we crawl with so the stored source_url is the canonical page.
    source_url = re.sub(r"/lang_[a-z]{2}$", "", url)

    return ListingItem(
        shop_slug=SHOP_SLUG,
        shop_name=SHOP_NAME,
        shop_country=SHOP_COUNTRY,
        title=title,
        artist=artist,
        year=year,
        cover_art_url=cover,
        label=label,
        catalog_number=catalog_number,
        format=format_text or None,
        genres=_parse_genres(sel),
        tracks=_parse_tracks(sel, _stream_base(external_id, cover)),
        source=SOURCE,
        external_id=external_id,
        source_url=source_url,
        stock_status=_parse_stock(sel),
        condition=None,
        price=price,
        currency=CURRENCY if price is not None else None,
    )


class DeejaySpider(scrapy.Spider):
    name = "deejay"
    allowed_domains = ["deejay.de"]

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, **kwargs)
        # `-a listing_path=/m_House/sm_News` crawls a different listing (default: all music).
        self._listing_path = str(getattr(self, "listing_path", "") or LISTING_PATH).rstrip("/")
        # `-a max_pages=N` caps how many listing pages are walked; `-a max_products=N` caps queued.
        self._max_pages = self._as_limit("max_pages")
        self._max_products = self._as_limit("max_products")
        self._seen: set[str] = set()  # product ids already queued (dedupe across listing pages)
        self._pages_crawled = 0
        self._queued = 0
        self._items_emitted = 0
        self._tracks_emitted = 0
        self._skipped_non_vinyl = 0

    def _as_limit(self, attr: str) -> int | None:
        value = str(getattr(self, attr, "") or "").strip()
        return int(value) if value.isdigit() else None

    async def start(self) -> AsyncIterator[Request]:
        fixture = os.environ.get("DEEJAY_FIXTURE", "").strip()
        if fixture:
            path = Path(fixture)
            if not path.is_absolute():
                # Resolve relative to the project root (apps/scraper), two levels up.
                path = Path(__file__).resolve().parents[2] / fixture
            self.logger.info("Running in fixture mode from %s", path)
            yield Request(path.as_uri(), callback=self.parse_fixture, dont_filter=True)
            return

        self.logger.info("Phase A (discovery): paginating the listing %s", self._listing_path)
        yield self._listing_request(1)

    def closed(self, reason: str) -> None:
        self.logger.info(
            "Crawl finished (%s): %d listing pages, queued %d vinyl products; emitted %d listings "
            "with %d tracks (%d non-vinyl skipped, new vinyl only).",
            reason,
            self._pages_crawled,
            self._queued,
            self._items_emitted,
            self._tracks_emitted,
            self._skipped_non_vinyl,
        )

    # --- phase A: listing pagination ---------------------------------------------------------

    def _listing_request(self, page: int) -> Request:
        return Request(
            f"{BASE_URL}{self._listing_path}/page_{page}/lang_en",
            callback=self.parse_listing,
            cb_kwargs={"page": page},
        )

    def parse_listing(self, response: Response, page: int) -> Iterator[Request]:
        if not isinstance(response, TextResponse):
            return
        self._pages_crawled += 1

        found = 0
        for href in Selector(text=response.text).css("a::attr(href)").getall():
            url = response.urljoin(href.strip())
            match = _LISTING_VINYL.search(url)
            if not match:
                continue  # not a vinyl product link (CD / equipment / navigation)
            product_id = match.group(1)
            if product_id in self._seen:
                continue
            self._seen.add(product_id)
            found += 1
            if self._max_products is not None and self._queued >= self._max_products:
                break
            self._queued += 1
            # Force English so price/stock/track labels parse deterministically.
            yield Request(f"{url}/lang_en", callback=self.parse_product)

        self.logger.info(
            "Listing page %d: %d vinyl links (%d queued so far).", page, found, self._queued
        )
        # Stop at the first empty page (past the last), the page cap, or the product cap.
        if found == 0:
            return
        if self._max_pages is not None and page >= self._max_pages:
            return
        if self._max_products is not None and self._queued >= self._max_products:
            return
        yield self._listing_request(page + 1)

    # --- phase B: product pages --------------------------------------------------------------

    def parse_product(self, response: Response) -> Iterator[ListingItem]:
        if not isinstance(response, TextResponse):
            return
        item = _parse_product(response.text, response.url)
        if item is None:
            self._skipped_non_vinyl += 1
            return
        yield self._log_item(item)

    # --- fixture mode ------------------------------------------------------------------------

    def parse_fixture(self, response: Response, **_: Any) -> Iterator[ListingItem]:
        for raw in _as_list(json.loads(response.body.decode("utf-8"))):
            product = _as_dict(raw)
            if not product:
                continue
            html = str(product.get("html") or "")
            url = str(product.get("url") or "")
            item = _parse_product(html, url)
            if item is None:
                self._skipped_non_vinyl += 1
                continue
            yield self._log_item(item)

    # --- emit + log --------------------------------------------------------------------------

    def _log_item(self, item: ListingItem) -> ListingItem:
        self._items_emitted += 1
        self._tracks_emitted += len(item.tracks)
        self.logger.info(
            "[%d] %s - %s | %d tracks | %s %s | %s | genres: %s",
            self._items_emitted,
            item.artist,
            item.title,
            len(item.tracks),
            f"{item.price:.2f}" if item.price is not None else "-",
            item.currency or "",
            item.stock_status,
            ", ".join(item.genres) or "-",
        )
        return item
