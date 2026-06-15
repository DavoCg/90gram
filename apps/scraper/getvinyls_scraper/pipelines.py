"""Item pipeline that writes scraped listings straight into Postgres.

Design (see the scraper skill):
- Reflect the live tables with SQLAlchemy Core (autoload_with). We never hand-maintain column
  names and never run DDL. Prisma owns the schema.
- One ``ListingItem`` fans out across several tables (shop, vinyl, genres, shop_vinyl, tracks,
  offer, prices), written in a single transaction that wires the foreign keys from RETURNING ids.
  Tracks belong to the shop_vinyl (so it is written first); every step upserts idempotently, so
  re-running a crawl updates rows instead of duplicating them.
- ``Vinyl`` is the canonical, shop-agnostic release. We "match-or-create" it on a rule, not a single
  unique key: a listing matches an existing Vinyl when the catalog matches AND (artist OR label)
  matches (see ``_match_key`` / ``_artist_key`` / ``_label_key`` and ``_upsert_vinyl``). A bare
  catalog number is only unique within a label, so catalog-only merged unrelated releases; the
  artist/label corroboration splits them while still tolerating a shop that spells one of the two
  differently. Match-or-create is a find-then-insert, so a per-catalog advisory lock serializes it
  to stay race-safe. A listing with no catalog number cannot be matched and is dropped in
  ``process_item``. ``ShopVinyl`` is the per-shop record that links a shop to that ``Vinyl``;
  ``Offer`` is its price/stock. Tracks/genres hang off the Vinyl. See docs/match-key-design.md.
- Idempotency keys: ``shops.slug``, the Vinyl match rule above, ``tracks (vinyl_id, position)``,
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

from scrapy.exceptions import DropItem
from sqlalchemy import (
    Connection,
    Engine,
    MetaData,
    Table,
    create_engine,
    func,
    insert,
    or_,
    select,
    update,
)
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.sql.elements import ColumnElement

from .genres import sanitize_genres, slugify
from .items import ListingItem, TrackItem

_NON_ALNUM_RE = re.compile(r"[^A-Z0-9]+")


def _normalize_key_part(value: str) -> str:
    """Upper-case, strip accents, and drop every non-alphanumeric character (spaces, dots, dashes).

    The catalog number is the match key, and shops format it inconsistently ("fro 041", "FRO-041",
    "FRO041"), so upper-casing and dropping separators collapses those to one key (`FRO041`)."""
    decomposed = unicodedata.normalize("NFKD", value)
    stripped = "".join(c for c in decomposed if not unicodedata.combining(c))
    return _NON_ALNUM_RE.sub("", stripped.upper())


def _match_key(catalog_number: str | None) -> str | None:
    """The catalog key: the normalized catalog number. It is the required half of a Vinyl's
    identity (a match needs the catalog AND an artist-or-label corroborator). Returns None when
    there is no usable catalog number: such a listing cannot be matched and is dropped (see
    ``process_item``)."""
    return _normalize_key_part(catalog_number or "") or None


def _artist_key(artist: str | None) -> str | None:
    """Normalized artist, one of the two corroborators that disambiguate a shared catalog number."""
    return _normalize_key_part(artist or "") or None


# Label "type" words and legal suffixes that vary across shops; dropped so "Dabeull Records",
# "Dabeull" and the like collapse to one key.
_LABEL_NOISE_RE = re.compile(
    r"\b(?:RECORDS?|RECORDINGS?|RECORDING|MUSIC|MUSIK|RECS?|LABEL|"
    r"PRODUCTIONS?|ENTERTAINMENT|ENT|LTD|LIMITED|INC|GMBH)\b"
)


def _label_key(label: str | None) -> str | None:
    """Normalized label, the other corroborator. Type words ("Records", "Recordings", "Music", ...)
    and any sub-label after the first comma are stripped first, so "Dabeull Records", "Dabeull" and
    "Dabeull Records,N/A" all collapse to one key. Returns None when there is no usable label."""
    if not label:
        return None
    decomposed = unicodedata.normalize("NFKD", label)
    upper = "".join(c for c in decomposed if not unicodedata.combining(c)).upper()
    upper = upper.split(",", 1)[0]
    return _NON_ALNUM_RE.sub("", _LABEL_NOISE_RE.sub(" ", upper)) or None


def _to_sqlalchemy_url(database_url: str) -> str:
    """Turn a Prisma-style postgresql:// URL into a SQLAlchemy + psycopg URL.

    Drops Prisma-only query params (e.g. ?schema=public) that psycopg does not understand.
    """
    parts = urlsplit(database_url)
    return urlunsplit(("postgresql+psycopg", parts.netloc, parts.path, "", ""))


class GenreSanitizerPipeline:
    """Canonicalize a listing's genres before it reaches the database.

    Runs ahead of ``PostgresPipeline`` (a lower ``ITEM_PIPELINES`` order) and rewrites
    ``item.genres`` in place, folding spelling and format variants onto one canonical name
    ("Avantgarde"/"Avante-garde" -> "Avant-garde", "deephouse" -> "Deep House") so the ``genres``
    table and its ``vinyl_genres`` joins stay clean. All rules live in ``genres.canonical_genre``;
    this stage just applies them. Items with no genres pass through untouched."""

    def process_item(self, item: Any) -> Any:
        if isinstance(item, ListingItem):
            item.genres = sanitize_genres(item.genres)
        return item


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
        # The catalog number is the required half of a Vinyl's identity. A listing with none cannot
        # be matched (artist/label corroborators only disambiguate within a catalog), so drop it.
        catalog_key = _match_key(listing.catalog_number)
        if catalog_key is None:
            raise DropItem(f"no catalog number: {listing.source}/{listing.external_id}")
        if self._engine is None:
            return item
        with self._engine.begin() as conn:
            self._write_listing(conn, listing, catalog_key)
        return item

    # --- one transaction per listing ---------------------------------------------------------

    def _write_listing(self, conn: Connection, listing: ListingItem, catalog_key: str) -> None:
        now = datetime.now(UTC)
        shop_id = self._upsert_shop(conn, listing, now)
        # Match-or-create the canonical Vinyl, then attach its genres.
        vinyl_id = self._upsert_vinyl(conn, listing, catalog_key, now)
        self._upsert_genres(conn, vinyl_id, listing.genres, now)
        # The per-shop record linking this shop to that Vinyl. Tracks belong to it (each shop keeps
        # its own tracklist), then we adopt the single best shop's tracklist as the reference.
        shop_vinyl_id = self._upsert_shop_vinyl(conn, vinyl_id, shop_id, listing, now)
        self._upsert_tracks(conn, shop_vinyl_id, listing.tracks, now)
        self._promote_reference_tracks(conn, vinyl_id, now)
        # The offer + price history.
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

    def _upsert_vinyl(
        self, conn: Connection, listing: ListingItem, catalog_key: str, now: datetime
    ) -> str:
        """Match-or-create on the rule: catalog matches AND (artist OR label) matches.

        This is a find-then-insert, not an atomic upsert, so two concurrent crawls could each insert
        a Vinyl for the same new release. A transaction-scoped advisory lock keyed on the catalog
        serializes all listings that share a catalog number (the only ones that can collide); the
        lock releases at COMMIT. The match keys are written once on create and never overwritten on
        update, so a later listing's differently-spelled artist/label cannot shift an existing
        Vinyl's keys and break matching for the next shop."""
        table = self._tables["vinyls"]
        artist_key = _artist_key(listing.artist)
        label_key = _label_key(listing.label)
        conn.execute(select(func.pg_advisory_xact_lock(func.hashtext(catalog_key))))

        display = {
            "title": listing.title,
            "artist": listing.artist,
            "year": listing.year,
            "cover_art_url": listing.cover_art_url,
            "label": listing.label,
            "catalog_number": listing.catalog_number,
            "format": listing.format,
            "updated_at": now,
        }
        corroborators: list[ColumnElement[bool]] = []
        if artist_key is not None:
            corroborators.append(table.c.artist_key == artist_key)
        if label_key is not None:
            corroborators.append(table.c.label_key == label_key)
        if corroborators:
            match = (
                select(table.c.id)
                .where(table.c.match_key == catalog_key, or_(*corroborators))
                # Deterministic pick of the oldest matching Vinyl when more than one matches.
                .order_by(table.c.created_at.asc(), table.c.id.asc())
                .limit(1)
            )
            existing = conn.execute(match).scalar_one_or_none()
            if existing is not None:
                conn.execute(update(table).where(table.c.id == existing).values(**display))
                return str(existing)

        new_id = uuid4().hex
        conn.execute(
            insert(table).values(
                id=new_id,
                match_key=catalog_key,
                artist_key=artist_key,
                label_key=label_key,
                **display,
            )
        )
        return new_id

    def _upsert_tracks(
        self, conn: Connection, shop_vinyl_id: str, tracks: list[TrackItem], now: datetime
    ) -> None:
        # Tracks belong to the shop listing (this shop's own tracklist + preview URLs). `vinyl_id`
        # (the reference marker) is left untouched here; _promote_reference_tracks sets it.
        if not tracks:
            return
        table = self._tables["tracks"]
        rows = [
            {
                "id": uuid4().hex,
                "shop_vinyl_id": shop_vinyl_id,
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
            index_elements=["shop_vinyl_id", "position"],
            set_={
                "title": statement.excluded.title,
                "duration_seconds": statement.excluded.duration_seconds,
                "preview_url": statement.excluded.preview_url,
                "updated_at": statement.excluded.updated_at,
            },
        )
        conn.execute(statement)

    def _promote_reference_tracks(self, conn: Connection, vinyl_id: str, now: datetime) -> None:
        """Re-pick the reference tracklist for a vinyl: the whole tracklist of its single best shop.

        Shops number the same physical tracks differently (one lists a 7" as 01/02, another as
        A1/B1), so merging across shops per position duplicates tracks under variant labels. Instead
        we adopt one shop's tracklist wholesale, which is internally consistent and keeps positions
        unique. "Best" is the shop_vinyl with the most previews, then the most tracks, then a stable
        tiebreak (shop slug, id). Its tracks get ``vinyl_id`` set; every other track's is cleared,
        so ``Vinyl.tracks`` reads back one clean tracklist."""
        tracks = self._tables["tracks"]
        shop_vinyls = self._tables["shop_vinyls"]
        # Demote the vinyl's current references; we recompute them from scratch below. Clearing
        # first keeps (vinyl_id, position) unique while we re-promote the winner's rows.
        conn.execute(
            update(tracks)
            .where(tracks.c.vinyl_id == vinyl_id)
            .values(vinyl_id=None, updated_at=now)
        )
        winner = (
            select(tracks.c.shop_vinyl_id)
            .select_from(tracks.join(shop_vinyls, shop_vinyls.c.id == tracks.c.shop_vinyl_id))
            .where(shop_vinyls.c.vinyl_id == vinyl_id)
            .group_by(tracks.c.shop_vinyl_id, shop_vinyls.c.source)
            .order_by(
                func.count(tracks.c.preview_url).desc(),  # COUNT ignores NULLs: most previews
                func.count(tracks.c.id).desc(),  # then the most complete tracklist
                shop_vinyls.c.source.asc(),  # stable tiebreak
                tracks.c.shop_vinyl_id.asc(),
            )
            .limit(1)
        )
        winner_shop_vinyl_id = conn.execute(winner).scalar_one_or_none()
        if winner_shop_vinyl_id is not None:
            conn.execute(
                update(tracks)
                .where(tracks.c.shop_vinyl_id == winner_shop_vinyl_id)
                .values(vinyl_id=vinyl_id, updated_at=now)
            )

    def _upsert_genres(
        self, conn: Connection, vinyl_id: str, genres: list[str], now: datetime
    ) -> None:
        genre_table = self._tables["genres"]
        join_table = self._tables["vinyl_genres"]
        for name in genres:
            clean = name.strip()
            if not clean:
                continue
            slug = slugify(clean)
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
            "cover_art_url": listing.cover_art_url,
            # Keep what the shop reported, for transparency and re-matching against match_key.
            "raw_title": listing.title,
            "raw_artist": listing.artist,
            "raw_catalog_number": listing.catalog_number,
            "raw_label": listing.label,
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
