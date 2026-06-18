"""Selected Wax spider (https://www.selectedwax.com).

Selected Wax is a Barcelona (EUR) electronic-music vinyl store. Its Next.js storefront is backed by
Supabase, reverse-proxied at the same origin, so the catalog is reachable as a PostgREST collection
at ``/rest/v1/releases`` (the politeness rule: prefer a source's structured data over scraping
markup). One paginated query returns fully-formed rows: catalog/label, format, genre, price, stock,
and the tracklist with per-track MP3 previews. That is the whole catalog in ~26 requests rather than
fetching ~25k individual album pages, so the crawl is both faster and far politer.

- Phase A (paginate + emit): walk ``/rest/v1/releases`` 1000 rows at a time (PostgREST's page cap),
  ordered by ``item_id`` for stable paging, filtered server-side to vinyl formats with no
  second-hand grading. Each row is mapped to a ListingItem and emitted immediately, so rows stream
  as pages arrive.

The release's numeric ``item_id`` is the offer's stable ``external_id`` (it also keys each track's
preview path on deejay.de, the upstream that fulfils Selected Wax's catalog, and the public album
URL). The request is authenticated with the storefront's public Supabase anon key, the same one the
website ships to every browser; it is gated by row-level security to the read-only ``releases``
view.

Rules:
- NEW vinyl only: Selected Wax also lists cassettes, merch and a few graded second-hand copies. Both
  are excluded server-side (``format`` must be a vinyl, ``vinyl_condition`` must be null, since a
  Goldmine grade like "VG+" means a used copy), and the ``format`` / condition guards in the mapper
  are a backstop for fixture runs.
- Track previews live at the track's ``audioUrl`` (a deejay.de ``/streamit`` MP3), used verbatim.
  The tracklist carries real sleeve positions ("A1", "B2"), used as-is.

Useful flags: ``-a max_products=N`` caps how many releases are emitted; ``-a page_size=N`` sets the
PostgREST page size (default 1000, its maximum); ``-a api_key=...`` overrides the anon key if the
storefront rotates it (env ``SELECTEDWAX_API_KEY`` does the same).

Two run modes share the same item pipeline, so idempotency is identical either way:
- Live mode (default): the paginated PostgREST walk above.
- Fixture mode: set SELECTEDWAX_FIXTURE to a local JSON file (a list of raw ``releases`` rows) read
  via a file:// request, for offline/dev runs.
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

from ..items import ListingItem, TrackItem

BASE_URL = "https://www.selectedwax.com"
API_URL = f"{BASE_URL}/rest/v1/releases"
SHOP_SLUG = "selectedwax"
SHOP_NAME = "Selected Wax"
SHOP_COUNTRY = "ES"
SOURCE = "selectedwax"
CURRENCY = "EUR"
PAGE_SIZE = 1000  # PostgREST caps a page at 1000 rows.

# The storefront's public Supabase anon key (shipped to every browser in the site's JS bundle, gated
# by row-level security to the read-only releases view). Override with -a api_key=... or the
# SELECTEDWAX_API_KEY env var if Selected Wax rotates it.
DEFAULT_API_KEY = (
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9"
    ".eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzgwNTk4ODYxLCJleHAiOjIwOTU5NTg4NjF9"
    ".MyCFQ1TEYCK55bW2HNw6Q7OKaSORpgGXLqN24FTBSak"
)

# Only the columns the pipeline needs (the table also carries SEO / Discogs-sync bookkeeping).
_SELECT = (
    "item_id,slug,title,artists,catalog,label,format,genre,genre_family,"
    "price,discount_price,stock_status,vinyl_condition,releaseDate,imageUrl,tracklist"
)
# New vinyl only, enforced server-side: a vinyl format and no second-hand grading.
_FILTERS = "format=ilike.*vinyl*&vinyl_condition=is.null"

# ``releaseDate`` reads like "2026-06-08"; we keep only the year.
_YEAR = re.compile(r"(\d{4})")


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


def _is_vinyl(format_text: str) -> bool:
    return "vinyl" in format_text.lower()


def _stock_status(raw: Any) -> str:
    """Map Selected Wax's ``stock_status`` token onto the StockStatus enum (see packages/db)."""
    value = _clean(raw).lower().replace("-", "_").replace(" ", "_")
    if value == "in_stock":
        return "in_stock"
    if value in ("pre_order", "preorder", "ships_from"):
        return "preorder"
    if value in ("sold_out", "soldout", "out_of_stock"):
        return "out_of_stock"
    return "unknown"


def _artist(row: dict[str, Any]) -> str:
    names = [_clean(a) for a in _as_list(row.get("artists")) if _clean(a)]
    return ", ".join(names) or "Unknown"


def _genres(row: dict[str, Any]) -> list[str]:
    """``genre`` is a comma-joined style string; ``genre_family`` is the broad bucket. Keep both."""
    names: list[str] = []
    seen: set[str] = set()
    candidates = [p.strip() for p in _clean(row.get("genre")).split(",")]
    candidates.append(_clean(row.get("genre_family")))
    for name in candidates:
        if not name or name.lower() in seen:
            continue
        seen.add(name.lower())
        names.append(name)
    return names


def _tracks(row: dict[str, Any]) -> list[TrackItem]:
    tracks: list[TrackItem] = []
    seen: set[str] = set()
    for raw in (_as_dict(t) for t in _as_list(row.get("tracklist"))):
        title = _clean(raw.get("title"))
        if not title:
            continue
        position = _clean(raw.get("position")) or str(len(tracks) + 1)
        if position in seen:
            continue
        seen.add(position)
        preview = _clean(raw.get("audioUrl")) or None
        tracks.append(TrackItem(position=position, title=title, preview_url=preview))
    return tracks


