"""SQLAlchemy models for Cropido — Hostinger MySQL production schema.

Design notes:
- All tables have created_at, updated_at, deleted_at (soft-delete)
- Foreign keys with ON DELETE guardrails
- Indexed columns for common queries
- utf8mb4 charset for emoji + Hindi/Bengali support
- Audit logs table records mutations
"""
from datetime import datetime, timezone
from sqlalchemy import (
    String, Integer, Float, Boolean, Text, DateTime, ForeignKey, JSON,
    Index, UniqueConstraint, BigInteger,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from typing import Optional, List
from database import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)
    deleted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True, index=True)


# ---------- USERS / ROLES / PROFILES ----------
class Role(Base, TimestampMixin):
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    code: Mapped[str] = mapped_column(String(32), unique=True, nullable=False)
    label: Mapped[str] = mapped_column(String(64), nullable=False)


class User(Base, TimestampMixin):
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_uid: Mapped[str] = mapped_column(String(48), unique=True, nullable=False, index=True)
    email: Mapped[str] = mapped_column(String(191), unique=True, nullable=False, index=True)
    password_hash: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    phone: Mapped[Optional[str]] = mapped_column(String(24), nullable=True, index=True)
    role_code: Mapped[str] = mapped_column(String(32), default="farmer", nullable=False, index=True)
    language: Mapped[str] = mapped_column(String(8), default="en", nullable=False)
    verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    kyc_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    picture: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    subscription: Mapped[str] = mapped_column(String(32), default="free", nullable=False, index=True)
    subscribed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    profile: Mapped[Optional["Profile"]] = relationship("Profile", back_populates="user", uselist=False, cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_users_role_verified", "role_code", "verified"),
    )


class Profile(Base, TimestampMixin):
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    bio: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    farm_size_acres: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    irrigation_type: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    crops_grown_json: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    location_city: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    location_state: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    latitude: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    longitude: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    user: Mapped["User"] = relationship("User", back_populates="profile")


# ---------- CATEGORIES / PRODUCTS ----------
class Category(Base, TimestampMixin):
    __tablename__ = "categories"
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    code: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    label: Mapped[str] = mapped_column(String(128), nullable=False)
    kind: Mapped[str] = mapped_column(String(32), default="product", nullable=False, index=True)  # product/crop/equipment/service/business


