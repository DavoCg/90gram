"""Scraped item schema.

We validate scraped data with a Pydantic model before it reaches the database. Field
names are the snake_case column names Prisma maps in packages/db, so the pipeline can
write them directly. Prisma owns the schema; this is only the in-flight shape.
"""

from __future__ import annotations

from pydantic import BaseModel, Field


class RecordItem(BaseModel):
    """A single vinyl record listing, normalized across sources."""

    source: str = Field(min_length=1)
    external_id: str = Field(min_length=1)
    title: str = Field(min_length=1)
    artist: str = Field(min_length=1)
    year: int | None = None
    cover_art_url: str | None = None
    preview_url: str | None = None
    source_url: str | None = None
    price: float | None = None
    currency: str | None = None
    availability: str | None = None
