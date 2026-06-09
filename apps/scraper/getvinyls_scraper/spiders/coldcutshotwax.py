"""ColdCuts // HotWax spider (https://coldcutshotwax.uk).

ColdCuts // HotWax is a UK vinyl shop running on Shopify. Shopify exposes structured JSON for its
public catalog, so we use that for metadata (the politeness rule: prefer structured data over
scraping markup). robots.txt confirms collection and product JSON is crawlable; the disallowed
cart/checkout/AJAX surfaces are never touched.

The one thing the JSON does NOT carry is the tracklist (positions, titles, MP3 previews). That data
is a server-rendered product metafield, and it is NOT exposed by products.json, /products/<h>.js,
the embedded ProductJson blob, or the Storefront API. It IS, however, rendered onto every
*collection* page: each track is a `<span data-producturl="/products/<handle>" data-track="..."
data-src="...mp3">`. So one collection HTML page yields the full tracklists for ~36 products at
once, which is far cheaper than fetching one HTML page per product.

Metadata (cheap, 250/page) loads first so that the slow track crawl can emit as it goes, rather
than holding everything until the end. The phases hand off on the ``spider_idle`` signal, which
fires when the scheduler empties (a deterministic "previous phase done" marker):
- Phase A (metadata): walk the whole catalog via ``/products.json`` into an in-memory
  ``handle -> product`` map of NEW products. Fast (~20 pages), emits nothing yet.
- Phase B (tracks + streaming insert): walk every non-second-hand collection's HTML pages. Each
  page carries the tracklists for ~36 products; for every product whose tracks we find there, emit
  its ListingItem immediately (joined with the cached metadata). So inserts stream per collection
  page, starting seconds after phase A instead of after the whole track crawl.
- Phase C (flush): emit the remaining new products that had no audio preview (so never appeared in
  a track span), with empty tracklists, so the catalog is covered in full.

Other rules:
- A product's genres come from its own ``product_type`` plus its music ``tags`` (a noise filter
  drops sale batches, seller codes and pressing notes), not from any collection title, so the
  genres table stays clean.
- NEW vinyl only: used/second-hand records are never ingested. The dedicated second-hand
  collections are skipped in phase 1, and any record tagged "2nd-hand" or "vatmarginscheme" is
  dropped in phase 2 before it is emitted.

Two run modes share the same item pipeline, so idempotency is identical either way:
- Live mode (default): the two-phase crawl above. No token needed; the catalog is open.
- Fixture mode: set CCHW_FIXTURE to read a local JSON file (raw Shopify product objects, optionally
  each with a ``tracklist_html`` of collection-style track spans) via a file:// request.
"""

from __future__ import annotations

import json
import os
import re
from collections.abc import AsyncIterator, Iterator
from pathlib import Path
from typing import Any, cast

import scrapy
from parsel import Selector
from scrapy import signals
from scrapy.exceptions import DontCloseSpider
from scrapy.http import Request, Response, TextResponse

from ..items import ListingItem, TrackItem

BASE_URL = "https://coldcutshotwax.uk"
SHOP_SLUG = "coldcutshotwax"
SHOP_NAME = "ColdCuts // HotWax"
SHOP_COUNTRY = "GB"
SOURCE = "coldcutshotwax"
CURRENCY = "GBP"
PAGE_SIZE = 250
_PRODUCT_PREFIX = "/products/"

# Genre comes from a product's own ``product_type`` and music ``tags``. Both namespaces are shared
# with operational metadata (sale batches, seller initials, media format, pressing notes), so we
# filter that out: an exact denylist for the stable store-wide noise, plus two structural rules
# (below) that catch the per-seller batch codes without enumerating them.
#
# "Records & LPs" is Shopify's generic catch-all product_type for Discogs-imported second-hand
# records; it is a format bucket, not a genre, so it is denied here too.
_NON_GENRE_TAGS = {
    "records & lps",
    "discogs",
    "process",
    "vatmarginscheme",
    "sale",
    "clearance",
    "pre-order",
    "preorder",
    "reissue",
    "repress",
    "edits",
    "cd",
    "djchart",
    "omega",
    "shsale",
    "2nd-hand",
    "second-hand",
    "second hand",
    "used",
    "new",
}
# Tags that mean the record is used. The VAT margin scheme applies to second-hand resale, so it is
# a reliable used signal alongside the explicit second-hand tags.
#
# Standing rule: we ingest NEW vinyl only, never used/second-hand. A record carrying any of these
# tags is dropped, and whole second-hand collections (handle contains the marker below) are not even
# crawled. Both guards apply on every run.
_USED_TAGS = {"2nd-hand", "second-hand", "second hand", "used", "vatmarginscheme"}
_USED_COLLECTION_MARKER = "second-hand"


