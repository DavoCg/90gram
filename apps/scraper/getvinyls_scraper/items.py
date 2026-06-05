"""Scraped item schema.

We validate scraped data with Pydantic before it reaches the database. A single ``ListingItem``
carries every entity the pipeline writes for one shop listing: the shop, the canonical vinyl
(plus its tracks and genres), and the offer at that shop. Field names are the snake_case column
names Prisma maps in packages/db, so the pipeline can write them directly. Prisma owns the schema;
this is only the in-flight shape.
"""

from __future__ import annotations

from pydantic import BaseModel, Field


class TrackItem(BaseModel):
    """A single track on a vinyl."""

    position: str = Field(min_length=1)
    title: str = Field(min_length=1)
    duration_seconds: int | None = None
    preview_url: str | None = None


class ListingItem(BaseModel):
    """One vinyl listed at one shop, normalized across sources."""

    # Shop (the reseller / marketplace).
    shop_slug: str = Field(min_length=1)
    shop_name: str = Field(min_length=1)
    shop_country: str | None = None

    # Canonical vinyl release (the catalog identity, deduped on (catalog_source, catalog_id)).
    catalog_source: str = Field(min_length=1)
    catalog_id: str = Field(min_length=1)
    title: str = Field(min_length=1)
    artist: str = Field(min_length=1)
    year: int | None = None
    cover_art_url: str | None = None
    label: str | None = None
    catalog_number: str | None = None
    format: str | None = None
    genres: list[str] = []
    tracks: list[TrackItem] = []

    # Offer (this shop's listing, deduped on (source, external_id)).
    source: str = Field(min_length=1)
    external_id: str = Field(min_length=1)
    source_url: str | None = None
    stock_status: str = "unknown"
    condition: str | None = None
    price: float | None = None
    currency: str | None = None