def _to_item(row: dict[str, Any]) -> ListingItem | None:
    row = _as_dict(row)
    item_id = row.get("item_id")
    external_id = str(item_id).strip() if item_id is not None else ""
    title = _clean(row.get("title"))
    if not external_id or not title:
        return None

    format_text = _clean(row.get("format"))
    # New vinyl only: live runs filter these out server-side; this guards fixture rows too.
    if format_text and not _is_vinyl(format_text):
        return None
    if _clean(row.get("vinyl_condition")):  # a Goldmine grade means a used copy
        return None

    slug = _clean(row.get("slug"))
    # Public album URLs are the lower-cased slug (the original-case slug 301-redirects to it).
    source_url = f"{BASE_URL}/album/{slug.lower()}/" if slug else None

    year_match = _YEAR.search(_clean(row.get("releaseDate")))
    # The sale price (``discount_price``) wins when present, else the regular price.
    price = _to_float(row.get("discount_price")) or _to_float(row.get("price"))

    return ListingItem(
        shop_slug=SHOP_SLUG,
        shop_name=SHOP_NAME,
        shop_country=SHOP_COUNTRY,
        title=title,
        artist=_artist(row),
        year=int(year_match.group(1)) if year_match else None,
        cover_art_url=_clean(row.get("imageUrl")) or None,
        label=_clean(row.get("label")) or None,
        catalog_number=_clean(row.get("catalog")) or None,
        format=format_text or None,
        genres=_genres(row),
        tracks=_tracks(row),
        source=SOURCE,
        external_id=external_id,
        source_url=source_url,
        stock_status=_stock_status(row.get("stock_status")),
        condition=None,
        price=price,
        currency=CURRENCY if price is not None else None,
    )


class SelectedwaxSpider(scrapy.Spider):
    name = "selectedwax"
    allowed_domains = ["selectedwax.com"]

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, **kwargs)
        # `-a api_key=...` / SELECTEDWAX_API_KEY override the anon key if the store rotates it.
        api_key = (
            str(getattr(self, "api_key", "") or "").strip()
            or os.environ.get("SELECTEDWAX_API_KEY", "").strip()
            or DEFAULT_API_KEY
        )
        self._headers = {
            "apikey": api_key,
            "Authorization": f"Bearer {api_key}",
            "Accept": "application/json",
        }
        # `-a page_size=N` sets the PostgREST page size; `-a max_products=N` caps emitted releases.
        self._page_size = self._as_limit("page_size") or PAGE_SIZE
        self._max_products = self._as_limit("max_products")
        self._pages_crawled = 0
        self._items_emitted = 0
        self._tracks_emitted = 0
        self._skipped = 0  # non-vinyl / used / unmappable rows

    def _as_limit(self, attr: str) -> int | None:
        value = str(getattr(self, attr, "") or "").strip()
        return int(value) if value.isdigit() and int(value) > 0 else None

    async def start(self) -> AsyncIterator[Request]:
        fixture = os.environ.get("SELECTEDWAX_FIXTURE", "").strip()
        if fixture:
            path = Path(fixture)
            if not path.is_absolute():
                # Resolve relative to the project root (apps/scraper), two levels up.
                path = Path(__file__).resolve().parents[2] / fixture
            self.logger.info("Running in fixture mode from %s", path)
            yield Request(path.as_uri(), callback=self.parse_fixture, dont_filter=True)
            return

        self.logger.info("Phase A (catalog): paginating %s (new vinyl only)", API_URL)
        yield self._page_request(0)

    def closed(self, reason: str) -> None:
        self.logger.info(
            "Crawl finished (%s): %d API pages; emitted %d listings with %d tracks "
            "(%d non-vinyl / used / unmappable skipped, new vinyl only).",
            reason,
            self._pages_crawled,
            self._items_emitted,
            self._tracks_emitted,
            self._skipped,
        )

    # --- phase A: catalog pagination ---------------------------------------------------------

    def _page_request(self, offset: int) -> Request:
        url = (
            f"{API_URL}?select={_SELECT}&{_FILTERS}"
            f"&order=item_id.asc&limit={self._page_size}&offset={offset}"
        )
        return Request(
            url,
            headers=self._headers,
            callback=self.parse_page,
            cb_kwargs={"offset": offset},
            dont_filter=True,
        )

    def parse_page(self, response: Response, offset: int) -> Iterator[ListingItem | Request]:
        if not isinstance(response, TextResponse):
            return
        self._pages_crawled += 1
        rows = _as_list(response.json())

        emitted = 0
        for raw in rows:
            if self._max_products is not None and self._items_emitted >= self._max_products:
                break
            item = _to_item(_as_dict(raw))
            if item is None:
                self._skipped += 1
                continue
            emitted += 1
            yield self._log_item(item)

        self.logger.info(
            "Catalog page at offset %d: %d rows, emitted %d (%d total).",
            offset,
            len(rows),
            emitted,
            self._items_emitted,
        )

        # Stop on a short/empty page (past the end), the product cap, else fetch the next page.
        if len(rows) < self._page_size:
            return
        if self._max_products is not None and self._items_emitted >= self._max_products:
            return
        yield self._page_request(offset + self._page_size)

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
