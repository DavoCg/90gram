"""Dancing Vinyl Record Shop spider (https://www.dancingvinyl.com).

Dancing Vinyl is a EUR record shop running on the Common-Ground.io platform. The storefront is a
JavaScript SPA backed by a public GraphQL endpoint at ``/graphql``, so we query that structured JSON
straight (the politeness rule: prefer structured data over scraping markup). robots.txt allows the
default user-agent everywhere; only named AI crawlers are disallowed, and our identifying browser
User-Agent is not one of them.

The catalogue (``/catalogue?stock=instock``, the requested entrypoint) is powered by the
``inventory(stock: "instock", page, limit)`` query. One call returns a page of fully-formed items
(release metadata, label/catalog number, formats, genres, tracklist with MP3 previews, and the
shop's own listings with price + stock), plus ``pagination.pages`` so we know the total upfront:

- Phase A (paginate + emit): request page 1, read the page count, then walk every page. Each item is
  mapped to a ListingItem and emitted immediately, so rows stream as pages arrive.

The numeric release ``id`` is the offer's stable ``external_id`` (it also keys the release URL and
the per-track audio snippet path).

Rules:
- NEW vinyl only: the ``stock=instock`` filter still returns second-hand copies, so we drop any item
  whose only listing is ``secondHand`` and always pick the new listing when one exists. A non-vinyl
  ``format`` is a backstop guard (Common-Ground also lists books/CDs on other shops).
- Track previews live at the listing's ``tracklist[].uri`` (a CDN MP3), used verbatim. The
  ``duration`` field is free text in this schema (sometimes a time, sometimes mis-entered), so it is
  only mapped to ``duration_seconds`` when it parses as an actual time, never guessed.

Useful flags: ``-a stock=preorder`` queries a different stock filter (default ``instock``);
``-a max_pages=N`` caps how many catalogue pages are walked; ``-a max_items=N`` caps how many items
are emitted; ``-a limit=N`` sets the page size (default 100).

Two run modes share the same item pipeline, so idempotency is identical either way:
- Live mode (default): the paginated GraphQL walk above.
- Fixture mode: set DANCINGVINYL_FIXTURE to a local JSON file (a list of raw ``inventory.items``
  objects) read via a file:// request, for offline/dev runs.
"""

from __future__ import annotations

import json
import os
import re
from collections.abc import AsyncIterator, Iterator
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, cast

import scrapy
from scrapy.http import Request, Response, TextResponse

from ..items import ListingItem, TrackItem

BASE_URL = "https://www.dancingvinyl.com"
GRAPHQL_URL = f"{BASE_URL}/graphql"
SHOP_SLUG = "dancingvinyl"
SHOP_NAME = "Dancing Vinyl Record Shop"
SHOP_COUNTRY = "FR"
SOURCE = "dancingvinyl"
CURRENCY = "EUR"
PAGE_SIZE = 100

# The catalogue is the Common-Ground ``inventory`` query. We request only the fields the pipeline
# needs (a subset of the storefront's ItemFields fragment), paginated by ``page`` + ``limit``.
INVENTORY_QUERY = """
query inventory($stock: String, $page: Int, $limit: Int) {
  inventory(stock: $stock, page: $page, limit: $limit) {
    pagination { pages page limit }
    items {
      id
      uri
      listings {
        available
        preOrder
        secondHand
        stock { quantity }
        prices { beforeTaxes sale compare }
      }
      data {
        title
        cat
        releaseDate
        genres
        styles
        images { uri }
        formats { descriptions name qty }
        artists { name join }
        labels { name catno }
        tracklist { title uri duration position }
      }
    }
  }
}
"""

# A release URL / image path carries the year only through ``releaseDate`` (epoch ms); pull a year.
_YEAR = re.compile(r"(\d{4})")
# A real track duration reads as "M:SS", "MM:SS" or "H:MM:SS"; anything else in that free-text field
# (it often holds mis-entered titles) is not a duration and is ignored.
_DURATION = re.compile(r"^(?:(\d+):)?(\d{1,2}):(\d{2})$")


def _to_float(value: Any) -> float | None:
    try:
        return float(str(value))
    except (TypeError, ValueError):
        return None


def _as_dict(value: Any) -> dict[str, Any]:
    return cast("dict[str, Any]", value) if isinstance(value, dict) else {}


def _as_list(value: Any) -> list[Any]:
    return cast("list[Any]", value) if isinstance(value, list) else []


def _clean(text: Any) -> str:
    """Collapse runs of whitespace and trim; '' for anything non-string/empty."""
    return re.sub(r"\s+", " ", text).strip() if isinstance(text, str) else ""


def _parse_duration(value: Any) -> int | None:
    """Seconds for a "M:SS" / "H:MM:SS" string, else None (the field is unreliable free text)."""
    match = _DURATION.match(_clean(value))
    if not match:
        return None
    hours, minutes, seconds = match.group(1), match.group(2), match.group(3)
    return (int(hours or 0) * 3600) + (int(minutes) * 60) + int(seconds)


