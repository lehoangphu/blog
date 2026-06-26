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
    delete,
    func,
    insert,
    select,
)
from sqlalchemy.engine import URL

USERNAME_MAX = 40
BODY_MAX = 1000
DEFAULT_LIMIT = 100

# Leaderboard configuration for the Math challenge games.
SCORE_NAME_MAX = 24
LEADERBOARD_SIZE = 10
GAME_MAX = 20
VALID_GAMES = {"add", "sub", "ten", "skip", "times", "puzzle"}


def _on_app_service():
    """True when running inside Azure App Service.

    App Service reliably sets several of these variables; relying on any one
    of them is fragile, so we treat the presence of *any* as the signal.
    """
    return bool(
        os.environ.get("WEBSITE_INSTANCE_ID")
        or os.environ.get("WEBSITE_SITE_NAME")
        or os.environ.get("APPSETTING_WEBSITE_SITE_NAME")
        or os.environ.get("WEBSITE_HOSTNAME")
    )


# Populated by ``_sqlite_path`` so a diagnostic endpoint can report exactly
# which file backs the database and whether it lives on persistent storage.
SQLITE_INFO = {"path": None, "persistent": False, "reason": None}


def _sqlite_path():
    """Return the on-disk path for the local SQLite database.

    On Azure App Service the deployed code lives under ``wwwroot``, which is
    *replaced* on every deployment -- so a SQLite file kept next to this module
    would be wiped each time we ship. App Service mounts ``/home`` as persistent
    storage (Azure Files) that survives deployments and restarts, so we keep the
    database under ``/home/data`` there instead. Locally we use the module
    directory so dev works with no setup.
    """
    module_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "chat.db")

    if _on_app_service():
        # Azure App Service Linux mounts persistent storage (Azure Files) at the
        # literal path ``/home``. Do NOT use the ``HOME`` environment variable --
        # on App Service it points at ``/root``, which is on the container's
        # ephemeral layer and is wiped on every deployment/restart.
        data_dir = "/home/data"
        try:
            os.makedirs(data_dir, exist_ok=True)
            # Confirm the directory is actually writable before committing to it.
            probe = os.path.join(data_dir, ".write_test")
            with open(probe, "w") as fh:
                fh.write("ok")
            os.remove(probe)
            SQLITE_INFO.update(
                path=os.path.join(data_dir, "chat.db"),
                persistent=True,
                reason="app-service:/home/data",
            )
            return SQLITE_INFO["path"]
        except OSError as exc:
            SQLITE_INFO.update(
                path=module_path,
                persistent=False,
                reason="app-service-but-home-unwritable:%s" % exc,
            )
            return module_path

    SQLITE_INFO.update(path=module_path, persistent=False, reason="local-dev")
    return module_path


def _engine_url():
    """Build the SQLAlchemy URL from the environment.

    Accepts either a libpq keyword/value string (``host=... dbname=...``) or a
    ``postgres(ql)://`` URI for ``AZURE_POSTGRESQL_CONNECTIONSTRING``. Without
    that variable we use a local SQLite file so dev works out of the box.
    """
    conn = (os.environ.get("AZURE_POSTGRESQL_CONNECTIONSTRING") or "").strip()
    if not conn:
        return f"sqlite:///{_sqlite_path()}"

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

# Per-game high scores for the Math challenge mode. One row per submitted run;
# the leaderboard is the top ``LEADERBOARD_SIZE`` rows for a game.
scores = Table(
    "scores",
    metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("game", String(GAME_MAX), nullable=False, index=True),
    Column("name", String(SCORE_NAME_MAX), nullable=False),
    Column("score", Integer, nullable=False),
    Column("created_at", DateTime, nullable=False),
)


def init_db():
    """Create the database tables if they do not yet exist."""
    metadata.create_all(engine)


def purge_test_data():
    """Remove rows created by the deployment persistence smoke test.

    One-time cleanup of the ``persist-test`` marker message used to verify that
    the database survives deployments. Idempotent and safe to run on every boot.
    """
    with engine.begin() as conn:
        conn.execute(delete(messages).where(messages.c.username == "persist-test"))