def _is_used(tags: list[str]) -> bool:
    return any(tag.lower() in _USED_TAGS for tag in tags)


# A tag with a digit is a batch/year code (e.g. "bestseller-2026", "top2025", "ras47", "ch1").
_HAS_DIGIT = re.compile(r"\d")
# A 1-3 letter lower-case tag is a seller's initials / shelf code (e.g. "bb", "mm", "ms"), never a
# genre. Real short genres ("Dub", "Pop", "R&B") are capitalised or punctuated, so they survive.
_SHORT_CODE = re.compile(r"^[a-z]{1,3}$")


def _is_genre(name: str) -> bool:
    low = name.lower()
    if low in _NON_GENRE_TAGS:
        return False
    if _HAS_DIGIT.search(name):
        return False
    return not _SHORT_CODE.match(name)


# A tracklist label is "<position><sep><title>", e.g. "A1 - Sonido Latino", "1. Raindance",
# "2 Oh By The Way". The position is a side letter and/or number; the separator is a dot, dash
# (incl. en dash) and/or whitespace.
_TRACK_LABEL = re.compile(r"^\s*([A-Za-z]?\d+|[A-Za-z])\s*[-.–]?\s+(.+?)\s*$")


def _split_track_label(label: str, fallback_position: int) -> tuple[str, str]:
    match = _TRACK_LABEL.match(label)
    if match:
        return match.group(1), match.group(2).strip()
    # Unrecognised shape: keep the whole label as the title under a synthetic position.
    return str(fallback_position), label.strip()


def _parse_collection_tracks(html: str) -> dict[str, list[TrackItem]]:
    """Harvest the per-product track spans rendered on a collection page.

    Each track is ``<span data-producturl="/products/<handle>" data-track="1. Title"
    data-src="...mp3">``. We group by handle and dedupe by position within a product.
    """
    out: dict[str, list[TrackItem]] = {}
    seen: dict[str, set[str]] = {}
    for span in Selector(text=html).css("span[data-producturl][data-track]"):
        producturl = (span.attrib.get("data-producturl") or "").strip()
        label = (span.attrib.get("data-track") or "").strip()
        if not producturl.startswith(_PRODUCT_PREFIX) or not label:
            continue
        handle = producturl[len(_PRODUCT_PREFIX) :].strip("/")
        if not handle:
            continue
        tracks = out.setdefault(handle, [])
        positions = seen.setdefault(handle, set())
        position, title = _split_track_label(label, len(tracks) + 1)
        if position in positions:
            continue
        positions.add(position)
        preview = (span.attrib.get("data-src") or "").strip() or None
        tracks.append(TrackItem(position=position, title=title or label, preview_url=preview))
    return out


def _as_dict(value: Any) -> dict[str, Any] | None:
    return cast(dict[str, Any], value) if isinstance(value, dict) else None


def _as_list(value: Any) -> list[Any]:
    return cast(list[Any], value) if isinstance(value, list) else []


def _to_float(value: Any) -> float | None:
    try:
        return float(str(value))
    except (TypeError, ValueError):
        return None