class Product(Base, TimestampMixin):
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    product_uid: Mapped[str] = mapped_column(String(48), unique=True, nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    category_code: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    price: Mapped[float] = mapped_column(Float, nullable=False)
    unit: Mapped[str] = mapped_column(String(64), default="kg", nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    image: Mapped[Optional[str]] = mapped_column(String(1024), nullable=True)
    stock: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    rating: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    reviews_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    seller_id: Mapped[Optional[int]] = mapped_column(BigInteger, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    __table_args__ = (
        Index("ix_products_category_price", "category_code", "price"),
    )


# ---------- CROP LISTINGS ----------
class CropListing(Base, TimestampMixin):
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    listing_uid: Mapped[str] = mapped_column(String(48), unique=True, nullable=False, index=True)
    crop: Mapped[str] = mapped_column(String(128), nullable=False)
    category_code: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    quantity: Mapped[float] = mapped_column(Float, nullable=False)
    unit: Mapped[str] = mapped_column(String(32), default="quintal", nullable=False)
    expected_price: Mapped[float] = mapped_column(Float, nullable=False)
    location: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    negotiable: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    image: Mapped[Optional[str]] = mapped_column(String(1024), nullable=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(24), default="active", nullable=False, index=True)
    seller_id: Mapped[Optional[int]] = mapped_column(BigInteger, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)


# ---------- EQUIPMENT ----------
class Equipment(Base, TimestampMixin):
    __tablename__ = "equipment"
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    equipment_uid: Mapped[str] = mapped_column(String(48), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    category_code: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    daily_price: Mapped[float] = mapped_column(Float, nullable=False)
    location: Mapped[str] = mapped_column(String(255), nullable=False)
    image: Mapped[Optional[str]] = mapped_column(String(1024), nullable=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    rating: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    owner_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)


class EquipmentRental(Base, TimestampMixin):
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    booking_uid: Mapped[str] = mapped_column(String(48), unique=True, nullable=False, index=True)
    equipment_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("equipment.id", ondelete="RESTRICT"), nullable=False, index=True)
    user_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    start_date: Mapped[str] = mapped_column(String(16), nullable=False)
    end_date: Mapped[str] = mapped_column(String(16), nullable=False)
    daily_price: Mapped[float] = mapped_column(Float, nullable=False)
    status: Mapped[str] = mapped_column(String(24), default="confirmed", nullable=False, index=True)


# ---------- SERVICES / BOOKINGS ----------
class Service(Base, TimestampMixin):
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    service_uid: Mapped[str] = mapped_column(String(48), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    category_code: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    price: Mapped[float] = mapped_column(Float, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    provider: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    rating: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    icon: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)


class Booking(Base, TimestampMixin):
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    booking_uid: Mapped[str] = mapped_column(String(48), unique=True, nullable=False, index=True)
    service_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("services.id", ondelete="RESTRICT"), nullable=False, index=True)
    user_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    date: Mapped[str] = mapped_column(String(16), nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    price: Mapped[float] = mapped_column(Float, nullable=False)
    status: Mapped[str] = mapped_column(String(24), default="confirmed", nullable=False, index=True)


# ---------- ORDERS / CART / PAYMENTS ----------
class Order(Base, TimestampMixin):
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    order_uid: Mapped[str] = mapped_column(String(48), unique=True, nullable=False, index=True)
    user_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    items_json: Mapped[dict] = mapped_column(JSON, nullable=False)
    address: Mapped[str] = mapped_column(Text, nullable=False)
    payment_method: Mapped[str] = mapped_column(String(32), default="cod", nullable=False)
    payment_status: Mapped[str] = mapped_column(String(24), default="pending", nullable=False, index=True)
    total: Mapped[float] = mapped_column(Float, nullable=False)
    status: Mapped[str] = mapped_column(String(24), default="confirmed", nullable=False, index=True)
    tracking_status: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)


class CartItem(Base, TimestampMixin):
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("products.id", ondelete="CASCADE"), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, default=1, nullable=False)

    __table_args__ = (UniqueConstraint("user_id", "product_id", name="uq_cart_user_product"),)


class Payment(Base, TimestampMixin):
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    payment_uid: Mapped[str] = mapped_column(String(48), unique=True, nullable=False, index=True)
    user_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    plan_code: Mapped[Optional[str]] = mapped_column(String(32), nullable=True, index=True)
    amount: Mapped[float] = mapped_column(Float, nullable=False)
    currency: Mapped[str] = mapped_column(String(8), default="INR", nullable=False)
    gateway: Mapped[str] = mapped_column(String(24), default="razorpay", nullable=False, index=True)
    razorpay_order_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True, index=True)
    razorpay_payment_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True, unique=True)
    stripe_session_id: Mapped[Optional[str]] = mapped_column(String(128), nullable=True, index=True)
    status: Mapped[str] = mapped_column(String(24), default="pending", nullable=False, index=True)


class Subscription(Base, TimestampMixin):
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    plan_code: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(24), default="active", nullable=False, index=True)
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)
    ends_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)


# ---------- COMMUNITY ----------
class CommunityPost(Base, TimestampMixin):
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    post_uid: Mapped[str] = mapped_column(String(48), unique=True, nullable=False, index=True)
    user_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    image: Mapped[Optional[str]] = mapped_column(String(1024), nullable=True)
    tags_json: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    likes_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False, index=True)
    comments_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    shares_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_expert: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, index=True)


class Comment(Base, TimestampMixin):
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    comment_uid: Mapped[str] = mapped_column(String(48), unique=True, nullable=False, index=True)
    post_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("community_posts.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    text: Mapped[str] = mapped_column(Text, nullable=False)


class Like(Base, TimestampMixin):
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    post_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("community_posts.id", ondelete="CASCADE"), nullable=False)
    user_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    __table_args__ = (UniqueConstraint("post_id", "user_id", name="uq_like_post_user"),)


