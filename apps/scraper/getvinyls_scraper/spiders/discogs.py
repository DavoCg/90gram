"""Discogs spider.

Discogs is the canonical vinyl marketplace and exposes an official JSON API, so we request
that rather than parsing HTML (the politeness rule: prefer an official API). Adding another
reseller is adding another spider in this folder, nothing else.

Two run modes share the same item pipeline, so idempotency is identical either way:
- API mode: set DISCOGS_TOKEN. The spider queries the official Discogs search API.
- Fixture mode: set DISCOGS_FIXTURE (and no token) to read a local JSON file via a file://
  request. This is for offline/dev runs where outbound access to discogs.com is unavailable.
"""

from __future__ import annotations

import json
import os
from collections.abc import AsyncIterator, Iterator
from pathlib import Path
from typing import Any, cast
from urllib.parse import urlencode

import scrapy
from scrapy.http import Request, Response, TextResponse

from ..items import ListingItem

DISCOGS_SEARCH_URL = "https://api.discogs.com/database/search"


def _safe_int(value: Any) -> int | None:
    try:
        return int(str(value))
    except (TypeError, ValueError):
        return None


class DiscogsSpider(scrapy.Spider):
    name = "discogs"
    allowed_domains = ["api.discogs.com"]

    async def start(self) -> AsyncIterator[Request]:
        fixture = os.environ.get("DISCOGS_FIXTURE", "").strip()
        token = os.environ.get("DISCOGS_TOKEN", "").strip()

        if fixture and not token:
            path = Path(fixture)
            if not path.is_absolute():
                # Resolve relative to the project root (apps/scraper), two levels up.
                path = Path(__file__).resolve().parents[2] / fixture
            self.logger.info("Running in fixture mode from %s", path)
            yield Request(path.as_uri(), callback=self.parse_fixture, dont_filter=True)
            return

        if not token:
            self.logger.error(
                "No DISCOGS_TOKEN and no DISCOGS_FIXTURE set; nothing to crawl. See .env.example."
            )
            return

        params = {
            "type": "release",
            "format": "Vinyl",
            "sort": "year",
            "sort_order": "desc",
            "per_page": "50",
            "token": token,
        }
        yield Request(
            f"{DISCOGS_SEARCH_URL}?{urlencode(params)}",
            callback=self.parse,
            headers={"Accept": "application/json"},
        )

    def parse_fixture(self, response: Response, **kwargs: Any) -> Iterator[ListingItem]:
        entries: Any = json.loads(response.body.decode("utf-8"))
        if not isinstance(entries, list):
            return
        for entry in cast(list[Any], entries):
            yield ListingItem.model_validate(entry)

    def parse(self, response: Response, **kwargs: Any) -> Iterator[ListingItem]:
        if not isinstance(response, TextResponse):
            return
        payload: Any = response.json()
        if not isinstance(payload, dict):
            return
        results_raw: Any = cast(dict[str, Any], payload).get("results", [])
        if not isinstance(results_raw, list):
            return
        for entry in cast(list[Any], results_raw):
            if isinstance(entry, dict):
                item = self._to_item(cast(dict[str, Any], entry))
                if item is not None:
                    yield item

    def _to_item(self, result: dict[str, Any]) -> ListingItem | None:
        external_id = result.get("id")
        raw_title = result.get("title")
        if external_id is None or not raw_title:
            return None

        # Discogs search "title" is usually "Artist - Album".
        artist, _, album = str(raw_title).partition(" - ")
        source_url = result.get("uri") or result.get("resource_url")
        release_id = str(external_id)

        # Discogs splits genre and style; merge both into our flat genre taxonomy.
        genres: list[str] = []
        for key in ("genre", "style"):
            raw = result.get(key)
            if isinstance(raw, list):
                genres.extend(str(g) for g in cast(list[Any], raw))

        catno = result.get("catno")
        label_raw = result.get("label")
        label = None
        if isinstance(label_raw, list) and label_raw:
            label = str(cast(list[Any], label_raw)[0])
        elif isinstance(label_raw, str):
            label = label_raw

        return ListingItem(
            # Discogs is modeled as a single shop for now.
            shop_slug="discogs",
            shop_name="Discogs",
            shop_country=str(result.get("country")) if result.get("country") else None,
            title=(album or str(raw_title)).strip(),
            artist=(artist or "Unknown").strip(),
            year=_safe_int(result.get("year")),
            cover_art_url=result.get("cover_image") or result.get("thumb"),
            label=label,
            catalog_number=str(catno) if catno else None,
            format=None,
            genres=genres,
            # The search API returns neither a tracklist nor a price; only the fixture
            # (offline/dev) carries the full nested data. Live offers come price-less here.
            tracks=[],
            source="discogs",
            external_id=release_id,
            source_url=str(source_url) if source_url else None,
            stock_status="unknown",
            condition=None,
            price=None,
            currency=None,
        )
