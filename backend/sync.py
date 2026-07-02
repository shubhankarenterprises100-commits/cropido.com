"""Dual-write sync layer: MongoDB → MySQL replication.

Usage in server.py:
    from sync import sync_entity, sync_delete
    await sync_entity('user', doc)   # after Mongo insert/update
    await sync_delete('product', product_uid)  # after Mongo delete
"""
import asyncio
import logging
from datetime import datetime, timezone
from typing import Any, Dict, Optional
from sqlalchemy import select, delete
from sqlalchemy.dialects.mysql import insert as mysql_insert
from database import SessionLocal, is_mysql_enabled
from models import (
    User, Profile, Product, CropListing, Equipment, EquipmentRental,
    Service, Booking, Order, Payment, CommunityPost, Comment,
    Notification, KnowledgeArticle, Business, SyncStatus,
)

logger = logging.getLogger("cropido.sync")
_retry_queue: asyncio.Queue = asyncio.Queue()


def _to_dt(v):
    if not v: return None
    if isinstance(v, datetime): return v
    try:
        s = v.replace("Z", "+00:00") if isinstance(v, str) else v
        return datetime.fromisoformat(s)
    except Exception:
        return None


async def _resolve_user_pk(session, user_uid: Optional[str]) -> Optional[int]:
    if not user_uid: return None
    r = await session.execute(select(User.id).where(User.user_uid == user_uid))
    return r.scalar_one_or_none()


def _map_doc_to_row(entity_type: str, doc: Dict[str, Any], user_pk: Optional[int] = None):
    """Return (Model, uid_field, uid_value, kwargs) for the given entity."""
    d = {k: v for k, v in doc.items() if k != "_id"}
    if entity_type == "user":
        fd = d.get("farm_details") or {}
        return (User, "user_uid", d["user_id"], dict(
            user_uid=d["user_id"], email=d["email"], password_hash=d.get("password_hash"),
            name=d.get("name", "User"), phone=d.get("phone"),
            role_code=d.get("role", "farmer"), language=d.get("language", "en"),
            verified=bool(d.get("verified", False)), kyc_verified=bool(d.get("kyc_verified", False)),
            picture=d.get("picture"), subscription=d.get("subscription", "free"),
            subscribed_at=_to_dt(d.get("subscribed_at")),
            created_at=_to_dt(d.get("created_at")) or datetime.now(timezone.utc),
        ))
    if entity_type == "profile":
        fd = d.get("farm_details") or {}
        return (Profile, "user_id", user_pk, dict(
            user_id=user_pk, bio=d.get("bio"),
            farm_size_acres=fd.get("size_acres"), irrigation_type=fd.get("irrigation"),
            crops_grown_json=d.get("crops_grown") or [],
        ))
    if entity_type == "product":
        return (Product, "product_uid", d["product_id"], dict(
            product_uid=d["product_id"], title=d["title"], category_code=d["category"],
            price=float(d["price"]), unit=d.get("unit", "kg"), description=d.get("description", ""),
            image=d.get("image"), stock=int(d.get("stock", 0)),
            rating=float(d.get("rating", 0)), reviews_count=int(d.get("reviews_count", 0)),
            seller_id=user_pk,
            created_at=_to_dt(d.get("created_at")) or datetime.now(timezone.utc),
        ))
    if entity_type == "crop_listing":
        return (CropListing, "listing_uid", d["listing_id"], dict(
            listing_uid=d["listing_id"], crop=d["crop"], category_code=d["category"],
            quantity=float(d["quantity"]), unit=d.get("unit", "quintal"),
            expected_price=float(d["expected_price"]), location=d["location"],
            negotiable=bool(d.get("negotiable", True)), image=d.get("image"),
            description=d.get("description", ""), status=d.get("status", "active"),
            seller_id=user_pk,
            created_at=_to_dt(d.get("created_at")) or datetime.now(timezone.utc),
        ))
    if entity_type == "order":
        return (Order, "order_uid", d["order_id"], dict(
            order_uid=d["order_id"], user_id=user_pk,
            items_json=d.get("items", []), address=d.get("address", ""),
            payment_method=d.get("payment_method", "cod"),
            payment_status=d.get("payment_status", "pending"),
            total=float(d.get("total", 0)), status=d.get("status", "confirmed"),
            tracking_status=d.get("tracking_status"),
            created_at=_to_dt(d.get("created_at")) or datetime.now(timezone.utc),
        ))
    if entity_type == "community_post":
        return (CommunityPost, "post_uid", d["post_id"], dict(
            post_uid=d["post_id"], user_id=user_pk, content=d["content"],
            image=d.get("image"), tags_json=d.get("tags", []),
            likes_count=int(d.get("likes_count", 0)),
            comments_count=int(d.get("comments_count", 0)),
            shares_count=int(d.get("shares_count", 0)),
            is_expert=bool(d.get("is_expert", False)),
            created_at=_to_dt(d.get("created_at")) or datetime.now(timezone.utc),
        ))
    if entity_type == "notification":
        return (Notification, "notif_uid", d["notif_id"], dict(
            notif_uid=d["notif_id"], user_id=user_pk, title=d["title"],
            body=d.get("body"), type=d.get("type", "system"), icon=d.get("icon"),
            read=bool(d.get("read", False)),
            created_at=_to_dt(d.get("created_at")) or datetime.now(timezone.utc),
        ))
    if entity_type == "payment":
        return (Payment, "payment_uid", d["payment_id"], dict(
            payment_uid=d["payment_id"], user_id=user_pk, plan_code=d.get("plan_id"),
            amount=float(d.get("amount", 0)), currency=d.get("currency", "INR"),
            gateway=d.get("gateway", "razorpay"),
            razorpay_order_id=d.get("razorpay_order_id"),
            razorpay_payment_id=d.get("razorpay_payment_id"),
            stripe_session_id=d.get("session_id"),
            status=d.get("status", "paid"),
            created_at=_to_dt(d.get("created_at")) or datetime.now(timezone.utc),
        ))
    if entity_type == "equipment_rental":
        # d contains booking_id and equipment_id (uid) — resolve pk
        return ("equipment_rental_special", "booking_uid", d["booking_id"], d)
    if entity_type == "service_booking":
        return ("service_booking_special", "booking_uid", d["booking_id"], d)
    return None