class ColdcutshotwaxSpider(scrapy.Spider):
    name = "coldcutshotwax"
    allowed_domains = ["coldcutshotwax.uk"]

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, **kwargs)
        # Phase A loads this (handle -> raw Shopify product) for every NEW product; phases B and C
        # emit from it, so inserts stream instead of waiting for the whole track crawl to finish.
        self._meta_by_handle: dict[str, dict[str, Any]] = {}
        self._pending: set[str] = set()  # new handles not yet emitted
        self._phase = 0  # 0=metadata, 1=tracks (streaming), 2=flush, 3=fixture/done
        # Optional `-a collections=h1,h2` restricts phase B to those collections (re-crawl / test).
        requested = str(getattr(self, "collections", "") or "")
        self._only_collections = [h.strip() for h in requested.split(",") if h.strip()]
        # Running totals surfaced in the logs so a long crawl shows visible progress.
        self._collections_queued = 0
        self._collection_pages_crawled = 0
        self._items_emitted = 0
        self._tracks_emitted = 0
        self._used_skipped = 0
        self._no_track_count = 0
        self._flushed = 0

    @classmethod
    def from_crawler(cls, crawler: Any, *args: Any, **kwargs: Any) -> ColdcutshotwaxSpider:
        spider = cast("ColdcutshotwaxSpider", super().from_crawler(crawler, *args, **kwargs))
        # spider_idle fires when the scheduler drains; that is our "phase finished" hand-off marker.
        crawler.signals.connect(spider._on_idle, signal=signals.spider_idle)
        return spider

    async def start(self) -> AsyncIterator[Request]:
        fixture = os.environ.get("CCHW_FIXTURE", "").strip()
        if fixture:
            # Fixture mode is self-contained: jump past the live phases so spider_idle just closes.
            self._phase = 3
            path = Path(fixture)
            if not path.is_absolute():
                # Resolve relative to the project root (apps/scraper), two levels up.
                path = Path(__file__).resolve().parents[2] / fixture
            self.logger.info("Running in fixture mode from %s", path)
            yield Request(path.as_uri(), callback=self.parse_fixture, dont_filter=True)
            return

        self.logger.info("Phase A (metadata): loading the catalog from /products.json")
        yield self._catalog_request(page=1)

    def _on_idle(self) -> None:
        engine = self.crawler.engine
        if engine is None:
            return
        if self._phase == 0:
            # Phase A drained: the metadata map is complete. Start the streaming track crawl.
            self._phase = 1
            self.logger.info(
                "Phase A done: %d new products in catalog. Phase B (tracks): streaming inserts as "
                "collection pages arrive.",
                len(self._pending),
            )
            if self._only_collections:
                self.logger.info("Phase B restricted to collections %s", self._only_collections)
                self._collections_queued += len(self._only_collections)
                for handle in self._only_collections:
                    engine.crawl(self._collection_page_request(handle, page=1))
            else:
                engine.crawl(self._collections_request(page=1))
            raise DontCloseSpider
        if self._phase == 1:
            # Phase B drained: flush the new products that never showed up in a track span (no audio
            # preview). One throwaway request lets us yield those items from a normal callback.
            self._phase = 2
            self.logger.info(
                "Phase B done: streamed %d listings across %d collection pages; flushing %d "
                "track-less products.",
                self._items_emitted,
                self._collection_pages_crawled,
                len(self._pending),
            )
            engine.crawl(
                Request(
                    f"{BASE_URL}/products.json?limit=1&page=1",
                    callback=self.parse_flush,
                    dont_filter=True,
                    headers={"Accept": "application/json"},
                )
            )
            raise DontCloseSpider
        # phase 2 drained -> let the spider close.

    def closed(self, reason: str) -> None:
        self.logger.info(
            "Crawl finished (%s): %d new products; %d collections, %d collection pages; emitted %d "
            "listings with %d tracks (%d flushed track-less), skipped %d used (new vinyl only).",
            reason,
            len(self._meta_by_handle),
            self._collections_queued,
            self._collection_pages_crawled,
            self._items_emitted,
            self._tracks_emitted,
            self._flushed,
            self._used_skipped,
        )

    # --- phase A: load catalog metadata (new products only) ----------------------------------

    def _catalog_request(self, page: int) -> Request:
        return Request(
            f"{BASE_URL}/products.json?limit={PAGE_SIZE}&page={page}",
            callback=self.parse_catalog_meta,
            cb_kwargs={"page": page},
            headers={"Accept": "application/json"},
        )

    def parse_catalog_meta(self, response: Response, page: int) -> Iterator[Request]:
        if not isinstance(response, TextResponse):
            return
        payload = _as_dict(response.json())
        products = _as_list(payload.get("products")) if payload else []
        if not products:
            return
        added = 0
        for raw in products:
            product = _as_dict(raw)
            if product is None:
                continue
            handle = product.get("handle")
            if not handle or product.get("id") is None or not product.get("title"):
                continue
            tags = [str(t).strip() for t in _as_list(product.get("tags")) if str(t).strip()]
            # New vinyl only: used records never enter the map, so they are never emitted.
            if _is_used(tags):
                self._used_skipped += 1
                continue
            self._meta_by_handle[str(handle)] = product
            self._pending.add(str(handle))
            added += 1
        self.logger.info(
            "Phase A page %d: %d products (%d new kept, %d used skipped; %d cached).",
            page,
            len(products),
            added,
            self._used_skipped,
            len(self._meta_by_handle),
        )
        if len(products) == PAGE_SIZE:
            yield self._catalog_request(page + 1)

    # --- phase B: collection discovery + track harvesting + streaming insert -----------------

    def _collections_request(self, page: int) -> Request:
        return Request(
            f"{BASE_URL}/collections.json?limit={PAGE_SIZE}&page={page}",
            callback=self.parse_collections,
            cb_kwargs={"page": page},
            headers={"Accept": "application/json"},
        )

    def parse_collections(self, response: Response, page: int) -> Iterator[Request]:
        if not isinstance(response, TextResponse):
            return
        payload = _as_dict(response.json())
        collections = _as_list(payload.get("collections")) if payload else []
        if not collections:
            return

        queued = 0
        for raw in collections:
            collection = _as_dict(raw)
            if collection is None:
                continue
            handle = collection.get("handle")
            # Skip empty collections: no products, no tracks.
            if not handle or not collection.get("products_count"):
                continue
            # New vinyl only: don't even crawl the dedicated second-hand collections.
            if _USED_COLLECTION_MARKER in str(handle).lower():
                self.logger.debug("Skipping second-hand collection '%s'", handle)
                continue
            queued += 1
            yield self._collection_page_request(str(handle), page=1)

        self._collections_queued += queued
        self.logger.info(
            "Collections index page %d: %d listed, %d non-empty queued (%d collections so far).",
            page,
            len(collections),
            queued,
            self._collections_queued,
        )

        # The collections index itself is paginated; keep walking until a page comes back empty.
        if len(collections) == PAGE_SIZE:
            yield self._collections_request(page=page + 1)

    def _collection_page_request(self, handle: str, page: int) -> Request:
        return Request(
            f"{BASE_URL}/collections/{handle}?page={page}",
            callback=self.parse_collection_page,
            cb_kwargs={"handle": handle, "page": page},
        )

    def parse_collection_page(
        self, response: Response, handle: str, page: int
    ) -> Iterator[ListingItem | Request]:
        if not isinstance(response, TextResponse):
            return
        self._collection_pages_crawled += 1
        by_handle = _parse_collection_tracks(response.text)

        inserted = 0
        for product_handle, tracks in by_handle.items():
            # Emit each new product the first time we find its tracks; the pending set dedupes the
            # same product reached from several collections (and excludes used/orphan handles).
            if product_handle not in self._pending:
                continue
            item = self._emit(product_handle, tracks)
            if item is not None:
                self._pending.discard(product_handle)
                inserted += 1
                yield item

        if not by_handle:
            # A page with no track spans is past the collection's last page of previewable records.
            return
        self.logger.info(
            "Collection '%s' page %d: %d products with tracks, inserted %d new (%d still pending).",
            handle,
            page,
            len(by_handle),
            inserted,
            len(self._pending),
        )
        yield self._collection_page_request(handle, page + 1)

    # --- phase C: flush new products that had no audio preview --------------------------------

    def parse_flush(self, response: Response, **_: Any) -> Iterator[ListingItem]:
        for handle in list(self._pending):
            item = self._emit(handle, [])
            if item is not None:
                self._pending.discard(handle)
                self._flushed += 1
                yield item

    # --- emit + log --------------------------------------------------------------------------

    def _emit(self, handle: str, tracks: list[TrackItem]) -> ListingItem | None:
        product = self._meta_by_handle.get(handle)
        if product is None:
            return None
        item = self._to_item(product, tracks)
        return self._log_item(item) if item is not None else None

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
        if not item.tracks:
            self._no_track_count += 1
            self.logger.warning("No tracks scraped for %s", item.source_url)
        return item

    # --- fixture mode ------------------------------------------------------------------------

    def parse_fixture(self, response: Response, **_: Any) -> Iterator[ListingItem]:
        entries = json.loads(response.body.decode("utf-8"))
        for raw in _as_list(entries):
            product = _as_dict(raw)
            if product is None:
                continue
            # The fixture may carry collection-style track spans to exercise the parser.
            by_handle = _parse_collection_tracks(str(product.get("tracklist_html") or ""))
            tracks = by_handle.get(str(product.get("handle") or ""), [])
            item = self._to_item(product, tracks)
            if item is None:
                continue
            # New vinyl only: skip used records (live runs exclude these in phase A).
            if item.condition == "used":
                self._used_skipped += 1
                continue
            yield self._log_item(item)

    # --- mapping -----------------------------------------------------------------------------

    def _to_item(self, product: dict[str, Any], tracks: list[TrackItem]) -> ListingItem | None:
        product_id = product.get("id")
        raw_title = product.get("title")
        handle = product.get("handle")
        if product_id is None or not raw_title or not handle:
            return None
        external_id = str(product_id)

        # Shopify titles are "Artist - Album"; fall back to the whole string when there is no dash.
        artist, _, album = str(raw_title).partition(" - ")
        title = (album or str(raw_title)).strip()
        artist = (artist or "Unknown").strip()

        variants = [v for v in (_as_dict(v) for v in _as_list(product.get("variants"))) if v]
        price, in_stock = self._price_and_stock(variants)

        images = [img for img in (_as_dict(i) for i in _as_list(product.get("images"))) if img]
        cover_art_url = str(images[0]["src"]) if images and images[0].get("src") else None

        vendor = product.get("vendor")
        label = str(vendor).strip() if vendor else None

        tags = [str(t).strip() for t in _as_list(product.get("tags")) if str(t).strip()]
        condition = "used" if _is_used(tags) else None

        return ListingItem(
            shop_slug=SHOP_SLUG,
            shop_name=SHOP_NAME,
            shop_country=SHOP_COUNTRY,
            title=title,
            artist=artist,
            year=None,
            cover_art_url=cover_art_url,
            label=label,
            catalog_number=self._catalog_number(variants),
            format=None,
            genres=self._genres(product.get("product_type"), tags),
            tracks=tracks,
            source=SOURCE,
            external_id=external_id,
            source_url=f"{BASE_URL}/products/{handle}",
            stock_status="in_stock" if in_stock else "out_of_stock",
            condition=condition,
            price=price,
            currency=CURRENCY if price is not None else None,
        )

    @staticmethod
    def _price_and_stock(variants: list[dict[str, Any]]) -> tuple[float | None, bool]:
        available = [v for v in variants if v.get("available")]
        in_stock = bool(available)
        # Show the cheapest in-stock price; if nothing is in stock, the cheapest price seen at all.
        pool = available or variants
        prices = [p for p in (_to_float(v.get("price")) for v in pool) if p is not None]
        return (min(prices) if prices else None), in_stock

    @staticmethod
    def _catalog_number(variants: list[dict[str, Any]]) -> str | None:
        for variant in variants:
            sku = variant.get("sku")
            if not sku:
                continue
            # SKUs look like "ASVN052 // C22" or "BEWITH068LP (B50)": the label catalog number,
            # then a shelf location (after " // " or in trailing parentheses). Keep only the number.
            number = str(sku).split("//", 1)[0].strip()
            number = re.sub(r"\s*\([^)]*\)\s*$", "", number).strip()
            if number:
                return number
        return None

    @staticmethod
    def _genres(product_type: Any, tags: list[str]) -> list[str]:
        # product_type is the shop's clean top-level genre; tags add finer subgenres. Both run
        # through the same noise filter. Dedupe case-insensitively (the pipeline keys genres by
        # slug, but this keeps a single clean display name per genre on the item).
        names: list[str] = []
        seen: set[str] = set()
        candidates = [str(product_type).strip()] if product_type else []
        candidates += tags
        for name in candidates:
            if not name or not _is_genre(name):
                continue
            key = name.lower()
            if key in seen:
                continue
            seen.add(key)
            names.append(name)
        return names