def _year_from_release_date(value: Any) -> int | None:
    """``releaseDate`` is epoch milliseconds (or sometimes already a year/date string)."""
    if isinstance(value, (int, float)) and value > 0:
        try:
            return datetime.fromtimestamp(value / 1000, UTC).year
        except (OverflowError, OSError, ValueError):
            return None
    match = _YEAR.search(str(value or ""))
    return int(match.group(1)) if match else None


def _artist(artists: list[dict[str, Any]]) -> str:
    """Join the credited artists Discogs-style: each name, then its ``join`` conjunction.

    ``join`` is the connector to the next artist ("&", "feat.", ...); when absent we fall back to a
    comma. Trailing connectors are trimmed.
    """
    parts: list[str] = []
    for index, artist in enumerate(artists):
        name = _clean(artist.get("name"))
        if not name:
            continue
        parts.append(name)
        if index < len(artists) - 1:
            join = _clean(artist.get("join"))
            parts.append(join if join else ",")
    rendered = re.sub(r"\s*,\s*", ", ", " ".join(parts)).strip(" ,")
    return rendered or "Unknown"


def _format(formats: list[dict[str, Any]]) -> str | None:
    """Build a readable format label, e.g. ``12" Vinyl`` or ``LP Vinyl``."""
    for raw in formats:
        name = _clean(raw.get("name"))
        descriptions = " ".join(_clean(d) for d in _as_list(raw.get("descriptions")) if _clean(d))
        label = _clean(f"{descriptions} {name}")
        if label:
            return label
    return None


def _is_vinyl(formats: list[dict[str, Any]]) -> bool:
    return any("vinyl" in _clean(f.get("name")).lower() for f in formats)


def _catalog_number(data: dict[str, Any]) -> str | None:
    for label in (_as_dict(item) for item in _as_list(data.get("labels"))):
        catno = _clean(label.get("catno"))
        if catno:
            return catno
    return _clean(data.get("cat")) or None


def _genres(data: dict[str, Any]) -> list[str]:
    names: list[str] = []
    seen: set[str] = set()
    for raw in _as_list(data.get("genres")) + _as_list(data.get("styles")):
        name = _clean(raw)
        if not name or name.lower() in seen:
            continue
        seen.add(name.lower())
        names.append(name)
    return names


def _tracks(data: dict[str, Any]) -> list[TrackItem]:
    tracks: list[TrackItem] = []
    seen: set[str] = set()
    for raw in (_as_dict(t) for t in _as_list(data.get("tracklist"))):
        title = _clean(raw.get("title"))
        if not title:
            continue
        position = _clean(raw.get("position")) or str(len(tracks) + 1)
        if position in seen:
            continue
        seen.add(position)
        preview = _clean(raw.get("uri")) or None
        tracks.append(
            TrackItem(
                position=position,
                title=title,
                duration_seconds=_parse_duration(raw.get("duration")),
                preview_url=preview,
            )
        )
    return tracks


def _new_listing(listings: list[dict[str, Any]]) -> dict[str, Any] | None:
    """Pick the shop's NEW listing for a release; None when every listing is second-hand.

    New vinyl only: a release can carry both a new and a second-hand copy, so we keep the new one
    and prefer one that is actually in stock.
    """
    new = [item for item in listings if not item.get("secondHand")]
    if not new:
        return None
    in_stock = [item for item in new if (_as_dict(item.get("stock")).get("quantity") or 0) > 0]
    return (in_stock or new)[0]


def _price(listing: dict[str, Any]) -> float | None:
    """The customer-facing price: the sale (gross) price, falling back to the pre-tax figure."""
    prices = _as_dict(listing.get("prices"))
    return _to_float(prices.get("sale")) or _to_float(prices.get("beforeTaxes"))


def _to_item(raw: dict[str, Any]) -> ListingItem | None:
    item = _as_dict(raw)
    release_id = item.get("id")
    data = _as_dict(item.get("data"))
    title = _clean(data.get("title"))
    if release_id is None or not title:
        return None

    formats = [_as_dict(f) for f in _as_list(data.get("formats"))]
    # New vinyl only: skip anything that is not a vinyl pressing.
    if not _is_vinyl(formats):
        return None

    listing = _new_listing([_as_dict(entry) for entry in _as_list(item.get("listings"))])
    # New vinyl only: every listing is second-hand -> drop the release.
    if listing is None:
        return None

    images = [_as_dict(i) for i in _as_list(data.get("images"))]
    cover_art_url = next((_clean(i.get("uri")) for i in images if _clean(i.get("uri"))), None)

    labels = [_as_dict(label) for label in _as_list(data.get("labels"))]
    label = next((_clean(item.get("name")) for item in labels if _clean(item.get("name"))), None)

    quantity = _as_dict(listing.get("stock")).get("quantity") or 0
    price = _price(listing)

    return ListingItem(
        shop_slug=SHOP_SLUG,
        shop_name=SHOP_NAME,
        shop_country=SHOP_COUNTRY,
        title=title,
        artist=_artist([_as_dict(a) for a in _as_list(data.get("artists"))]),
        year=_year_from_release_date(data.get("releaseDate")),
        cover_art_url=cover_art_url,
        label=label,
        catalog_number=_catalog_number(data),
        format=_format(formats),
        genres=_genres(data),
        tracks=_tracks(data),
        source=SOURCE,
        external_id=str(release_id),
        source_url=_clean(item.get("uri")) or f"{BASE_URL}/release/{release_id}",
        stock_status="in_stock" if quantity > 0 else "out_of_stock",
        condition=None,
        price=price,
        currency=CURRENCY if price is not None else None,
    )