async def _record_sync(session, entity_type: str, entity_id: str, ok: bool, err: str = ""):
    status = "success" if ok else "failed"
    stmt = mysql_insert(SyncStatus).values(
        entity_type=entity_type, entity_id=entity_id, sync_status=status,
        synced_at=datetime.now(timezone.utc), error_message=err[:1000] if err else None, retry_count=0,
    )
    stmt = stmt.on_duplicate_key_update(
        sync_status=status,
        synced_at=stmt.inserted.synced_at,
        error_message=stmt.inserted.error_message,
        retry_count=SyncStatus.retry_count + (0 if ok else 1),
    )
    await session.execute(stmt)


async def sync_entity(entity_type: str, doc: Dict[str, Any]) -> bool:
    """Best-effort sync: called after MongoDB write. Failure is logged, not raised."""
    if not is_mysql_enabled():
        return False
    try:
        async with SessionLocal() as session:
            # Resolve user PK if entity has user_id
            user_uid = doc.get("user_id") or doc.get("seller_id")
            user_pk = await _resolve_user_pk(session, user_uid)
            mapped = _map_doc_to_row(entity_type, doc, user_pk)
            if not mapped:
                await _record_sync(session, entity_type, str(doc.get("user_id", "unknown")), False, "no mapping")
                await session.commit()
                return False
            Model, uid_field, uid_value, kwargs = mapped
            if uid_value is None:
                return False
            # Special-case handling
            if Model == "equipment_rental_special":
                d = kwargs
                eq_r = await session.execute(select(Equipment.id).where(Equipment.equipment_uid == d.get("equipment_id")))
                eq_pk = eq_r.scalar_one_or_none()
                if not eq_pk or not user_pk:
                    await _record_sync(session, entity_type, uid_value, False, "missing FK")
                    await session.commit()
                    return False
                stmt = mysql_insert(EquipmentRental).values(
                    booking_uid=d["booking_id"], equipment_id=eq_pk, user_id=user_pk,
                    start_date=d["start_date"], end_date=d["end_date"],
                    daily_price=float(d.get("daily_price", 0)), status=d.get("status", "confirmed"),
                    created_at=_to_dt(d.get("created_at")) or datetime.now(timezone.utc),
                )
                stmt = stmt.on_duplicate_key_update(status=stmt.inserted.status)
                await session.execute(stmt)
                await _record_sync(session, "equipment_rental", uid_value, True)
                await session.commit()
                return True
            if Model == "service_booking_special":
                d = kwargs
                sv_r = await session.execute(select(Service.id).where(Service.service_uid == d.get("service_id")))
                sv_pk = sv_r.scalar_one_or_none()
                if not sv_pk or not user_pk:
                    await _record_sync(session, entity_type, uid_value, False, "missing FK")
                    await session.commit()
                    return False
                stmt = mysql_insert(Booking).values(
                    booking_uid=d["booking_id"], service_id=sv_pk, user_id=user_pk,
                    date=d["date"], notes=d.get("notes", ""),
                    price=float(d.get("price", 0)), status=d.get("status", "confirmed"),
                    created_at=_to_dt(d.get("created_at")) or datetime.now(timezone.utc),
                )
                stmt = stmt.on_duplicate_key_update(status=stmt.inserted.status)
                await session.execute(stmt)
                await _record_sync(session, "service_booking", uid_value, True)
                await session.commit()
                return True

            # Standard upsert
            stmt = mysql_insert(Model).values(**kwargs)
            update_cols = {k: stmt.inserted[k] for k in kwargs if k not in (uid_field, "created_at")}
            if update_cols:
                stmt = stmt.on_duplicate_key_update(**update_cols)
            await session.execute(stmt)

            # For user, also upsert profile
            if entity_type == "user":
                user_r = await session.execute(select(User.id).where(User.user_uid == uid_value))
                new_pk = user_r.scalar_one_or_none()
                if new_pk:
                    fd = doc.get("farm_details") or {}
                    prof_stmt = mysql_insert(Profile).values(
                        user_id=new_pk, bio=doc.get("bio"),
                        farm_size_acres=fd.get("size_acres"), irrigation_type=fd.get("irrigation"),
                        crops_grown_json=doc.get("crops_grown") or [],
                    )
                    prof_stmt = prof_stmt.on_duplicate_key_update(
                        bio=prof_stmt.inserted.bio, farm_size_acres=prof_stmt.inserted.farm_size_acres,
                        irrigation_type=prof_stmt.inserted.irrigation_type,
                        crops_grown_json=prof_stmt.inserted.crops_grown_json,
                    )
                    await session.execute(prof_stmt)

            await _record_sync(session, entity_type, str(uid_value), True)
            await session.commit()
            return True
    except Exception as e:
        logger.warning(f"Sync {entity_type} failed: {e}")
        try:
            async with SessionLocal() as session:
                uid = doc.get("user_id") or doc.get("product_id") or doc.get("listing_id") or doc.get("order_id") or doc.get("post_id") or doc.get("notif_id") or doc.get("payment_id") or doc.get("booking_id") or "unknown"
                await _record_sync(session, entity_type, str(uid), False, str(e))
                await session.commit()
        except Exception:
            pass
        # Queue for retry
        try:
            _retry_queue.put_nowait((entity_type, doc))
        except Exception:
            pass
        return False


