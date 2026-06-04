"""Item pipeline that writes scraped records straight into Postgres.

Design (see the scraper skill):
- Reflect the live `records` table with SQLAlchemy Core (autoload_with). We never hand
  maintain column names and never run DDL. Prisma owns the schema.
- Upsert on (source, external_id) so re-running a crawl updates rows instead of duplicating.
- Batch writes (flush every N items) instead of one round-trip per record.

`id` and `updated_at` have no database default (Prisma sets them in app code), so the
pipeline supplies them. On conflict we update everything except the natural key, id, and
created_at.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any
from urllib.parse import urlsplit, urlunsplit
from uuid import uuid4

from sqlalchemy import Engine, MetaData, Table, create_engine
from sqlalchemy.dialects.postgresql import insert as pg_insert

from .items import RecordItem

_IMMUTABLE_ON_CONFLICT = {"id", "created_at", "source", "external_id"}


def _to_sqlalchemy_url(database_url: str) -> str:
    """Turn a Prisma-style postgresql:// URL into a SQLAlchemy + psycopg URL.

    Drops Prisma-only query params (e.g. ?schema=public) that psycopg does not understand.
    """
    parts = urlsplit(database_url)
    return urlunsplit(("postgresql+psycopg", parts.netloc, parts.path, "", ""))


class PostgresPipeline:
    def __init__(self, database_url: str, batch_size: int) -> None:
        self._database_url = database_url
        self._batch_size = max(1, batch_size)
        self._engine: Engine | None = None
        self._table: Table | None = None
        self._buffer: list[dict[str, Any]] = []

    @classmethod
    def from_crawler(cls, crawler: Any) -> PostgresPipeline:
        database_url = str(crawler.settings.get("DATABASE_URL", ""))
        if not database_url:
            raise ValueError(
                "DATABASE_URL is not set. The scraper shares it with Prisma; see .env.example."
            )
        batch_size = int(crawler.settings.getint("POSTGRES_BATCH_SIZE", 50))
        return cls(_to_sqlalchemy_url(database_url), batch_size)

    def open_spider(self) -> None:
        engine = create_engine(self._database_url, future=True)
        metadata = MetaData()
        # Reflect the live schema. No hand-maintained columns, no DDL, no drift.
        self._table = Table("records", metadata, autoload_with=engine)
        self._engine = engine

    def process_item(self, item: Any) -> Any:
        record = item if isinstance(item, RecordItem) else RecordItem.model_validate(item)
        self._buffer.append(self._to_row(record))
        if len(self._buffer) >= self._batch_size:
            self._flush()
        return item

    def close_spider(self) -> None:
        self._flush()
        if self._engine is not None:
            self._engine.dispose()

    def _to_row(self, record: RecordItem) -> dict[str, Any]:
        now = datetime.now(UTC)
        row: dict[str, Any] = record.model_dump()
        row["id"] = uuid4().hex
        row["updated_at"] = now
        row["scraped_at"] = now
        return row

    def _flush(self) -> None:
        if not self._buffer or self._engine is None or self._table is None:
            self._buffer.clear()
            return

        table = self._table
        valid_columns = set(table.columns.keys())
        rows = [{k: v for k, v in row.items() if k in valid_columns} for row in self._buffer]

        statement = pg_insert(table).values(rows)
        update_set = {
            column: statement.excluded[column]
            for column in valid_columns
            if column not in _IMMUTABLE_ON_CONFLICT
        }
        upsert = statement.on_conflict_do_update(
            index_elements=["source", "external_id"],
            set_=update_set,
        )

        with self._engine.begin() as connection:
            connection.execute(upsert)

        self._buffer.clear()
