"""Item pipeline that writes scraped listings straight into Postgres.

Design (see the scraper skill):
- Reflect the live tables with SQLAlchemy Core (autoload_with). We never hand-maintain column
  names and never run DDL. Prisma owns the schema.
- One ``ListingItem`` fans out across several tables (shop, vinyl, tracks, genres, shop_vinyl,
  offer, prices), written in a single transaction that wires the foreign keys from RETURNING ids.
  Every step upserts idempotently, so re-running a crawl updates rows instead of duplicating them.
- ``Vinyl`` is the canonical, shop-agnostic release: we upsert it on a normalized ``match_key``
  (``artist|title|catalog_number``), so the same record from several shops collapses onto one row
  ("match-or-create" is just this upsert). ``ShopVinyl`` is the per-shop record that links a shop
  to that ``Vinyl``; ``Offer`` is its price/stock. Tracks and genres hang off the canonical Vinyl.
- Idempotency keys: ``shops.slug``, ``vinyls.match_key``, ``tracks (vinyl_id, position)``,
  ``genres.slug``, ``vinyl_genres (vinyl_id, genre_id)``, ``shop_vinyls (source, external_id)``,
  ``offers (source, external_id)``. ``prices`` is append-only: a row is inserted only when the
  offer's price actually changed, giving a clean price history.

``id`` and ``updated_at`` have no database default (Prisma sets them in app code), so the pipeline
supplies them for every table that has those columns. ``created_at`` / ``observed_at`` have DB
defaults. ``vinyl_genres`` is a pure join (composite PK, no id/updated_at).
"""

from __future__ import annotations

import re
import unicodedata
from datetime import UTC, datetime
from decimal import Decimal
from typing import Any
from urllib.parse import urlsplit, urlunsplit
from uuid import uuid4

from sqlalchemy import Connection, Engine, MetaData, Table, create_engine, select
from sqlalchemy.dialects.postgresql import insert as pg_insert

from .items import ListingItem, TrackItem

_SLUG_RE = re.compile(r"[^a-z0-9]+")
_NON_ALNUM_RE = re.compile(r"[^a-z0-9]+")


def _slugify(name: str) -> str:
    return _SLUG_RE.sub("-", name.lower()).strip("-")


def _normalize_key_part(value: str) -> str:
    """Lower-case, strip accents, collapse non-alphanumerics to single spaces."""
    decomposed = unicodedata.normalize("NFKD", value)
    stripped = "".join(c for c in decomposed if not unicodedata.combining(c))
    return _NON_ALNUM_RE.sub(" ", stripped.lower()).strip()


def _match_key(artist: str, title: str, catalog_number: str | None) -> str:
    """Canonical, shop-agnostic identity for a release. Kept in lockstep with the seed's
    makeMatchKey (packages/db): ``artist|title|catalog_number`` of normalized parts. The same
    release scraped from several shops yields one Vinyl row."""
    return "|".join(
        (
            _normalize_key_part(artist),
            _normalize_key_part(title),
            _normalize_key_part(catalog_number or ""),
        )
    )


def _to_sqlalchemy_url(database_url: str) -> str:
    """Turn a Prisma-style postgresql:// URL into a SQLAlchemy + psycopg URL.

    Drops Prisma-only query params (e.g. ?schema=public) that psycopg does not understand.
    """
    parts = urlsplit(database_url)
    return urlunsplit(("postgresql+psycopg", parts.netloc, parts.path, "", ""))