async def sync_delete(entity_type: str, uid_value: str) -> bool:
    if not is_mysql_enabled():
        return False
    try:
        table_map = {
            "product": (Product, "product_uid"),
            "user": (User, "user_uid"),
            "crop_listing": (CropListing, "listing_uid"),
            "community_post": (CommunityPost, "post_uid"),
        }
        m = table_map.get(entity_type)
        if not m: return False
        Model, field = m
        async with SessionLocal() as session:
            await session.execute(delete(Model).where(getattr(Model, field) == uid_value))
            await _record_sync(session, entity_type, uid_value, True, "deleted")
            await session.commit()
            return True
    except Exception as e:
        logger.warning(f"sync_delete {entity_type} failed: {e}")
        return False


async def retry_failed():
    """Retry all failed sync events from DB."""
    if not is_mysql_enabled():
        return {"retried": 0, "success": 0, "failed": 0}
    from motor.motor_asyncio import AsyncIOMotorClient
    import os
    mongo = AsyncIOMotorClient(os.environ["MONGO_URL"])
    mdb = mongo[os.environ["DB_NAME"]]

    success = 0
    failed = 0
    async with SessionLocal() as session:
        r = await session.execute(select(SyncStatus).where(SyncStatus.sync_status == "failed").limit(200))
        failed_items = list(r.scalars())

    coll_map = {
        "user": mdb.users, "product": mdb.products, "crop_listing": mdb.crop_listings,
        "order": mdb.orders, "community_post": mdb.community_posts,
        "notification": mdb.notifications, "payment": mdb.payments,
    }
    uid_field_map = {
        "user": "user_id", "product": "product_id", "crop_listing": "listing_id",
        "order": "order_id", "community_post": "post_id",
        "notification": "notif_id", "payment": "payment_id",
    }
    for item in failed_items:
        coll = coll_map.get(item.entity_type)
        field = uid_field_map.get(item.entity_type)
        if not coll or not field: continue
        doc = await coll.find_one({field: item.entity_id}, {"_id": 0})
        if not doc:
            continue
        ok = await sync_entity(item.entity_type, doc)
        if ok: success += 1
        else: failed += 1
    mongo.close()
    return {"retried": len(failed_items), "success": success, "failed": failed}


