"""Migrate all data from MongoDB → MySQL (Hostinger).
Run after alembic upgrade head. Idempotent (uses INSERT IGNORE + upsert by uid).
"""
import asyncio
import os
import sys
import json
from datetime import datetime, timezone
from pathlib import Path
from dotenv import load_dotenv

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
load_dotenv(Path(__file__).resolve().parents[1] / ".env")

from motor.motor_asyncio import AsyncIOMotorClient
from sqlalchemy import select, insert, delete
from database import init_engine, SessionLocal, is_mysql_enabled  # noqa: E402
from models import (  # noqa: E402
    User, Profile, Product, CropListing, Equipment, EquipmentRental,
    Service, Booking, Order, CartItem, Payment, Subscription,
    CommunityPost, Comment, Like, MessageThread, Message,
    Notification, KnowledgeArticle, AiSession, AiMessage, Business,
)

mongo_client = AsyncIOMotorClient(os.environ["MONGO_URL"])
mongo_db = mongo_client[os.environ["DB_NAME"]]


def to_dt(v):
    if not v: return None
    if isinstance(v, datetime): return v
    try:
        s = v.replace("Z", "+00:00") if isinstance(v, str) else v
        return datetime.fromisoformat(s)
    except Exception:
        return None


async def migrate():
    engine = init_engine()
    if not engine:
        print("❌ MySQL not initialized (check USE_MYSQL + DB_HOST)")
        return
    from database import SessionLocal as SL

    async with SL() as s:
        # ---------- USERS ----------
        uid_to_pk: dict[str, int] = {}
        count = 0
        async for u in mongo_db.users.find({}, {"_id": 0}):
            existing = (await s.execute(select(User).where(User.user_uid == u["user_id"]))).scalar_one_or_none()
            if existing:
                uid_to_pk[u["user_id"]] = existing.id
                continue
            row = User(
                user_uid=u["user_id"], email=u["email"], password_hash=u.get("password_hash"),
                name=u.get("name", "User"), phone=u.get("phone"),
                role_code=u.get("role", "farmer"), language=u.get("language", "en"),
                verified=bool(u.get("verified", False)), kyc_verified=bool(u.get("kyc_verified", False)),
                picture=u.get("picture"), subscription=u.get("subscription", "free"),
                subscribed_at=to_dt(u.get("subscribed_at")),
                created_at=to_dt(u.get("created_at")) or datetime.now(timezone.utc),
            )
            s.add(row); await s.flush()
            uid_to_pk[u["user_id"]] = row.id
            # profile
            fd = u.get("farm_details") or {}
            prof = Profile(
                user_id=row.id, bio=u.get("bio"),
                farm_size_acres=fd.get("size_acres"), irrigation_type=fd.get("irrigation"),
                crops_grown_json=u.get("crops_grown") or [],
            )
            s.add(prof); count += 1
        await s.commit(); print(f"✓ users: {count} inserted, total map: {len(uid_to_pk)}")

        # ---------- PRODUCTS ----------
        c = 0
        async for p in mongo_db.products.find({}, {"_id": 0}):
            if (await s.execute(select(Product).where(Product.product_uid == p["product_id"]))).scalar_one_or_none():
                continue
            s.add(Product(
                product_uid=p["product_id"], title=p["title"], category_code=p["category"],
                price=float(p["price"]), unit=p.get("unit", "kg"), description=p.get("description", ""),
                image=p.get("image"), stock=int(p.get("stock", 0)),
                rating=float(p.get("rating", 0)), reviews_count=int(p.get("reviews_count", 0)),
                seller_id=uid_to_pk.get(p.get("seller_id")),
                created_at=to_dt(p.get("created_at")) or datetime.now(timezone.utc),
            )); c += 1
        await s.commit(); print(f"✓ products: {c}")

        # ---------- CROP LISTINGS ----------
        c = 0
        async for cl in mongo_db.crop_listings.find({}, {"_id": 0}):
            if (await s.execute(select(CropListing).where(CropListing.listing_uid == cl["listing_id"]))).scalar_one_or_none():
                continue
            s.add(CropListing(
                listing_uid=cl["listing_id"], crop=cl["crop"], category_code=cl["category"],
                quantity=float(cl["quantity"]), unit=cl.get("unit", "quintal"),
                expected_price=float(cl["expected_price"]), location=cl["location"],
                negotiable=bool(cl.get("negotiable", True)), image=cl.get("image"),
                description=cl.get("description", ""), status=cl.get("status", "active"),
                seller_id=uid_to_pk.get(cl.get("seller_id")),
                created_at=to_dt(cl.get("created_at")) or datetime.now(timezone.utc),
            )); c += 1
        await s.commit(); print(f"✓ crop_listings: {c}")

        # ---------- EQUIPMENT ----------
        c = 0; eq_uid_to_pk = {}
        async for e in mongo_db.equipment.find({}, {"_id": 0}):
            existing = (await s.execute(select(Equipment).where(Equipment.equipment_uid == e["equipment_id"]))).scalar_one_or_none()
            if existing:
                eq_uid_to_pk[e["equipment_id"]] = existing.id; continue
            row = Equipment(
                equipment_uid=e["equipment_id"], name=e["name"], category_code=e["category"],
                daily_price=float(e["daily_price"]), location=e["location"],
                image=e.get("image"), description=e.get("description", ""),
                rating=float(e.get("rating", 0)), owner_name=e.get("owner"),
                created_at=to_dt(e.get("created_at")) or datetime.now(timezone.utc),
            )
            s.add(row); await s.flush()
            eq_uid_to_pk[e["equipment_id"]] = row.id; c += 1
        await s.commit(); print(f"✓ equipment: {c}")

        # ---------- SERVICES ----------
        c = 0; svc_uid_to_pk = {}
        async for sv in mongo_db.services.find({}, {"_id": 0}):
            existing = (await s.execute(select(Service).where(Service.service_uid == sv["service_id"]))).scalar_one_or_none()
            if existing:
                svc_uid_to_pk[sv["service_id"]] = existing.id; continue
            row = Service(
                service_uid=sv["service_id"], name=sv["name"], category_code=sv["category"],
                price=float(sv["price"]), description=sv.get("description", ""),
                provider=sv.get("provider"), rating=float(sv.get("rating", 0)),
                icon=sv.get("icon"),
                created_at=to_dt(sv.get("created_at")) or datetime.now(timezone.utc),
            )
            s.add(row); await s.flush()
            svc_uid_to_pk[sv["service_id"]] = row.id; c += 1
        await s.commit(); print(f"✓ services: {c}")

        # ---------- ORDERS ----------
        c = 0
        async for o in mongo_db.orders.find({}, {"_id": 0}):
            if (await s.execute(select(Order).where(Order.order_uid == o["order_id"]))).scalar_one_or_none():
                continue
            uid_pk = uid_to_pk.get(o.get("user_id"))
            if not uid_pk: continue
            s.add(Order(
                order_uid=o["order_id"], user_id=uid_pk,
                items_json=o.get("items", []), address=o.get("address", ""),
                payment_method=o.get("payment_method", "cod"),
                payment_status=o.get("payment_status", "pending"),
                total=float(o.get("total", 0)), status=o.get("status", "confirmed"),
                tracking_status=o.get("tracking_status"),
                created_at=to_dt(o.get("created_at")) or datetime.now(timezone.utc),
            )); c += 1
        await s.commit(); print(f"✓ orders: {c}")

        # ---------- COMMUNITY POSTS ----------
        c = 0; post_uid_to_pk = {}
        async for p in mongo_db.community_posts.find({}, {"_id": 0}):
            existing = (await s.execute(select(CommunityPost).where(CommunityPost.post_uid == p["post_id"]))).scalar_one_or_none()
            if existing:
                post_uid_to_pk[p["post_id"]] = existing.id; continue
            uid_pk = uid_to_pk.get(p.get("user_id"))
            if not uid_pk:
                # create ghost user if seed
                ghost = User(user_uid=p["user_id"], email=f"{p['user_id']}@seed.cropido.app",
                             name=p.get("user_name", "Seed User"), role_code="farmer", verified=True)
                s.add(ghost); await s.flush()
                uid_to_pk[p["user_id"]] = ghost.id; uid_pk = ghost.id
            row = CommunityPost(
                post_uid=p["post_id"], user_id=uid_pk, content=p["content"],
                image=p.get("image"), tags_json=p.get("tags", []),
                likes_count=int(p.get("likes_count", 0)),
                comments_count=int(p.get("comments_count", 0)),
                shares_count=int(p.get("shares_count", 0)),
                is_expert=bool(p.get("is_expert", False)),
                created_at=to_dt(p.get("created_at")) or datetime.now(timezone.utc),
            )
            s.add(row); await s.flush()
            post_uid_to_pk[p["post_id"]] = row.id; c += 1
        await s.commit(); print(f"✓ community_posts: {c}")

        # ---------- KNOWLEDGE ----------
        c = 0
        async for a in mongo_db.knowledge.find({}, {"_id": 0}):
            if (await s.execute(select(KnowledgeArticle).where(KnowledgeArticle.article_uid == a["article_id"]))).scalar_one_or_none():
                continue
            s.add(KnowledgeArticle(
                article_uid=a["article_id"], title=a["title"], category_code=a["category"],
                author=a.get("author"), image=a.get("image"), excerpt=a.get("excerpt"),
                read_time=a.get("read_time"), views=int(a.get("views", 0)),
                is_video=bool(a.get("is_video", False)),
                created_at=to_dt(a.get("created_at")) or datetime.now(timezone.utc),
            )); c += 1
        await s.commit(); print(f"✓ knowledge_articles: {c}")

        # ---------- BUSINESSES ----------
        c = 0
        async for b in mongo_db.businesses.find({}, {"_id": 0}):
            if (await s.execute(select(Business).where(Business.business_uid == b["business_id"]))).scalar_one_or_none():
                continue
            s.add(Business(
                business_uid=b["business_id"], name=b["name"], category_code=b["category"],
                location=b.get("location"), phone=b.get("phone"), logo=b.get("logo"),
                description=b.get("description", ""), rating=float(b.get("rating", 0)),
                verified=bool(b.get("verified", False)),
                created_at=to_dt(b.get("created_at")) or datetime.now(timezone.utc),
            )); c += 1
        await s.commit(); print(f"✓ businesses: {c}")

        # ---------- NOTIFICATIONS ----------
        c = 0
        async for n in mongo_db.notifications.find({}, {"_id": 0}):
            if (await s.execute(select(Notification).where(Notification.notif_uid == n["notif_id"]))).scalar_one_or_none():
                continue
            uid_pk = uid_to_pk.get(n.get("user_id"))
            if not uid_pk: continue
            s.add(Notification(
                notif_uid=n["notif_id"], user_id=uid_pk, title=n["title"],
                body=n.get("body"), type=n.get("type", "system"), icon=n.get("icon"),
                read=bool(n.get("read", False)),
                created_at=to_dt(n.get("created_at")) or datetime.now(timezone.utc),
            )); c += 1
        await s.commit(); print(f"✓ notifications: {c}")

        # ---------- PAYMENTS ----------
        c = 0
        async for p in mongo_db.payments.find({}, {"_id": 0}):
            if (await s.execute(select(Payment).where(Payment.payment_uid == p["payment_id"]))).scalar_one_or_none():
                continue
            uid_pk = uid_to_pk.get(p.get("user_id"))
            if not uid_pk: continue
            s.add(Payment(
                payment_uid=p["payment_id"], user_id=uid_pk, plan_code=p.get("plan_id"),
                amount=float(p.get("amount", 0)), currency=p.get("currency", "INR"),
                gateway=p.get("gateway", "razorpay"),
                razorpay_order_id=p.get("razorpay_order_id"),
                razorpay_payment_id=p.get("razorpay_payment_id"),
                stripe_session_id=p.get("session_id"),
                status=p.get("status", "paid"),
                created_at=to_dt(p.get("created_at")) or datetime.now(timezone.utc),
            )); c += 1
        await s.commit(); print(f"✓ payments: {c}")

    await engine.dispose()
    mongo_client.close()
    print("\n🎉 Migration complete!")


if __name__ == "__main__":
    asyncio.run(migrate())