def db_info():
    """Return a non-sensitive summary of the active database backend.

    Used by a diagnostic endpoint to confirm, in production, whether data is
    stored on persistent storage. Never includes credentials.
    """
    info = {
        "backend": "sqlite" if _is_sqlite else "postgresql",
        "on_app_service": _on_app_service(),
    }
    if _is_sqlite:
        path = SQLITE_INFO.get("path")
        info["sqlite_path"] = path
        info["persistent"] = SQLITE_INFO.get("persistent", False)
        info["reason"] = SQLITE_INFO.get("reason")
        info["file_exists"] = bool(path and os.path.exists(path))
        try:
            info["file_size"] = (
                os.path.getsize(path) if path and os.path.exists(path) else 0
            )
        except OSError:
            info["file_size"] = None
    else:
        # Postgres is inherently persistent and external to the app file system.
        info["persistent"] = True
    return info


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


# ---------- Math challenge leaderboards ----------

def _normalize_game(game):
    game = (game or "").strip().lower()
    if game not in VALID_GAMES:
        raise ValueError("Unknown game.")
    return game


def _serialize_score(row, rank):
    created = row["created_at"]
    if created.tzinfo is None:
        created = created.replace(tzinfo=timezone.utc)
    return {
        "rank": rank,
        "name": row["name"],
        "score": row["score"],
        "created_at": created.isoformat(),
    }


def get_leaderboard(game, limit=LEADERBOARD_SIZE):
    """Return the top scores for a game, highest first (ties: earliest wins)."""
    game = _normalize_game(game)
    with engine.connect() as conn:
        stmt = (
            select(scores)
            .where(scores.c.game == game)
            .order_by(scores.c.score.desc(), scores.c.created_at.asc())
            .limit(limit)
        )
        rows = conn.execute(stmt).mappings().all()
    return [_serialize_score(r, i + 1) for i, r in enumerate(rows)]


def qualifies(game, score):
    """True if ``score`` would land in the top ``LEADERBOARD_SIZE`` for a game."""
    game = _normalize_game(game)
    if score is None or score <= 0:
        return False
    with engine.connect() as conn:
        count = conn.execute(
            select(func.count())
            .select_from(scores)
            .where(scores.c.game == game)
        ).scalar_one()
        if count < LEADERBOARD_SIZE:
            return True
        lowest = conn.execute(
            select(func.min(scores.c.score)).where(
                scores.c.game == game,
                scores.c.score.in_(
                    select(scores.c.score)
                    .where(scores.c.game == game)
                    .order_by(scores.c.score.desc())
                    .limit(LEADERBOARD_SIZE)
                ),
            )
        ).scalar_one()
    return lowest is None or score > lowest


def add_score(game, name, score):
    """Validate and store a challenge score; return the updated leaderboard.

    Returns ``{"leaderboard": [...], "rank": int|None}`` where ``rank`` is the
    submitted run's position within the top ``LEADERBOARD_SIZE`` (or ``None`` if
    it did not make the board).
    """
    game = _normalize_game(game)
    try:
        score = int(score)
    except (TypeError, ValueError):
        raise ValueError("Score must be a number.")
    if score < 0:
        raise ValueError("Score must be zero or more.")
    if score > 100000:
        raise ValueError("Score is out of range.")

    name = (name or "").strip()[:SCORE_NAME_MAX] or "Anonymous"
    now = datetime.now(timezone.utc).replace(tzinfo=None)

    with engine.begin() as conn:
        result = conn.execute(
            insert(scores).values(game=game, name=name, score=score, created_at=now)
        )
        new_id = result.inserted_primary_key[0]

    board = get_leaderboard(game)
    rank = None
    for entry in board:
        if entry["score"] == score and entry["name"] == name:
            # The matching entry with the latest timestamp is this submission.
            rank = entry["rank"]
            break

    return {"leaderboard": board, "rank": rank, "id": new_id}