async def sync_stats() -> Dict[str, Any]:
    from motor.motor_asyncio import AsyncIOMotorClient
    import os
    mongo = AsyncIOMotorClient(os.environ["MONGO_URL"])
    mdb = mongo[os.environ["DB_NAME"]]
    stats: Dict[str, Any] = {"mongo": {}, "mysql": {}, "sync_failures": 0, "last_sync": None}

    mongo_counts = {
        "user": await mdb.users.count_documents({}),
        "product": await mdb.products.count_documents({}),
        "crop_listing": await mdb.crop_listings.count_documents({}),
        "order": await mdb.orders.count_documents({}),
        "community_post": await mdb.community_posts.count_documents({}),
        "notification": await mdb.notifications.count_documents({}),
        "payment": await mdb.payments.count_documents({}),
        "business": await mdb.businesses.count_documents({}),
        "knowledge_article": await mdb.knowledge.count_documents({}),
        "equipment": await mdb.equipment.count_documents({}),
        "service": await mdb.services.count_documents({}),
    }
    stats["mongo"] = mongo_counts
    mongo.close()

    if is_mysql_enabled():
        from sqlalchemy import func, text
        async with SessionLocal() as session:
            def q(t): return f"SELECT COUNT(*) FROM {t}"
            for key, tbl in [
                ("user", "users"), ("product", "products"), ("crop_listing", "crop_listings"),
                ("order", "orders"), ("community_post", "community_posts"),
                ("notification", "notifications"), ("payment", "payments"),
                ("business", "businesses"), ("knowledge_article", "knowledge_articles"),
                ("equipment", "equipment"), ("service", "services"),
            ]:
                r = await session.execute(text(q(tbl)))
                stats["mysql"][key] = r.scalar()
            r = await session.execute(select(func.count()).select_from(SyncStatus).where(SyncStatus.sync_status == "failed"))
            stats["sync_failures"] = r.scalar()
            r = await session.execute(select(func.max(SyncStatus.synced_at)))
            last = r.scalar()
            stats["last_sync"] = last.isoformat() if last else None
    return stats


async def sync_failures_list(limit: int = 50):
    if not is_mysql_enabled(): return []
    async with SessionLocal() as session:
        r = await session.execute(
            select(SyncStatus).where(SyncStatus.sync_status == "failed").order_by(SyncStatus.updated_at.desc()).limit(limit)
        )
        rows = list(r.scalars())
        return [
            {"entity_type": row.entity_type, "entity_id": row.entity_id,
             "error_message": row.error_message, "retry_count": row.retry_count,
             "updated_at": row.updated_at.isoformat() if row.updated_at else None}
            for row in rows
        ]