class DancingvinylSpider(scrapy.Spider):
    name = "dancingvinyl"
    allowed_domains = ["dancingvinyl.com"]

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, **kwargs)
        # `-a stock=preorder` queries a different stock filter (default: the in-stock catalogue).
        self._stock = str(getattr(self, "stock", "") or "instock").strip()
        # `-a limit=N` sets the page size; `-a max_pages=N` / `-a max_items=N` cap the crawl.
        self._limit = self._as_limit("limit") or PAGE_SIZE
        self._max_pages = self._as_limit("max_pages")
        self._max_items = self._as_limit("max_items")
        self._pages_crawled = 0
        self._items_emitted = 0
        self._tracks_emitted = 0
        self._skipped = 0  # second-hand / non-vinyl / unmappable

    def _as_limit(self, attr: str) -> int | None:
        value = str(getattr(self, attr, "") or "").strip()
        return int(value) if value.isdigit() and int(value) > 0 else None

    async def start(self) -> AsyncIterator[Request]:
        fixture = os.environ.get("DANCINGVINYL_FIXTURE", "").strip()
        if fixture:
            path = Path(fixture)
            if not path.is_absolute():
                # Resolve relative to the project root (apps/scraper), two levels up.
                path = Path(__file__).resolve().parents[2] / fixture
            self.logger.info("Running in fixture mode from %s", path)
            yield Request(path.as_uri(), callback=self.parse_fixture, dont_filter=True)
            return

        self.logger.info("Phase A (catalogue): paginating inventory(stock=%s)", self._stock)
        yield self._inventory_request(1)

    def closed(self, reason: str) -> None:
        self.logger.info(
            "Crawl finished (%s): %d catalogue pages; emitted %d listings with %d tracks "
            "(%d skipped: second-hand / non-vinyl / unmappable, new vinyl only).",
            reason,
            self._pages_crawled,
            self._items_emitted,
            self._tracks_emitted,
            self._skipped,
        )

    # --- phase A: catalogue pagination -------------------------------------------------------

    def _inventory_request(self, page: int) -> Request:
        body = json.dumps(
            {
                "query": INVENTORY_QUERY,
                "variables": {"stock": self._stock, "page": page, "limit": self._limit},
            }
        )
        return Request(
            GRAPHQL_URL,
            method="POST",
            body=body,
            headers={"Content-Type": "application/json", "Accept": "application/json"},
            callback=self.parse_inventory,
            cb_kwargs={"page": page},
            dont_filter=True,
        )

    def parse_inventory(self, response: Response, page: int) -> Iterator[ListingItem | Request]:
        if not isinstance(response, TextResponse):
            return
        self._pages_crawled += 1
        inventory = _as_dict(_as_dict(_as_dict(response.json()).get("data")).get("inventory"))
        items = _as_list(inventory.get("items"))
        pages = _as_dict(inventory.get("pagination")).get("pages")

        emitted = 0
        for raw in items:
            if self._max_items is not None and self._items_emitted >= self._max_items:
                break
            item = _to_item(_as_dict(raw))
            if item is None:
                self._skipped += 1
                continue
            emitted += 1
            yield self._log_item(item)

        self.logger.info(
            "Catalogue page %d/%s: %d items, emitted %d (%d total).",
            page,
            pages if isinstance(pages, int) else "?",
            len(items),
            emitted,
            self._items_emitted,
        )

        # Stop on an empty page, the page cap, the item cap, or once the last page is reached.
        if not items:
            return
        if self._max_pages is not None and page >= self._max_pages:
            return
        if self._max_items is not None and self._items_emitted >= self._max_items:
            return
        if isinstance(pages, int) and page >= pages:
            return
        yield self._inventory_request(page + 1)

    # --- fixture mode ------------------------------------------------------------------------

    def parse_fixture(self, response: Response, **_: Any) -> Iterator[ListingItem]:
        for raw in _as_list(json.loads(response.body.decode("utf-8"))):
            item = _to_item(_as_dict(raw))
            if item is None:
                self._skipped += 1
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
