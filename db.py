"""Database layer for the Live chat.

A single ``messages`` table backs the chat. Storage is chosen at runtime:

* In Azure the App Service exposes ``AZURE_POSTGRESQL_CONNECTIONSTRING``; we
  connect to that PostgreSQL database via psycopg.
* For local development the variable is unset, so we fall back to a SQLite file
  (``chat.db``) next to this module. No database server is required locally.

SQLAlchemy Core gives us one DB-agnostic code path for both backends.
"""

from __future__ import annotations

import os
from datetime import datetime, timezone

from sqlalchemy import (
    Column,
    DateTime,
    Integer,
    MetaData,
    String,
    Table,
    create_engine,
    insert,
    select,
)
from sqlalchemy.engine import URL

USERNAME_MAX = 40
BODY_MAX = 1000
DEFAULT_LIMIT = 100


def _engine_url():
    """Build the SQLAlchemy URL from the environment.

    Accepts either a libpq keyword/value string (``host=... dbname=...``) or a
    ``postgres(ql)://`` URI for ``AZURE_POSTGRESQL_CONNECTIONSTRING``. Without
    that variable we use a local SQLite file so dev works out of the box.
    """
    conn = (os.environ.get("AZURE_POSTGRESQL_CONNECTIONSTRING") or "").strip()
    if not conn:
        path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "chat.db")
        return f"sqlite:///{path}"

    if conn.startswith("postgres://") or conn.startswith("postgresql://"):
        # Normalize to the psycopg (v3) driver SQLAlchemy expects.
        tail = conn.split("://", 1)[1]
        return "postgresql+psycopg://" + tail

    params = {}
    for token in conn.split():
        if "=" in token:
            key, value = token.split("=", 1)
            params[key.strip()] = value.strip().strip("'").strip('"')

    query = {}
    if params.get("sslmode"):
        query["sslmode"] = params["sslmode"]

    return URL.create(
        "postgresql+psycopg",
        username=params.get("user"),
        password=params.get("password"),
        host=params.get("host"),
        port=int(params["port"]) if params.get("port") else None,
        database=params.get("dbname"),
        query=query,
    )


_url = _engine_url()
_is_sqlite = str(_url).startswith("sqlite")
engine = create_engine(_url, pool_pre_ping=not _is_sqlite, future=True)

metadata = MetaData()
messages = Table(
    "messages",
    metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("username", String(USERNAME_MAX), nullable=False),
    Column("body", String(BODY_MAX), nullable=False),
    Column("created_at", DateTime, nullable=False),
)


def init_db():
    """Create the messages table if it does not yet exist."""
    metadata.create_all(engine)


def _serialize(row):
    created = row["created_at"]
    if created.tzinfo is None:
        created = created.replace(tzinfo=timezone.utc)
    return {
        "id": row["id"],
        "username": row["username"],
        "body": row["body"],
        "created_at": created.isoformat(),
    }


def get_messages(after_id=0, limit=DEFAULT_LIMIT):
    """Return chat messages in chronological order.

    With ``after_id`` we return only newer messages (for polling). Otherwise we
    return the most recent ``limit`` messages, oldest first.
    """
    with engine.connect() as conn:
        if after_id:
            stmt = (
                select(messages)
                .where(messages.c.id > after_id)
                .order_by(messages.c.id.asc())
                .limit(limit)
            )
            rows = conn.execute(stmt).mappings().all()
        else:
            stmt = select(messages).order_by(messages.c.id.desc()).limit(limit)
            rows = list(reversed(conn.execute(stmt).mappings().all()))
    return [_serialize(r) for r in rows]


def add_message(username, body):
    """Validate and store a chat message; return the serialized row.

    Raises ``ValueError`` if the body is empty after trimming.
    """
    username = (username or "").strip()[:USERNAME_MAX] or "Anonymous"
    body = (body or "").strip()
    if not body:
        raise ValueError("Message body cannot be empty.")
    body = body[:BODY_MAX]
    now = datetime.now(timezone.utc).replace(tzinfo=None)

    with engine.begin() as conn:
        result = conn.execute(
            insert(messages).values(username=username, body=body, created_at=now)
        )
        new_id = result.inserted_primary_key[0]

    return {
        "id": new_id,
        "username": username,
        "body": body,
        "created_at": now.replace(tzinfo=timezone.utc).isoformat(),
    }