class PostgresPipeline:
    def __init__(self, database_url: str) -> None:
        self._database_url = database_url
        self._engine: Engine | None = None
        self._tables: dict[str, Table] = {}

    @classmethod
    def from_crawler(cls, crawler: Any) -> PostgresPipeline:
        database_url = str(crawler.settings.get("DATABASE_URL", ""))
        if not database_url:
            raise ValueError(
                "DATABASE_URL is not set. The scraper shares it with Prisma; see .env.example."
            )
        return cls(_to_sqlalchemy_url(database_url))

    def open_spider(self) -> None:
        engine = create_engine(self._database_url, future=True)
        metadata = MetaData()
        # Reflect the live schema. No hand-maintained columns, no DDL, no drift.
        self._tables = {
            name: Table(name, metadata, autoload_with=engine)
            for name in (
                "shops",
                "vinyls",
                "tracks",
                "genres",
                "vinyl_genres",
                "shop_vinyls",
                "offers",
                "prices",
            )
        }
        self._engine = engine

    def close_spider(self) -> None:
        if self._engine is not None:
            self._engine.dispose()

    def process_item(self, item: Any) -> Any:
        listing = item if isinstance(item, ListingItem) else ListingItem.model_validate(item)
        if self._engine is None:
            return item
        with self._engine.begin() as conn:
            self._write_listing(conn, listing)
        return item

    # --- one transaction per listing ---------------------------------------------------------

    def _write_listing(self, conn: Connection, listing: ListingItem) -> None:
        now = datetime.now(UTC)
        shop_id = self._upsert_shop(conn, listing, now)
        # Match-or-create the canonical Vinyl, then attach its tracks and genres.
        vinyl_id = self._upsert_vinyl(conn, listing, now)
        self._upsert_tracks(conn, vinyl_id, listing.tracks, now)
        self._upsert_genres(conn, vinyl_id, listing.genres, now)
        # The per-shop record linking this shop to that Vinyl, then its offer + price history.
        shop_vinyl_id = self._upsert_shop_vinyl(conn, vinyl_id, shop_id, listing, now)
        prior_price = self._select_offer_price(conn, listing)
        offer_id = self._upsert_offer(conn, shop_vinyl_id, listing, now)
        self._maybe_insert_price(conn, offer_id, listing, prior_price, now)

    def _upsert_shop(self, conn: Connection, listing: ListingItem, now: datetime) -> str:
        table = self._tables["shops"]
        statement = (
            pg_insert(table)
            .values(
                id=uuid4().hex,
                slug=listing.shop_slug,
                name=listing.shop_name,
                country=listing.shop_country,
                updated_at=now,
            )
            .on_conflict_do_update(
                index_elements=["slug"],
                set_={
                    "name": listing.shop_name,
                    "country": listing.shop_country,
                    "updated_at": now,
                },
            )
            .returning(table.c.id)
        )
        return str(conn.execute(statement).scalar_one())

    def _upsert_vinyl(self, conn: Connection, listing: ListingItem, now: datetime) -> str:
        table = self._tables["vinyls"]
        mutable = {
            "title": listing.title,
            "artist": listing.artist,
            "year": listing.year,
            "cover_art_url": listing.cover_art_url,
            "label": listing.label,
            "catalog_number": listing.catalog_number,
            "format": listing.format,
            "updated_at": now,
        }
        statement = (
            pg_insert(table)
            .values(
                id=uuid4().hex,
                match_key=_match_key(listing.artist, listing.title, listing.catalog_number),
                **mutable,
            )
            .on_conflict_do_update(index_elements=["match_key"], set_=mutable)
            .returning(table.c.id)
        )
        return str(conn.execute(statement).scalar_one())

    def _upsert_tracks(
        self, conn: Connection, vinyl_id: str, tracks: list[TrackItem], now: datetime
    ) -> None:
        if not tracks:
            return
        table = self._tables["tracks"]
        rows = [
            {
                "id": uuid4().hex,
                "vinyl_id": vinyl_id,
                "position": track.position,
                "title": track.title,
                "duration_seconds": track.duration_seconds,
                "preview_url": track.preview_url,
                "updated_at": now,
            }
            for track in tracks
        ]
        statement = pg_insert(table).values(rows)
        statement = statement.on_conflict_do_update(
            index_elements=["vinyl_id", "position"],
            set_={
                "title": statement.excluded.title,
                "duration_seconds": statement.excluded.duration_seconds,
                "preview_url": statement.excluded.preview_url,
                "updated_at": statement.excluded.updated_at,
            },
        )
        conn.execute(statement)

    def _upsert_genres(
        self, conn: Connection, vinyl_id: str, genres: list[str], now: datetime
    ) -> None:
        genre_table = self._tables["genres"]
        join_table = self._tables["vinyl_genres"]
        for name in genres:
            clean = name.strip()
            if not clean:
                continue
            slug = _slugify(clean)
            genre_stmt = (
                pg_insert(genre_table)
                .values(id=uuid4().hex, name=clean, slug=slug, updated_at=now)
                # Touch updated_at so the upsert always returns the existing row's id.
                .on_conflict_do_update(index_elements=["slug"], set_={"updated_at": now})
                .returning(genre_table.c.id)
            )
            genre_id = str(conn.execute(genre_stmt).scalar_one())
            join_stmt = (
                pg_insert(join_table)
                .values(vinyl_id=vinyl_id, genre_id=genre_id)
                .on_conflict_do_nothing(index_elements=["vinyl_id", "genre_id"])
            )
            conn.execute(join_stmt)

    def _upsert_shop_vinyl(
        self, conn: Connection, vinyl_id: str, shop_id: str, listing: ListingItem, now: datetime
    ) -> str:
        table = self._tables["shop_vinyls"]
        mutable = {
            "vinyl_id": vinyl_id,
            "shop_id": shop_id,
            "source_url": listing.source_url,
            # Keep what the shop reported, for transparency and re-matching against match_key.
            "raw_title": listing.title,
            "raw_artist": listing.artist,
            "raw_catalog_number": listing.catalog_number,
            "updated_at": now,
        }
        statement = (
            pg_insert(table)
            .values(
                id=uuid4().hex,
                source=listing.source,
                external_id=listing.external_id,
                **mutable,
            )
            .on_conflict_do_update(index_elements=["source", "external_id"], set_=mutable)
            .returning(table.c.id)
        )
        return str(conn.execute(statement).scalar_one())

    def _select_offer_price(self, conn: Connection, listing: ListingItem) -> Decimal | None:
        table = self._tables["offers"]
        statement = select(table.c.current_price).where(
            table.c.source == listing.source, table.c.external_id == listing.external_id
        )
        return conn.execute(statement).scalar_one_or_none()

    def _upsert_offer(
        self, conn: Connection, shop_vinyl_id: str, listing: ListingItem, now: datetime
    ) -> str:
        table = self._tables["offers"]
        price = None if listing.price is None else Decimal(str(listing.price))
        mutable = {
            "shop_vinyl_id": shop_vinyl_id,
            "stock_status": listing.stock_status,
            "condition": listing.condition,
            "current_price": price,
            "current_currency": listing.currency,
            "scraped_at": now,
            "updated_at": now,
        }
        statement = (
            pg_insert(table)
            .values(
                id=uuid4().hex,
                source=listing.source,
                external_id=listing.external_id,
                **mutable,
            )
            .on_conflict_do_update(index_elements=["source", "external_id"], set_=mutable)
            .returning(table.c.id)
        )
        return str(conn.execute(statement).scalar_one())

    def _maybe_insert_price(
        self,
        conn: Connection,
        offer_id: str,
        listing: ListingItem,
        prior_price: Decimal | None,
        now: datetime,
    ) -> None:
        if listing.price is None or listing.currency is None:
            return
        price = Decimal(str(listing.price))
        # Append a history row only when the price actually changed (or this is the first time).
        if prior_price is not None and prior_price == price:
            return
        statement = pg_insert(self._tables["prices"]).values(
            id=uuid4().hex,
            offer_id=offer_id,
            amount=price,
            currency=listing.currency,
            observed_at=now,
        )
        conn.execute(statement)
