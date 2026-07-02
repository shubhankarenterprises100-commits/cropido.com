"""SQLAlchemy database configuration for MySQL (Hostinger).

Uses env vars for credentials. When DB_HOST is not set to a real value
(defaults to placeholder), the app remains on MongoDB — no crash.
Enable MySQL by setting USE_MYSQL=true and real DB_HOST in production.
"""
import os
import logging
from urllib.parse import quote_plus
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase, declared_attr
from sqlalchemy import event
from typing import AsyncGenerator

logger = logging.getLogger("cropido.db")

DB_HOST = os.environ.get("DB_HOST", "your_hostinger_mysql_host")
DB_PORT = os.environ.get("DB_PORT", "3306")
DB_NAME = os.environ.get("DB_NAME_MYSQL", os.environ.get("DB_NAME", "u748887577_cropido_app"))
DB_USER = os.environ.get("DB_USER", "u748887577_cropido_user")
DB_PASSWORD = os.environ.get("DB_PASSWORD", "")

USE_MYSQL = os.environ.get("USE_MYSQL", "false").lower() == "true"

# Guard: don't connect when host is a placeholder
def _is_placeholder_host(h: str) -> bool:
    return (not h) or h.startswith("your_") or h in {"placeholder", "example", "localhost_placeholder"}


def build_async_url() -> str:
    pw = quote_plus(DB_PASSWORD)
    return f"mysql+aiomysql://{DB_USER}:{pw}@{DB_HOST}:{DB_PORT}/{DB_NAME}?charset=utf8mb4"


def build_sync_url() -> str:
    """Used by Alembic (synchronous engine)."""
    pw = quote_plus(DB_PASSWORD)
    return f"mysql+pymysql://{DB_USER}:{pw}@{DB_HOST}:{DB_PORT}/{DB_NAME}?charset=utf8mb4"


class Base(DeclarativeBase):
    """SQLAlchemy 2.x declarative base."""

    @declared_attr.directive
    def __tablename__(cls) -> str:
        # Convert CamelCase -> snake_case (e.g., CropListing -> crop_listings)
        import re
        name = re.sub(r"(?<!^)(?=[A-Z])", "_", cls.__name__).lower()
        if not name.endswith("s"):
            name += "s"
        return name


engine = None
SessionLocal = None


def init_engine():
    """Initialize async engine only if MySQL is enabled and host is real."""
    global engine, SessionLocal
    if not USE_MYSQL:
        logger.info("MySQL disabled (USE_MYSQL=false); staying on MongoDB.")
        return None
    if _is_placeholder_host(DB_HOST):
        logger.warning(f"DB_HOST is placeholder ('{DB_HOST}'). MySQL not initialized.")
        return None
    try:
        engine = create_async_engine(
            build_async_url(),
            pool_pre_ping=True,
            pool_recycle=1800,
            pool_size=10,
            max_overflow=20,
            echo=False,
        )
        SessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
        logger.info(f"MySQL engine initialized for {DB_HOST}/{DB_NAME}")
        return engine
    except Exception as e:
        logger.error(f"MySQL engine init failed: {e}")
        return None


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    if SessionLocal is None:
        raise RuntimeError("MySQL not initialized. Set USE_MYSQL=true and real DB_HOST.")
    async with SessionLocal() as session:
        yield session


def is_mysql_enabled() -> bool:
    return USE_MYSQL and engine is not None