# ---------- MESSAGING ----------
class MessageThread(Base, TimestampMixin):
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    thread_uid: Mapped[str] = mapped_column(String(48), unique=True, nullable=False, index=True)
    user_a_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    user_b_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    last_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    __table_args__ = (UniqueConstraint("user_a_id", "user_b_id", name="uq_thread_users"),)


class Message(Base, TimestampMixin):
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    message_uid: Mapped[str] = mapped_column(String(48), unique=True, nullable=False, index=True)
    thread_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("message_threads.id", ondelete="CASCADE"), nullable=False, index=True)
    from_user_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    to_user_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    read: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, index=True)


# ---------- NOTIFICATIONS ----------
class Notification(Base, TimestampMixin):
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    notif_uid: Mapped[str] = mapped_column(String(48), unique=True, nullable=False, index=True)
    user_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    body: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    type: Mapped[str] = mapped_column(String(32), default="system", nullable=False, index=True)
    icon: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    read: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, index=True)


# ---------- KNOWLEDGE CENTER ----------
class KnowledgeArticle(Base, TimestampMixin):
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    article_uid: Mapped[str] = mapped_column(String(48), unique=True, nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    category_code: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    author: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    image: Mapped[Optional[str]] = mapped_column(String(1024), nullable=True)
    excerpt: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    body: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    read_time: Mapped[Optional[str]] = mapped_column(String(24), nullable=True)
    views: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_video: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)


# ---------- AI ASSISTANT ----------
class AiSession(Base, TimestampMixin):
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    session_uid: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    user_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    language: Mapped[str] = mapped_column(String(8), default="en", nullable=False)
    title: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)


class AiMessage(Base, TimestampMixin):
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    session_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("ai_sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    role: Mapped[str] = mapped_column(String(16), nullable=False)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    has_image: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)


# ---------- BUSINESS DIRECTORY ----------
class Business(Base, TimestampMixin):
    __tablename__ = "businesses"
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    business_uid: Mapped[str] = mapped_column(String(48), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    category_code: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    location: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    phone: Mapped[Optional[str]] = mapped_column(String(24), nullable=True)
    email: Mapped[Optional[str]] = mapped_column(String(191), nullable=True)
    website: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    logo: Mapped[Optional[str]] = mapped_column(String(1024), nullable=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    rating: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)


# ---------- ANALYTICS ----------
class AnalyticsEvent(Base, TimestampMixin):
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    event_uid: Mapped[str] = mapped_column(String(48), unique=True, nullable=False, index=True)
    user_id: Mapped[Optional[int]] = mapped_column(BigInteger, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    event_type: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    payload_json: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)


# ---------- AUDIT LOGS ----------
class AuditLog(Base, TimestampMixin):
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    actor_user_id: Mapped[Optional[int]] = mapped_column(BigInteger, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    action: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    entity_type: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    entity_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True, index=True)
    ip: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    user_agent: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    diff_json: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)


class SyncStatus(Base, TimestampMixin):
    __tablename__ = "sync_status"
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    entity_type: Mapped[str] = mapped_column(String(48), nullable=False, index=True)
    entity_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    sync_status: Mapped[str] = mapped_column(String(24), default="pending", nullable=False, index=True)  # pending/success/failed
    synced_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    retry_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    __table_args__ = (
        UniqueConstraint("entity_type", "entity_id", name="uq_sync_entity"),
    )


ALL_MODELS: List[type[Base]] = [
    Role, User, Profile, Category, Product, CropListing,
    Equipment, EquipmentRental, Service, Booking,
    Order, CartItem, Payment, Subscription,
    CommunityPost, Comment, Like,
    MessageThread, Message, Notification,
    KnowledgeArticle, AiSession, AiMessage,
    Business, AnalyticsEvent, AuditLog, SyncStatus,
]
