"""Cropido — Digital Agriculture Super-App Backend (FastAPI + MongoDB)."""
from fastapi import FastAPI, APIRouter, Depends, HTTPException, Header, status, Request
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import uuid
import json
import jwt
import bcrypt
import httpx
import base64
from pathlib import Path
from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, timedelta
from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent
from emergentintegrations.payments.stripe.checkout import (
    StripeCheckout, CheckoutSessionRequest,
)
import razorpay
import hmac
import hashlib
from database import init_engine
from sync import sync_entity, sync_delete, sync_stats, sync_failures_list, retry_failed

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ['JWT_SECRET']
JWT_ALGO = 'HS256'
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY', '')
STRIPE_API_KEY = os.environ.get('STRIPE_API_KEY', '')
APP_BASE_URL = os.environ.get('APP_BASE_URL', 'http://localhost:8001')
RAZORPAY_KEY_ID = os.environ.get('RAZORPAY_KEY_ID', '')
RAZORPAY_KEY_SECRET = os.environ.get('RAZORPAY_KEY_SECRET', '')
razorpay_client = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET)) if RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET else None

app = FastAPI(title="Cropido API")
api = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("cropido")


# ---------- Utilities ----------
def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def hash_pw(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()


def verify_pw(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), hashed.encode())
    except Exception:
        return False


def make_token(user_id: str, days: int = 30) -> str:
    payload = {"sub": user_id, "exp": now_utc() + timedelta(days=days), "iat": now_utc()}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)


async def get_current_user(authorization: Optional[str] = Header(None)) -> Dict[str, Any]:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = authorization.split(" ", 1)[1]
    # First try JWT
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGO])
        uid = payload.get("sub")
        user = await db.users.find_one({"user_id": uid}, {"_id": 0, "password_hash": 0})
        if user:
            return user
    except jwt.PyJWTError:
        pass
    # Fallback: session_token from Emergent Google OAuth
    session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if session:
        exp = session.get("expires_at")
        if exp:
            if isinstance(exp, str):
                exp = datetime.fromisoformat(exp)
            if exp.tzinfo is None:
                exp = exp.replace(tzinfo=timezone.utc)
            if exp > now_utc():
                user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0, "password_hash": 0})
                if user:
                    return user
    raise HTTPException(status_code=401, detail="Invalid or expired token")


# ---------- Models ----------
class RegisterIn(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: str = "farmer"
    phone: Optional[str] = None
    language: str = "en"


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class ForgotIn(BaseModel):
    email: EmailStr


class OTPSendIn(BaseModel):
    phone: str


class OTPVerifyIn(BaseModel):
    phone: str
    otp: str
    name: Optional[str] = None
    role: Optional[str] = "farmer"


class GoogleSessionIn(BaseModel):
    session_id: str


class ProductIn(BaseModel):
    title: str
    category: str
    price: float
    unit: str = "kg"
    description: str = ""
    image: Optional[str] = None
    stock: int = 100


class CropListingIn(BaseModel):
    crop: str
    category: str
    quantity: float
    unit: str = "quintal"
    expected_price: float
    location: str
    negotiable: bool = True
    image: Optional[str] = None
    description: str = ""


class EquipmentIn(BaseModel):
    name: str
    category: str
    daily_price: float
    location: str
    image: Optional[str] = None
    description: str = ""


class EquipmentBookIn(BaseModel):
    equipment_id: str
    start_date: str
    end_date: str


class ServiceBookIn(BaseModel):
    service_id: str
    date: str
    notes: str = ""


class PostIn(BaseModel):
    content: str
    image: Optional[str] = None
    tags: List[str] = []


class CommentIn(BaseModel):
    text: str


class ChatIn(BaseModel):
    session_id: str
    message: str
    image_base64: Optional[str] = None
    language: str = "en"


class CartAddIn(BaseModel):
    product_id: str
    quantity: int = 1


class OrderIn(BaseModel):
    items: List[Dict[str, Any]]
    address: str
    payment_method: str = "cod"


class MessageIn(BaseModel):
    to_user_id: str
    text: str


class SubscribeIn(BaseModel):
    plan_id: str


# ---------- AUTH ----------
@api.post("/auth/register")
async def register(body: RegisterIn):
    existing = await db.users.find_one({"email": body.email})
    if existing:
        raise HTTPException(400, "Email already registered")
    uid = f"user_{uuid.uuid4().hex[:12]}"
    doc = {
        "user_id": uid,
        "email": body.email,
        "password_hash": hash_pw(body.password),
        "name": body.name,
        "role": body.role,
        "phone": body.phone,
        "language": body.language,
        "verified": False,
        "kyc_verified": False,
        "picture": None,
        "bio": "",
        "farm_details": {},
        "crops_grown": [],
        "subscription": "free",
        "created_at": now_utc().isoformat(),
    }
    await db.users.insert_one(doc)
    token = make_token(uid)
    doc.pop("_id", None)
    doc.pop("password_hash", None)
    return {"token": token, "user": doc}


@api.post("/auth/login")
async def login(body: LoginIn):
    user = await db.users.find_one({"email": body.email})
    if not user or not verify_pw(body.password, user.get("password_hash", "")):
        raise HTTPException(401, "Invalid credentials")
    token = make_token(user["user_id"])
    user.pop("_id", None)
    user.pop("password_hash", None)
    return {"token": token, "user": user}


@api.post("/auth/forgot-password")
async def forgot_password(body: ForgotIn):
    user = await db.users.find_one({"email": body.email})
    if not user:
        return {"ok": True, "message": "If the email exists, reset link was sent"}
    reset_code = str(uuid.uuid4())[:8].upper()
    await db.password_resets.insert_one({
        "email": body.email,
        "code": reset_code,
        "expires_at": (now_utc() + timedelta(hours=1)).isoformat(),
    })
    logger.info(f"Password reset code for {body.email}: {reset_code}")
    return {"ok": True, "message": "Reset code sent", "dev_code": reset_code}


@api.post("/auth/otp/send")
async def send_otp(body: OTPSendIn):
    otp = "123456"  # Simulated OTP for MVP
    await db.otps.update_one(
        {"phone": body.phone},
        {"$set": {"otp": otp, "expires_at": (now_utc() + timedelta(minutes=10)).isoformat()}},
        upsert=True,
    )
    return {"ok": True, "message": "OTP sent (use 123456 for demo)"}


@api.post("/auth/otp/verify")
async def verify_otp(body: OTPVerifyIn):
    rec = await db.otps.find_one({"phone": body.phone})
    if not rec or rec.get("otp") != body.otp:
        raise HTTPException(401, "Invalid OTP")
    user = await db.users.find_one({"phone": body.phone})
    if not user:
        uid = f"user_{uuid.uuid4().hex[:12]}"
        user = {
            "user_id": uid,
            "email": f"{body.phone}@cropido.app",
            "password_hash": "",
            "name": body.name or f"User {body.phone[-4:]}",
            "role": body.role or "farmer",
            "phone": body.phone,
            "language": "en",
            "verified": True,
            "kyc_verified": False,
            "picture": None,
            "bio": "",
            "farm_details": {},
            "crops_grown": [],
            "subscription": "free",
            "created_at": now_utc().isoformat(),
        }
        await db.users.insert_one(user)
    token = make_token(user["user_id"])
    user.pop("_id", None)
    user.pop("password_hash", None)
    return {"token": token, "user": user}


@api.post("/auth/google/session")
async def google_session(body: GoogleSessionIn):
    """Exchange emergent session_id for user + app token."""
    async with httpx.AsyncClient(timeout=15) as hc:
        r = await hc.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": body.session_id},
        )
    if r.status_code != 200:
        raise HTTPException(401, "Invalid session")
    data = r.json()
    email = data.get("email")
    session_token = data.get("session_token")
    user = await db.users.find_one({"email": email})
    if not user:
        uid = f"user_{uuid.uuid4().hex[:12]}"
        user = {
            "user_id": uid,
            "email": email,
            "password_hash": "",
            "name": data.get("name", "User"),
            "role": "farmer",
            "phone": None,
            "language": "en",
            "verified": True,
            "kyc_verified": False,
            "picture": data.get("picture"),
            "bio": "",
            "farm_details": {},
            "crops_grown": [],
            "subscription": "free",
            "created_at": now_utc().isoformat(),
        }
        await db.users.insert_one(user)
    await db.user_sessions.insert_one({
        "session_token": session_token,
        "user_id": user["user_id"],
        "expires_at": (now_utc() + timedelta(days=7)).isoformat(),
        "created_at": now_utc().isoformat(),
    })
    user.pop("_id", None)
    user.pop("password_hash", None)
    return {"token": session_token, "user": user}


@api.get("/auth/me")
async def me(user=Depends(get_current_user)):
    return {"user": user}


@api.post("/auth/logout")
async def logout(user=Depends(get_current_user), authorization: Optional[str] = Header(None)):
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ", 1)[1]
        await db.user_sessions.delete_one({"session_token": token})
    return {"ok": True}


# ---------- DASHBOARD ----------
@api.get("/dashboard")
async def dashboard(user=Depends(get_current_user)):
    products = await db.products.find({}, {"_id": 0}).limit(6).to_list(6)
    crops = await db.crop_listings.find({}, {"_id": 0}).limit(4).to_list(4)
    services = await db.services.find({}, {"_id": 0}).limit(4).to_list(4)
    news = await db.knowledge.find({}, {"_id": 0}).limit(4).to_list(4)
    return {
        "weather": {
            "temp": 28,
            "condition": "Partly Cloudy",
            "humidity": 62,
            "wind": 8,
            "location": "Nashik, MH",
            "icon": "partly-sunny",
            "forecast": [
                {"day": "Mon", "temp": 29, "icon": "sunny"},
                {"day": "Tue", "temp": 27, "icon": "cloudy"},
                {"day": "Wed", "temp": 26, "icon": "rainy"},
            ],
        },
        "market_prices": [
            {"crop": "Wheat", "price": 2450, "unit": "quintal", "change": 2.3},
            {"crop": "Rice", "price": 3180, "unit": "quintal", "change": -0.8},
            {"crop": "Onion", "price": 1850, "unit": "quintal", "change": 5.1},
            {"crop": "Tomato", "price": 2100, "unit": "quintal", "change": 3.2},
            {"crop": "Soybean", "price": 4520, "unit": "quintal", "change": 1.4},
        ],
        "featured_products": products,
        "trending_crops": crops,
        "nearby_services": services,
        "news": news,
        "recommendations": [
            "Best time to sow wheat is approaching in your region",
            "Fertilizer prices dropped 8% this week — stock up",
            "New PM-Kisan installment credit expected next week",
        ],
    }


# ---------- MARKETPLACE ----------
@api.get("/products")
async def list_products(category: Optional[str] = None, q: Optional[str] = None):
    query: Dict[str, Any] = {}
    if category and category != "all":
        query["category"] = category
    if q:
        query["title"] = {"$regex": q, "$options": "i"}
    items = await db.products.find(query, {"_id": 0}).to_list(200)
    return {"products": items}


@api.get("/products/{product_id}")
async def get_product(product_id: str):
    p = await db.products.find_one({"product_id": product_id}, {"_id": 0})
    if not p:
        raise HTTPException(404, "Product not found")
    reviews = await db.reviews.find({"product_id": product_id}, {"_id": 0}).to_list(50)
    return {"product": p, "reviews": reviews}


@api.post("/products")
async def create_product(body: ProductIn, user=Depends(get_current_user)):
    pid = f"prod_{uuid.uuid4().hex[:10]}"
    doc = {
        "product_id": pid, "seller_id": user["user_id"], "seller_name": user["name"],
        "rating": 4.5, "reviews_count": 0,
        "created_at": now_utc().isoformat(),
        **body.model_dump(),
    }
    await db.products.insert_one(doc)
    doc.pop("_id", None)
    return {"product": doc}


@api.post("/cart/add")
async def add_to_cart(body: CartAddIn, user=Depends(get_current_user)):
    await db.carts.update_one(
        {"user_id": user["user_id"], "product_id": body.product_id},
        {"$set": {"quantity": body.quantity, "updated_at": now_utc().isoformat()}},
        upsert=True,
    )
    return {"ok": True}


@api.get("/cart")
async def get_cart(user=Depends(get_current_user)):
    items = await db.carts.find({"user_id": user["user_id"]}, {"_id": 0}).to_list(100)
    out = []
    for it in items:
        p = await db.products.find_one({"product_id": it["product_id"]}, {"_id": 0})
        if p:
            out.append({**it, "product": p})
    return {"cart": out}


@api.delete("/cart/{product_id}")
async def remove_cart(product_id: str, user=Depends(get_current_user)):
    await db.carts.delete_one({"user_id": user["user_id"], "product_id": product_id})
    return {"ok": True}


@api.post("/orders")
async def create_order(body: OrderIn, user=Depends(get_current_user)):
    total = sum(float(i.get("price", 0)) * int(i.get("quantity", 1)) for i in body.items)
    oid = f"ord_{uuid.uuid4().hex[:10]}"
    doc = {
        "order_id": oid, "user_id": user["user_id"], "items": body.items,
        "address": body.address, "payment_method": body.payment_method,
        "total": total, "status": "confirmed", "tracking_status": "Order Confirmed",
        "created_at": now_utc().isoformat(),
    }
    await db.orders.insert_one(doc)
    await db.carts.delete_many({"user_id": user["user_id"]})
    doc.pop("_id", None)
    return {"order": doc}


@api.get("/orders")
async def list_orders(user=Depends(get_current_user)):
    items = await db.orders.find({"user_id": user["user_id"]}, {"_id": 0}).sort("created_at", -1).to_list(50)
    return {"orders": items}


# ---------- CROP TRADING ----------
@api.get("/crops")
async def list_crops(category: Optional[str] = None):
    q: Dict[str, Any] = {}
    if category and category != "all":
        q["category"] = category
    items = await db.crop_listings.find(q, {"_id": 0}).sort("created_at", -1).to_list(200)
    return {"listings": items}


@api.post("/crops")
async def create_crop(body: CropListingIn, user=Depends(get_current_user)):
    lid = f"crop_{uuid.uuid4().hex[:10]}"
    doc = {
        "listing_id": lid, "seller_id": user["user_id"], "seller_name": user["name"],
        "seller_verified": user.get("verified", False),
        "status": "active", "created_at": now_utc().isoformat(),
        **body.model_dump(),
    }
    await db.crop_listings.insert_one(doc)
    doc.pop("_id", None)
    return {"listing": doc}


# ---------- EQUIPMENT ----------
@api.get("/equipment")
async def list_equipment(category: Optional[str] = None):
    q: Dict[str, Any] = {}
    if category and category != "all":
        q["category"] = category
    items = await db.equipment.find(q, {"_id": 0}).to_list(100)
    return {"equipment": items}


@api.post("/equipment/bookings")
async def book_equipment(body: EquipmentBookIn, user=Depends(get_current_user)):
    eq = await db.equipment.find_one({"equipment_id": body.equipment_id}, {"_id": 0})
    if not eq:
        raise HTTPException(404, "Equipment not found")
    bid = f"book_{uuid.uuid4().hex[:10]}"
    doc = {
        "booking_id": bid, "user_id": user["user_id"], "equipment_id": body.equipment_id,
        "equipment_name": eq["name"], "start_date": body.start_date, "end_date": body.end_date,
        "daily_price": eq["daily_price"], "status": "confirmed",
        "created_at": now_utc().isoformat(),
    }
    await db.equipment_bookings.insert_one(doc)
    doc.pop("_id", None)
    return {"booking": doc}


@api.get("/equipment/bookings")
async def list_equipment_bookings(user=Depends(get_current_user)):
    items = await db.equipment_bookings.find({"user_id": user["user_id"]}, {"_id": 0}).sort("created_at", -1).to_list(50)
    return {"bookings": items}


# ---------- SERVICES ----------
@api.get("/services")
async def list_services(category: Optional[str] = None):
    q: Dict[str, Any] = {}
    if category and category != "all":
        q["category"] = category
    items = await db.services.find(q, {"_id": 0}).to_list(100)
    return {"services": items}


@api.post("/services/bookings")
async def book_service(body: ServiceBookIn, user=Depends(get_current_user)):
    svc = await db.services.find_one({"service_id": body.service_id}, {"_id": 0})
    if not svc:
        raise HTTPException(404, "Service not found")
    bid = f"svcb_{uuid.uuid4().hex[:10]}"
    doc = {
        "booking_id": bid, "user_id": user["user_id"], "service_id": body.service_id,
        "service_name": svc["name"], "date": body.date, "notes": body.notes,
        "status": "confirmed", "price": svc.get("price", 0),
        "created_at": now_utc().isoformat(),
    }
    await db.service_bookings.insert_one(doc)
    doc.pop("_id", None)
    return {"booking": doc}


@api.get("/services/bookings")
async def list_service_bookings(user=Depends(get_current_user)):
    items = await db.service_bookings.find({"user_id": user["user_id"]}, {"_id": 0}).sort("created_at", -1).to_list(50)
    return {"bookings": items}


# ---------- COMMUNITY ----------
@api.get("/community/posts")
async def list_posts(tab: str = "feed"):
    q: Dict[str, Any] = {}
    sort_key = "created_at"
    if tab == "trending":
        sort_key = "likes_count"
    if tab == "experts":
        q["is_expert"] = True
    items = await db.community_posts.find(q, {"_id": 0}).sort(sort_key, -1).to_list(100)
    return {"posts": items}


@api.post("/community/posts")
async def create_post(body: PostIn, user=Depends(get_current_user)):
    pid = f"post_{uuid.uuid4().hex[:10]}"
    doc = {
        "post_id": pid, "user_id": user["user_id"], "user_name": user["name"],
        "user_picture": user.get("picture"),
        "content": body.content, "image": body.image, "tags": body.tags,
        "likes_count": 0, "comments_count": 0, "shares_count": 0,
        "likes_by": [], "is_expert": user.get("role") == "consultant",
        "created_at": now_utc().isoformat(),
    }
    await db.community_posts.insert_one(doc)
    doc.pop("_id", None)
    return {"post": doc}


@api.post("/community/posts/{post_id}/like")
async def like_post(post_id: str, user=Depends(get_current_user)):
    post = await db.community_posts.find_one({"post_id": post_id}, {"_id": 0})
    if not post:
        raise HTTPException(404, "Post not found")
    likes_by = post.get("likes_by", [])
    if user["user_id"] in likes_by:
        likes_by.remove(user["user_id"])
    else:
        likes_by.append(user["user_id"])
    await db.community_posts.update_one(
        {"post_id": post_id},
        {"$set": {"likes_by": likes_by, "likes_count": len(likes_by)}},
    )
    return {"ok": True, "likes_count": len(likes_by), "liked": user["user_id"] in likes_by}


@api.post("/community/posts/{post_id}/comments")
async def add_comment(post_id: str, body: CommentIn, user=Depends(get_current_user)):
    cid = f"cmt_{uuid.uuid4().hex[:10]}"
    doc = {
        "comment_id": cid, "post_id": post_id, "user_id": user["user_id"],
        "user_name": user["name"], "text": body.text,
        "created_at": now_utc().isoformat(),
    }
    await db.comments.insert_one(doc)
    await db.community_posts.update_one({"post_id": post_id}, {"$inc": {"comments_count": 1}})
    doc.pop("_id", None)
    return {"comment": doc}


@api.get("/community/posts/{post_id}/comments")
async def list_comments(post_id: str):
    items = await db.comments.find({"post_id": post_id}, {"_id": 0}).sort("created_at", 1).to_list(100)
    return {"comments": items}


# ---------- KNOWLEDGE ----------
@api.get("/knowledge")
async def list_knowledge(category: Optional[str] = None):
    q: Dict[str, Any] = {}
    if category and category != "all":
        q["category"] = category
    items = await db.knowledge.find(q, {"_id": 0}).to_list(100)
    return {"articles": items}


@api.get("/knowledge/{article_id}")
async def get_article(article_id: str):
    a = await db.knowledge.find_one({"article_id": article_id}, {"_id": 0})
    if not a:
        raise HTTPException(404, "Article not found")
    return {"article": a}


# ---------- BUSINESS DIRECTORY ----------
@api.get("/businesses")
async def list_businesses(category: Optional[str] = None, q: Optional[str] = None):
    query: Dict[str, Any] = {}
    if category and category != "all":
        query["category"] = category
    if q:
        query["name"] = {"$regex": q, "$options": "i"}
    items = await db.businesses.find(query, {"_id": 0}).to_list(100)
    return {"businesses": items}


# ---------- MESSAGING ----------
@api.get("/messages/threads")
async def list_threads(user=Depends(get_current_user)):
    threads = await db.message_threads.find({"participants": user["user_id"]}, {"_id": 0}).sort("updated_at", -1).to_list(50)
    return {"threads": threads}


@api.get("/messages/threads/{thread_id}")
async def get_thread_messages(thread_id: str, user=Depends(get_current_user)):
    msgs = await db.messages.find({"thread_id": thread_id}, {"_id": 0}).sort("created_at", 1).to_list(200)
    return {"messages": msgs}


@api.post("/messages/send")
async def send_message(body: MessageIn, user=Depends(get_current_user)):
    participants = sorted([user["user_id"], body.to_user_id])
    thread = await db.message_threads.find_one({"participants": participants}, {"_id": 0})
    if not thread:
        tid = f"thr_{uuid.uuid4().hex[:10]}"
        other = await db.users.find_one({"user_id": body.to_user_id}, {"_id": 0, "password_hash": 0})
        thread = {
            "thread_id": tid, "participants": participants,
            "last_message": body.text,
            "other_name": other["name"] if other else "User",
            "other_picture": other.get("picture") if other else None,
            "updated_at": now_utc().isoformat(),
            "created_at": now_utc().isoformat(),
        }
        await db.message_threads.insert_one(thread)
    else:
        await db.message_threads.update_one(
            {"thread_id": thread["thread_id"]},
            {"$set": {"last_message": body.text, "updated_at": now_utc().isoformat()}},
        )
    mid = f"msg_{uuid.uuid4().hex[:10]}"
    msg = {
        "message_id": mid, "thread_id": thread["thread_id"],
        "from_user_id": user["user_id"], "to_user_id": body.to_user_id,
        "text": body.text, "read": False,
        "created_at": now_utc().isoformat(),
    }
    await db.messages.insert_one(msg)
    msg.pop("_id", None)
    return {"message": msg, "thread_id": thread["thread_id"]}


# ---------- NOTIFICATIONS ----------
@api.get("/notifications")
async def list_notifications(user=Depends(get_current_user)):
    items = await db.notifications.find({"user_id": user["user_id"]}, {"_id": 0}).sort("created_at", -1).to_list(50)
    if not items:
        # seed demo notifications
        base = [
            {"title": "Welcome to Cropido!", "body": "Complete your profile to unlock all features.", "type": "system", "icon": "leaf"},
            {"title": "Wheat price up 2.3%", "body": "Market prices are trending up in Nashik region.", "type": "market", "icon": "trending-up"},
            {"title": "Weather Alert", "body": "Light rain expected tomorrow — plan irrigation.", "type": "weather", "icon": "rainy"},
            {"title": "New crop advisory available", "body": "AI recommends switching to organic pesticide this season.", "type": "ai", "icon": "sparkles"},
        ]
        for b in base:
            await db.notifications.insert_one({
                "notif_id": f"ntf_{uuid.uuid4().hex[:10]}",
                "user_id": user["user_id"], "read": False,
                "created_at": now_utc().isoformat(),
                **b,
            })
        items = await db.notifications.find({"user_id": user["user_id"]}, {"_id": 0}).sort("created_at", -1).to_list(50)
    return {"notifications": items}


@api.post("/notifications/read-all")
async def mark_all_read(user=Depends(get_current_user)):
    await db.notifications.update_many({"user_id": user["user_id"]}, {"$set": {"read": True}})
    return {"ok": True}


# ---------- AI ASSISTANT ----------
@api.post("/ai/chat")
async def ai_chat(body: ChatIn, user=Depends(get_current_user)):
    lang_map = {"en": "English", "hi": "Hindi (हिंदी)", "bn": "Bengali (বাংলা)"}
    lang = lang_map.get(body.language, "English")
    system_msg = (
        f"You are Cropido AI, an expert farming assistant for Indian farmers. "
        f"You provide advice on crops, diseases, pests, weather-based farming, market prices, "
        f"government schemes, and irrigation. Be concise, practical, and warm. "
        f"Always respond in {lang}."
    )
    session_id = f"ai_{user['user_id']}_{body.session_id}"
    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=session_id,
            system_message=system_msg,
        ).with_model("anthropic", "claude-sonnet-4-5-20250929")

        file_contents = []
        if body.image_base64:
            file_contents.append(ImageContent(image_base64=body.image_base64))

        user_msg = UserMessage(text=body.message, file_contents=file_contents) if file_contents else UserMessage(text=body.message)
        reply = await chat.send_message(user_msg)
    except Exception as e:
        logger.exception("AI chat error")
        reply = f"I apologize, I'm having trouble responding right now. ({str(e)[:80]})"

    # Persist to DB (for history)
    await db.ai_messages.insert_one({
        "session_id": session_id, "user_id": user["user_id"],
        "role": "user", "text": body.message, "has_image": bool(body.image_base64),
        "created_at": now_utc().isoformat(),
    })
    await db.ai_messages.insert_one({
        "session_id": session_id, "user_id": user["user_id"],
        "role": "assistant", "text": reply,
        "created_at": now_utc().isoformat(),
    })
    return {"reply": reply, "session_id": body.session_id}


@api.get("/ai/history/{session_id}")
async def ai_history(session_id: str, user=Depends(get_current_user)):
    sid = f"ai_{user['user_id']}_{session_id}"
    msgs = await db.ai_messages.find({"session_id": sid}, {"_id": 0}).sort("created_at", 1).to_list(200)
    return {"messages": msgs}


# ---------- SUBSCRIPTIONS ----------
PLANS = [
    {"plan_id": "free", "name": "Free", "price": 0, "period": "forever",
     "features": ["Browse Marketplace", "Basic AI queries (10/mo)", "Community access", "1 crop listing"],
     "cta": "Current Plan", "highlight": False},
    {"plan_id": "pro_farmer", "name": "Pro Farmer", "price": 299, "period": "month",
     "features": ["Unlimited AI chats", "Priority support", "Advanced market insights", "10 crop listings", "Featured badge"],
     "cta": "Upgrade", "highlight": True},
    {"plan_id": "business", "name": "Business", "price": 999, "period": "month",
     "features": ["Everything in Pro", "Bulk listings", "Analytics dashboard", "Priority buyer matching", "API access"],
     "cta": "Upgrade", "highlight": False},
    {"plan_id": "enterprise", "name": "Enterprise", "price": 4999, "period": "month",
     "features": ["Custom integrations", "Dedicated account manager", "White-label options", "SLA guarantee"],
     "cta": "Contact Sales", "highlight": False},
]


@api.get("/subscriptions/plans")
async def get_plans(user=Depends(get_current_user)):
    return {"plans": PLANS, "current": user.get("subscription", "free")}


@api.post("/subscriptions/subscribe")
async def subscribe(body: SubscribeIn, user=Depends(get_current_user)):
    """MVP: mock subscription upgrade (Stripe test mode)."""
    plan = next((p for p in PLANS if p["plan_id"] == body.plan_id), None)
    if not plan:
        raise HTTPException(404, "Plan not found")
    await db.users.update_one(
        {"user_id": user["user_id"]},
        {"$set": {"subscription": body.plan_id, "subscribed_at": now_utc().isoformat()}},
    )
    await db.payments.insert_one({
        "payment_id": f"pay_{uuid.uuid4().hex[:10]}",
        "user_id": user["user_id"], "plan_id": body.plan_id,
        "amount": plan["price"], "status": "paid",
        "created_at": now_utc().isoformat(),
    })
    return {"ok": True, "plan": plan}


# ---------- STRIPE CHECKOUT (real test mode) ----------
class CheckoutSubIn(BaseModel):
    plan_id: str
    origin_url: str


class CheckoutOrderIn(BaseModel):
    order_id: str
    amount: float
    origin_url: str


@api.post("/payments/checkout/subscription")
async def checkout_subscription(body: CheckoutSubIn, user=Depends(get_current_user)):
    plan = next((p for p in PLANS if p["plan_id"] == body.plan_id), None)
    if not plan or plan["price"] == 0:
        raise HTTPException(400, "Invalid or free plan")

    origin = body.origin_url.rstrip('/')
    webhook_url = f"{APP_BASE_URL}/api/webhook/stripe"
    checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
    req = CheckoutSessionRequest(
        amount=float(plan["price"]),
        currency="inr",
        success_url=f"{origin}/payment-success?session_id={{CHECKOUT_SESSION_ID}}",
        cancel_url=f"{origin}/subscription",
        metadata={
            "user_id": user["user_id"], "kind": "subscription",
            "plan_id": body.plan_id,
        },
    )
    session = await checkout.create_checkout_session(req)

    # Persist pending transaction (never trust client for amount)
    await db.payment_transactions.insert_one({
        "session_id": session.session_id,
        "user_id": user["user_id"],
        "kind": "subscription",
        "plan_id": body.plan_id,
        "amount": float(plan["price"]),
        "currency": "inr",
        "payment_status": "pending",
        "created_at": now_utc().isoformat(),
    })
    return {"url": session.url, "session_id": session.session_id}


@api.post("/payments/checkout/order")
async def checkout_order(body: CheckoutOrderIn, user=Depends(get_current_user)):
    origin = body.origin_url.rstrip('/')
    webhook_url = f"{APP_BASE_URL}/api/webhook/stripe"
    checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
    # Server-side validate amount range (INR paise up to 500,000)
    amount = max(1.0, min(500000.0, float(body.amount)))
    req = CheckoutSessionRequest(
        amount=amount, currency="inr",
        success_url=f"{origin}/payment-success?session_id={{CHECKOUT_SESSION_ID}}",
        cancel_url=f"{origin}/cart",
        metadata={"user_id": user["user_id"], "kind": "order", "order_id": body.order_id},
    )
    session = await checkout.create_checkout_session(req)
    await db.payment_transactions.insert_one({
        "session_id": session.session_id,
        "user_id": user["user_id"],
        "kind": "order",
        "order_id": body.order_id,
        "amount": amount,
        "currency": "inr",
        "payment_status": "pending",
        "created_at": now_utc().isoformat(),
    })
    return {"url": session.url, "session_id": session.session_id}


@api.get("/payments/status/{session_id}")
async def payment_status(session_id: str, user=Depends(get_current_user)):
    tx = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
    if not tx:
        raise HTTPException(404, "Transaction not found")

    # If already finalized in DB, return
    if tx.get("payment_status") in {"paid", "failed", "expired"}:
        return {"payment_status": tx["payment_status"], "transaction": tx}

    # Otherwise poll Stripe
    checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=f"{APP_BASE_URL}/api/webhook/stripe")
    try:
        status = await checkout.get_checkout_status(session_id)
    except Exception as e:
        logger.warning(f"Stripe status fetch failed: {e}")
        return {"payment_status": tx.get("payment_status", "pending"), "transaction": tx}

    ps = getattr(status, "payment_status", None) or "pending"
    updates = {"payment_status": ps, "updated_at": now_utc().isoformat()}
    if ps == "paid" and tx["kind"] == "subscription":
        await db.users.update_one(
            {"user_id": tx["user_id"]},
            {"$set": {"subscription": tx["plan_id"], "subscribed_at": now_utc().isoformat()}},
        )
        # Log to payments (idempotent — check if payment already logged for this session)
        already = await db.payments.find_one({"session_id": session_id})
        if not already:
            await db.payments.insert_one({
                "payment_id": f"pay_{uuid.uuid4().hex[:10]}",
                "session_id": session_id,
                "user_id": tx["user_id"], "plan_id": tx["plan_id"],
                "amount": tx["amount"], "status": "paid",
                "created_at": now_utc().isoformat(),
            })
    await db.payment_transactions.update_one({"session_id": session_id}, {"$set": updates})
    tx.update(updates)
    return {"payment_status": ps, "transaction": tx}


@app.post("/api/webhook/stripe")
async def stripe_webhook(request: Request):
    body = await request.body()
    sig = request.headers.get("stripe-signature", "")
    try:
        checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=f"{APP_BASE_URL}/api/webhook/stripe")
        response = await checkout.handle_webhook(body, sig)
        # response likely has session_id and payment_status
        session_id = getattr(response, "session_id", None)
        ps = getattr(response, "payment_status", None)
        if session_id and ps:
            tx = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
            if tx and tx.get("payment_status") != "paid":
                await db.payment_transactions.update_one(
                    {"session_id": session_id},
                    {"$set": {"payment_status": ps, "updated_at": now_utc().isoformat()}},
                )
                if ps == "paid" and tx["kind"] == "subscription":
                    await db.users.update_one(
                        {"user_id": tx["user_id"]},
                        {"$set": {"subscription": tx["plan_id"], "subscribed_at": now_utc().isoformat()}},
                    )
                    already = await db.payments.find_one({"session_id": session_id})
                    if not already:
                        await db.payments.insert_one({
                            "payment_id": f"pay_{uuid.uuid4().hex[:10]}",
                            "session_id": session_id,
                            "user_id": tx["user_id"], "plan_id": tx["plan_id"],
                            "amount": tx["amount"], "status": "paid",
                            "created_at": now_utc().isoformat(),
                        })
    except Exception as e:
        logger.warning(f"Webhook processing error: {e}")
    return {"ok": True}


# ---------- RAZORPAY (India: UPI, cards, netbanking, wallets) ----------
class RzpOrderIn(BaseModel):
    plan_id: Optional[str] = None
    order_id: Optional[str] = None  # marketplace order (kind='order')
    amount: Optional[float] = None  # only used for order kind
    kind: str = "subscription"  # subscription | order
    return_url: Optional[str] = None  # where checkout page redirects after payment


class RzpVerifyIn(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str


def _verify_rzp_signature(order_id: str, payment_id: str, signature: str) -> bool:
    body = f"{order_id}|{payment_id}".encode()
    expected = hmac.new(RAZORPAY_KEY_SECRET.encode(), body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)


@api.post("/razorpay/create-order")
async def rzp_create_order(body: RzpOrderIn, user=Depends(get_current_user)):
    if not razorpay_client:
        raise HTTPException(503, "Razorpay not configured")

    # Determine amount server-side (never trust client)
    if body.kind == "subscription":
        plan = next((p for p in PLANS if p["plan_id"] == body.plan_id), None)
        if not plan or plan["price"] == 0:
            raise HTTPException(400, "Invalid or free plan")
        amount_inr = float(plan["price"])
        meta_extra = {"plan_id": plan["plan_id"]}
    elif body.kind == "order":
        if not body.order_id:
            raise HTTPException(400, "order_id required")
        order_doc = await db.orders.find_one({"order_id": body.order_id, "user_id": user["user_id"]}, {"_id": 0})
        if not order_doc:
            raise HTTPException(404, "Order not found")
        amount_inr = float(order_doc.get("total") or 0)
        if amount_inr <= 0:
            raise HTTPException(400, "Invalid order amount")
        meta_extra = {"order_id": body.order_id}
    else:
        raise HTTPException(400, "Invalid kind")

    amount_paise = int(round(amount_inr * 100))
    receipt = f"rcpt_{uuid.uuid4().hex[:12]}"
    rzp_order = razorpay_client.order.create({
        "amount": amount_paise,
        "currency": "INR",
        "receipt": receipt,
        "payment_capture": 1,
        "notes": {"user_id": user["user_id"], "kind": body.kind, **{k: str(v) for k, v in meta_extra.items()}},
    })
    session_token = uuid.uuid4().hex
    await db.rzp_transactions.insert_one({
        "session_token": session_token,
        "razorpay_order_id": rzp_order["id"],
        "receipt": receipt,
        "user_id": user["user_id"],
        "kind": body.kind,
        **meta_extra,
        "amount_inr": amount_inr,
        "amount_paise": amount_paise,
        "currency": "INR",
        "payment_status": "created",
        "created_at": now_utc().isoformat(),
    })
    return {
        "session_token": session_token,
        "razorpay_order_id": rzp_order["id"],
        "key_id": RAZORPAY_KEY_ID,
        "amount": amount_paise,
        "currency": "INR",
        "receipt": receipt,
        "checkout_url": f"{APP_BASE_URL}/api/razorpay/checkout/{session_token}",
        "amount_inr": amount_inr,
    }


@api.post("/razorpay/verify")
async def rzp_verify(body: RzpVerifyIn, user=Depends(get_current_user)):
    tx = await db.rzp_transactions.find_one({"razorpay_order_id": body.razorpay_order_id, "user_id": user["user_id"]}, {"_id": 0})
    if not tx:
        raise HTTPException(404, "Transaction not found")
    ok = _verify_rzp_signature(body.razorpay_order_id, body.razorpay_payment_id, body.razorpay_signature)
    if not ok:
        await db.rzp_transactions.update_one(
            {"razorpay_order_id": body.razorpay_order_id},
            {"$set": {"payment_status": "failed_signature", "updated_at": now_utc().isoformat()}},
        )
        raise HTTPException(400, "Invalid signature")
    updates = {
        "payment_status": "paid",
        "razorpay_payment_id": body.razorpay_payment_id,
        "updated_at": now_utc().isoformat(),
    }
    await db.rzp_transactions.update_one({"razorpay_order_id": body.razorpay_order_id}, {"$set": updates})
    # Upgrade user if subscription
    if tx["kind"] == "subscription" and tx.get("plan_id"):
        await db.users.update_one(
            {"user_id": user["user_id"]},
            {"$set": {"subscription": tx["plan_id"], "subscribed_at": now_utc().isoformat()}},
        )
        already = await db.payments.find_one({"razorpay_payment_id": body.razorpay_payment_id})
        if not already:
            await db.payments.insert_one({
                "payment_id": f"pay_{uuid.uuid4().hex[:10]}",
                "razorpay_payment_id": body.razorpay_payment_id,
                "razorpay_order_id": body.razorpay_order_id,
                "user_id": user["user_id"],
                "plan_id": tx["plan_id"],
                "amount": tx["amount_inr"],
                "gateway": "razorpay",
                "status": "paid",
                "created_at": now_utc().isoformat(),
            })
    elif tx["kind"] == "order" and tx.get("order_id"):
        await db.orders.update_one(
            {"order_id": tx["order_id"]},
            {"$set": {"payment_status": "paid", "payment_method": "razorpay",
                      "razorpay_payment_id": body.razorpay_payment_id}},
        )
    return {"ok": True, "kind": tx["kind"], "amount_inr": tx["amount_inr"]}


@api.get("/razorpay/status/{session_token}")
async def rzp_status(session_token: str, user=Depends(get_current_user)):
    tx = await db.rzp_transactions.find_one(
        {"session_token": session_token, "user_id": user["user_id"]},
        {"_id": 0},
    )
    if not tx:
        raise HTTPException(404, "Not found")
    return {"payment_status": tx["payment_status"], "transaction": tx}


@app.get("/api/razorpay/checkout/{session_token}")
async def rzp_checkout_page(session_token: str):
    """Serve hosted Razorpay Checkout HTML page (opened via WebBrowser on mobile,
    window.location on web). Auto-opens Razorpay modal, verifies signature server-side,
    then redirects back to the app with success/failure."""
    from fastapi.responses import HTMLResponse
    tx = await db.rzp_transactions.find_one({"session_token": session_token}, {"_id": 0})
    if not tx:
        return HTMLResponse("<h3>Invalid or expired checkout link</h3>", status_code=404)

    user_doc = await db.users.find_one({"user_id": tx["user_id"]}, {"_id": 0, "password_hash": 0})
    prefill_name = (user_doc or {}).get("name", "Cropido User")
    prefill_email = (user_doc or {}).get("email", "")
    prefill_contact = (user_doc or {}).get("phone", "") or ""
    display_amount = f"{tx['amount_inr']:.2f}"
    display_title = "Cropido Subscription" if tx["kind"] == "subscription" else "Cropido Order"
    display_desc = tx.get("plan_id") or tx.get("order_id") or "Cropido Payment"
    return_url_success = f"{APP_BASE_URL}/payment-success?session_token={session_token}&status=paid"
    return_url_cancel = f"{APP_BASE_URL}/payment-success?session_token={session_token}&status=cancelled"

    html = f"""<!doctype html>
<html><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Cropido · Secure Payment</title>
<script src="https://checkout.razorpay.com/v1/checkout.js"></script>
<style>
  body {{ margin:0; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
         background:linear-gradient(135deg,#2E7D32 0%,#1B5E20 100%); color:#fff;
         min-height:100vh; display:flex; align-items:center; justify-content:center; padding:20px; }}
  .card {{ background:#fff; color:#111827; padding:32px 24px; border-radius:24px; max-width:400px;
          width:100%; box-shadow:0 20px 60px rgba(0,0,0,0.3); text-align:center; }}
  h1 {{ margin:0; font-size:22px; letter-spacing:-0.4px; }}
  h2 {{ margin:4px 0 20px; font-size:14px; color:#4B5563; font-weight:500; }}
  .amount {{ font-size:44px; font-weight:800; color:#2E7D32; letter-spacing:-1px; }}
  .desc {{ color:#6B7280; font-size:13px; margin:4px 0 24px; }}
  .logo {{ width:56px; height:56px; border-radius:28px; background:#2E7D32; display:inline-flex;
          align-items:center; justify-content:center; margin-bottom:12px; }}
  .logo svg {{ width:28px; height:28px; }}
  .btn {{ background:#2E7D32; color:#fff; border:none; padding:14px 32px; border-radius:999px;
         font-size:15px; font-weight:700; cursor:pointer; margin-top:10px; width:100%; }}
  .btn:disabled {{ opacity:.6 }}
  .methods {{ display:flex; gap:8px; justify-content:center; margin:16px 0; }}
  .method {{ background:#F3F4F6; padding:6px 12px; border-radius:8px; font-size:11px; color:#4B5563; font-weight:600; }}
  .status {{ margin-top:16px; font-size:13px; color:#6B7280; }}
</style>
</head>
<body>
<div class="card">
  <div class="logo">
    <svg viewBox="0 0 24 24" fill="#fff"><path d="M17 8C8 10 5.9 16.17 3.82 21.34l1.89.66.95-2.3c.48.17.98.3 1.34.3C19 20 22 3 22 3c-1 2-8 2.25-13 3.25S2 11.5 2 13.5s1.75 3.75 1.75 3.75C7 8 17 8 17 8z"/></svg>
  </div>
  <h1>{display_title}</h1>
  <h2>{display_desc}</h2>
  <div class="amount">₹{display_amount}</div>
  <div class="desc">Secure payment powered by Razorpay</div>
  <div class="methods">
    <div class="method">UPI</div><div class="method">Cards</div>
    <div class="method">Netbanking</div><div class="method">Wallets</div>
  </div>
  <button class="btn" id="payBtn" onclick="pay()">Pay ₹{display_amount}</button>
  <div class="status" id="status">Ready. Test UPI: <b>success@razorpay</b> · Test card: <b>4111 1111 1111 1111</b></div>
</div>
<script>
const ORDER_ID = "{tx['razorpay_order_id']}";
const KEY_ID = "{RAZORPAY_KEY_ID}";
const AMOUNT = {tx['amount_paise']};
const SESSION_TOKEN = "{session_token}";
const RETURN_SUCCESS = "{return_url_success}";
const RETURN_CANCEL = "{return_url_cancel}";
const BACKEND = "{APP_BASE_URL}/api";

async function pay() {{
  document.getElementById('payBtn').disabled = true;
  document.getElementById('status').textContent = 'Opening secure checkout...';
  const options = {{
    key: KEY_ID,
    amount: AMOUNT,
    currency: 'INR',
    order_id: ORDER_ID,
    name: 'Cropido',
    description: '{display_desc}',
    theme: {{ color: '#2E7D32' }},
    prefill: {{
      name: {json.dumps(prefill_name)},
      email: {json.dumps(prefill_email)},
      contact: {json.dumps(prefill_contact)}
    }},
    modal: {{
      ondismiss: function() {{
        document.getElementById('status').textContent = 'Payment cancelled.';
        document.getElementById('payBtn').disabled = false;
        setTimeout(function() {{ window.location.href = RETURN_CANCEL; }}, 800);
      }}
    }},
    handler: async function(response) {{
      document.getElementById('status').textContent = 'Verifying payment...';
      try {{
        const r = await fetch(BACKEND + '/razorpay/verify-public', {{
          method: 'POST',
          headers: {{ 'Content-Type': 'application/json' }},
          body: JSON.stringify({{
            session_token: SESSION_TOKEN,
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
          }})
        }});
        const j = await r.json();
        if (r.ok && j.ok) {{
          document.getElementById('status').textContent = 'Payment successful! Redirecting...';
          setTimeout(function() {{ window.location.href = RETURN_SUCCESS; }}, 600);
        }} else {{
          document.getElementById('status').textContent = 'Verification failed: ' + (j.detail || 'Unknown');
          document.getElementById('payBtn').disabled = false;
        }}
      }} catch (e) {{
        document.getElementById('status').textContent = 'Verify error: ' + e.message;
        document.getElementById('payBtn').disabled = false;
      }}
    }}
  }};
  const rz = new Razorpay(options);
  rz.on('payment.failed', function(resp) {{
    document.getElementById('status').textContent = 'Payment failed: ' + (resp.error.description || '');
    document.getElementById('payBtn').disabled = false;
  }});
  rz.open();
}}
// Auto-open on page load
setTimeout(pay, 600);
</script>
</body></html>
"""
    return HTMLResponse(content=html)


# Public verify endpoint (called from hosted checkout page — uses session_token, not JWT)
class RzpPublicVerifyIn(BaseModel):
    session_token: str
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str


@api.post("/razorpay/verify-public")
async def rzp_verify_public(body: RzpPublicVerifyIn):
    tx = await db.rzp_transactions.find_one({"session_token": body.session_token}, {"_id": 0})
    if not tx or tx.get("razorpay_order_id") != body.razorpay_order_id:
        raise HTTPException(404, "Transaction not found")
    ok = _verify_rzp_signature(body.razorpay_order_id, body.razorpay_payment_id, body.razorpay_signature)
    if not ok:
        await db.rzp_transactions.update_one(
            {"session_token": body.session_token},
            {"$set": {"payment_status": "failed_signature", "updated_at": now_utc().isoformat()}},
        )
        raise HTTPException(400, "Invalid signature")
    await db.rzp_transactions.update_one(
        {"session_token": body.session_token},
        {"$set": {"payment_status": "paid", "razorpay_payment_id": body.razorpay_payment_id,
                  "updated_at": now_utc().isoformat()}},
    )
    if tx["kind"] == "subscription" and tx.get("plan_id"):
        await db.users.update_one(
            {"user_id": tx["user_id"]},
            {"$set": {"subscription": tx["plan_id"], "subscribed_at": now_utc().isoformat()}},
        )
        already = await db.payments.find_one({"razorpay_payment_id": body.razorpay_payment_id})
        if not already:
            await db.payments.insert_one({
                "payment_id": f"pay_{uuid.uuid4().hex[:10]}",
                "razorpay_payment_id": body.razorpay_payment_id,
                "razorpay_order_id": body.razorpay_order_id,
                "user_id": tx["user_id"], "plan_id": tx["plan_id"],
                "amount": tx["amount_inr"], "gateway": "razorpay",
                "status": "paid", "created_at": now_utc().isoformat(),
            })
    elif tx["kind"] == "order" and tx.get("order_id"):
        await db.orders.update_one(
            {"order_id": tx["order_id"]},
            {"$set": {"payment_status": "paid", "payment_method": "razorpay",
                      "razorpay_payment_id": body.razorpay_payment_id}},
        )
    return {"ok": True}


# ---------- LIVE WEATHER (Open-Meteo, no API key) ----------
@api.get("/weather")
async def get_weather(lat: float, lon: float):
    """Fetch live weather from Open-Meteo (free, no key)."""
    try:
        async with httpx.AsyncClient(timeout=8) as hc:
            r = await hc.get(
                "https://api.open-meteo.com/v1/forecast",
                params={
                    "latitude": lat, "longitude": lon,
                    "current": "temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m",
                    "daily": "weather_code,temperature_2m_max,temperature_2m_min",
                    "timezone": "auto",
                    "forecast_days": 4,
                },
            )
        j = r.json()
        cur = j.get("current", {})
        daily = j.get("daily", {})
        code_map = {
            0: ("Clear", "sunny"), 1: ("Mainly Clear", "sunny"), 2: ("Partly Cloudy", "partly-sunny"),
            3: ("Overcast", "cloudy"), 45: ("Foggy", "cloud"), 48: ("Foggy", "cloud"),
            51: ("Drizzle", "rainy"), 53: ("Drizzle", "rainy"), 55: ("Drizzle", "rainy"),
            61: ("Rain", "rainy"), 63: ("Rain", "rainy"), 65: ("Heavy Rain", "rainy"),
            71: ("Snow", "snow"), 73: ("Snow", "snow"), 75: ("Snow", "snow"),
            80: ("Rain Showers", "rainy"), 81: ("Rain Showers", "rainy"), 82: ("Rain Showers", "rainy"),
            95: ("Thunderstorm", "thunderstorm"), 96: ("Thunderstorm", "thunderstorm"), 99: ("Thunderstorm", "thunderstorm"),
        }
        cond, icon = code_map.get(int(cur.get("weather_code", 0)), ("Unknown", "partly-sunny"))
        forecast = []
        days_arr = daily.get("time", [])
        codes = daily.get("weather_code", [])
        maxs = daily.get("temperature_2m_max", [])
        for i in range(1, min(4, len(days_arr))):
            d_name = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][
                datetime.fromisoformat(days_arr[i]).weekday()
            ]
            _, d_icon = code_map.get(int(codes[i]), ("", "partly-sunny"))
            forecast.append({"day": d_name, "temp": round(maxs[i]), "icon": d_icon})
        return {
            "temp": round(cur.get("temperature_2m", 0)),
            "condition": cond,
            "humidity": round(cur.get("relative_humidity_2m", 0)),
            "wind": round(cur.get("wind_speed_10m", 0)),
            "icon": icon,
            "forecast": forecast,
        }
    except Exception as e:
        logger.warning(f"Weather fetch failed: {e}")
        raise HTTPException(502, "Weather service unavailable")


# ---------- ADMIN ----------
async def require_admin(user=Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(403, "Admin only")
    return user


@api.get("/admin/stats")
async def admin_stats(admin=Depends(require_admin)):
    users_count = await db.users.count_documents({})
    verified_count = await db.users.count_documents({"verified": True})
    farmers_count = await db.users.count_documents({"role": "farmer"})
    products_count = await db.products.count_documents({})
    crop_listings_count = await db.crop_listings.count_documents({})
    orders_count = await db.orders.count_documents({})
    posts_count = await db.community_posts.count_documents({})
    services_bookings = await db.service_bookings.count_documents({})
    eq_bookings = await db.equipment_bookings.count_documents({})
    payments_docs = await db.payments.find({"status": "paid"}, {"_id": 0, "amount": 1}).to_list(1000)
    revenue = sum(float(p.get("amount", 0)) for p in payments_docs)
    # subscription split
    plan_counts = {"free": 0, "pro_farmer": 0, "business": 0, "enterprise": 0}
    async for u in db.users.find({}, {"_id": 0, "subscription": 1}):
        plan_counts[u.get("subscription", "free")] = plan_counts.get(u.get("subscription", "free"), 0) + 1
    # recent orders
    recent_orders = await db.orders.find({}, {"_id": 0}).sort("created_at", -1).to_list(5)
    return {
        "totals": {
            "users": users_count, "verified": verified_count, "farmers": farmers_count,
            "products": products_count, "crop_listings": crop_listings_count,
            "orders": orders_count, "community_posts": posts_count,
            "service_bookings": services_bookings, "equipment_bookings": eq_bookings,
            "revenue": round(revenue, 2), "paid_transactions": len(payments_docs),
        },
        "plan_counts": plan_counts,
        "recent_orders": recent_orders,
    }


@api.get("/admin/users")
async def admin_users(admin=Depends(require_admin)):
    items = await db.users.find({}, {"_id": 0, "password_hash": 0}).sort("created_at", -1).to_list(200)
    return {"users": items}


@api.post("/admin/users/{user_id}/verify")
async def admin_verify_user(user_id: str, admin=Depends(require_admin)):
    await db.users.update_one({"user_id": user_id}, {"$set": {"verified": True, "kyc_verified": True}})
    return {"ok": True}


@api.delete("/admin/products/{product_id}")
async def admin_delete_product(product_id: str, admin=Depends(require_admin)):
    await db.products.delete_one({"product_id": product_id})
    return {"ok": True}


@api.get("/payments")
async def list_payments(user=Depends(get_current_user)):
    items = await db.payments.find({"user_id": user["user_id"]}, {"_id": 0}).sort("created_at", -1).to_list(50)
    return {"payments": items}


# ---------- PROFILE ----------
@api.put("/profile")
async def update_profile(body: Dict[str, Any], user=Depends(get_current_user)):
    allowed = {"name", "phone", "language", "bio", "farm_details", "crops_grown", "picture"}
    update = {k: v for k, v in body.items() if k in allowed}
    if update:
        await db.users.update_one({"user_id": user["user_id"]}, {"$set": update})
    fresh = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0, "password_hash": 0})
    return {"user": fresh}


# ---------- SEEDING ----------
async def seed_data():
    # Seed demo user first (idempotent)
    if not await db.users.find_one({"email": "demo@cropido.app"}):
        await db.users.insert_one({
            "user_id": "user_demo_farmer",
            "email": "demo@cropido.app",
            "password_hash": hash_pw("demo1234"),
            "name": "Demo Farmer",
            "role": "farmer",
            "phone": "+919999999999",
            "language": "en",
            "verified": True,
            "kyc_verified": False,
            "picture": None,
            "bio": "Growing crops with Cropido since 2026 🌾",
            "farm_details": {"size_acres": 12, "irrigation": "drip"},
            "crops_grown": ["Wheat", "Rice", "Sugarcane"],
            "subscription": "free",
            "created_at": now_utc().isoformat(),
        })

    # Seed admin user
    if not await db.users.find_one({"email": "admin@cropido.app"}):
        await db.users.insert_one({
            "user_id": "user_admin",
            "email": "admin@cropido.app",
            "password_hash": hash_pw("admin1234"),
            "name": "Cropido Admin",
            "role": "admin",
            "phone": "+911111111111",
            "language": "en",
            "verified": True,
            "kyc_verified": True,
            "picture": None,
            "bio": "Platform administrator",
            "farm_details": {},
            "crops_grown": [],
            "subscription": "enterprise",
            "created_at": now_utc().isoformat(),
        })

    if await db.products.count_documents({}) > 0:
        return
    logger.info("Seeding demo data...")

    products = [
        # Seeds
        {"title": "Premium Hybrid Wheat Seeds", "category": "seeds", "price": 850, "unit": "5kg pack",
         "image": "https://images.unsplash.com/photo-1625246333195-78d9c38ad449?w=600",
         "description": "High-yield rust-resistant wheat variety, ideal for Rabi season.", "stock": 120, "rating": 4.7, "reviews_count": 87},
        {"title": "Certified Basmati Rice Seeds", "category": "seeds", "price": 1200, "unit": "10kg",
         "image": "https://images.unsplash.com/photo-1568347355280-d33fdf77d42a?w=600",
         "description": "Long-grain aromatic basmati, export quality.", "stock": 80, "rating": 4.8, "reviews_count": 145},
        {"title": "Organic Tomato Seeds", "category": "seeds", "price": 320, "unit": "500g",
         "image": "https://images.unsplash.com/photo-1546470427-e26264be0b8b?w=600",
         "description": "Disease-resistant hybrid tomato seeds.", "stock": 200, "rating": 4.5, "reviews_count": 62},
        # Fertilizers
        {"title": "Urea Fertilizer 46% N", "category": "fertilizers", "price": 380, "unit": "50kg bag",
         "image": "https://images.unsplash.com/photo-1592395927644-6b74d5060fb0?w=600",
         "description": "Government subsidized urea for all crops.", "stock": 300, "rating": 4.6, "reviews_count": 210},
        {"title": "NPK 20:20:20 Fertilizer", "category": "fertilizers", "price": 1450, "unit": "25kg",
         "image": "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=600",
         "description": "Balanced NPK for foliar spray and drip irrigation.", "stock": 150, "rating": 4.7, "reviews_count": 98},
        {"title": "Vermicompost Organic", "category": "organic", "price": 420, "unit": "20kg",
         "image": "https://images.unsplash.com/photo-1618477388954-7852f32655ec?w=600",
         "description": "100% organic vermicompost for soil health.", "stock": 180, "rating": 4.9, "reviews_count": 156},
        # Pesticides
        {"title": "Bio-Neem Pesticide", "category": "pesticides", "price": 680, "unit": "1L",
         "image": "https://images.unsplash.com/photo-1523348837708-15d4a09cfac2?w=600",
         "description": "Organic neem-based pesticide, safe for beneficial insects.", "stock": 100, "rating": 4.6, "reviews_count": 74},
        {"title": "Chlorpyrifos 20 EC", "category": "pesticides", "price": 520, "unit": "1L",
         "image": "https://images.unsplash.com/photo-1611308826816-e9f7d6c30b1a?w=600",
         "description": "Broad-spectrum insecticide for major pests.", "stock": 90, "rating": 4.3, "reviews_count": 48},
        # Farm Equipment
        {"title": "Manual Sprayer 16L", "category": "equipment", "price": 2200, "unit": "piece",
         "image": "https://images.unsplash.com/photo-1592982537447-6f2a6a0c8bfb?w=600",
         "description": "Battery-operated knapsack sprayer with 16L tank.", "stock": 60, "rating": 4.5, "reviews_count": 33},
        {"title": "Drip Irrigation Kit 1 Acre", "category": "irrigation", "price": 12500, "unit": "kit",
         "image": "https://images.unsplash.com/photo-1625246333195-78d9c38ad449?w=600",
         "description": "Complete drip irrigation for 1-acre farm.", "stock": 25, "rating": 4.8, "reviews_count": 41},
        # Animal Feed
        {"title": "Cattle Feed 50kg", "category": "feed", "price": 1150, "unit": "50kg",
         "image": "https://images.unsplash.com/photo-1516467508483-a7212febe31a?w=600",
         "description": "Nutrient-rich cattle feed for high milk yield.", "stock": 200, "rating": 4.7, "reviews_count": 89},
        {"title": "Poultry Feed Starter", "category": "feed", "price": 780, "unit": "25kg",
         "image": "https://images.unsplash.com/photo-1548550023-2bdb3c5beed7?w=600",
         "description": "Balanced starter feed for chicks and broilers.", "stock": 150, "rating": 4.5, "reviews_count": 65},
    ]
    for p in products:
        p["product_id"] = f"prod_{uuid.uuid4().hex[:10]}"
        p["seller_id"] = "system"
        p["seller_name"] = "Cropido Verified Seller"
        p["created_at"] = now_utc().isoformat()
    await db.products.insert_many(products)

    crops = [
        {"crop": "Organic Basmati Rice", "category": "rice", "quantity": 50, "unit": "quintal",
         "expected_price": 3800, "location": "Karnal, Haryana", "negotiable": True,
         "image": "https://images.unsplash.com/photo-1568347355280-d33fdf77d42a?w=600",
         "description": "Premium quality, harvested last week. Certified organic.", "seller_name": "Ramesh Kumar", "seller_verified": True},
        {"crop": "Fresh Tomatoes", "category": "vegetables", "quantity": 200, "unit": "kg",
         "expected_price": 25, "location": "Nashik, Maharashtra", "negotiable": True,
         "image": "https://images.unsplash.com/photo-1546470427-e26264be0b8b?w=600",
         "description": "Farm-fresh tomatoes, Grade A quality.", "seller_name": "Suresh Patil", "seller_verified": True},
        {"crop": "Alphonso Mangoes", "category": "fruits", "quantity": 100, "unit": "kg",
         "expected_price": 380, "location": "Ratnagiri, Maharashtra", "negotiable": False,
         "image": "https://images.unsplash.com/photo-1553279768-865429fa0078?w=600",
         "description": "GI-tagged Alphonso, direct from farm.", "seller_name": "Ganesh Sawant", "seller_verified": True},
        {"crop": "Sharbati Wheat", "category": "wheat", "quantity": 300, "unit": "quintal",
         "expected_price": 2650, "location": "Sehore, Madhya Pradesh", "negotiable": True,
         "image": "https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?w=600",
         "description": "Premium Sharbati wheat, high protein content.", "seller_name": "Vijay Sharma", "seller_verified": True},
        {"crop": "Toor Dal (Arhar)", "category": "pulses", "quantity": 80, "unit": "quintal",
         "expected_price": 7200, "location": "Latur, Maharashtra", "negotiable": True,
         "image": "https://images.unsplash.com/photo-1596797038530-2c107229654b?w=600",
         "description": "Freshly harvested toor dal, ready for pickup.", "seller_name": "Anand Deshmukh", "seller_verified": False},
    ]
    for c in crops:
        c["listing_id"] = f"crop_{uuid.uuid4().hex[:10]}"
        c["seller_id"] = f"user_seed_{uuid.uuid4().hex[:6]}"
        c["status"] = "active"
        c["created_at"] = now_utc().isoformat()
    await db.crop_listings.insert_many(crops)

    equipment = [
        {"name": "Mahindra 575 Tractor", "category": "tractor", "daily_price": 1800,
         "location": "Nashik, MH", "description": "45 HP tractor with all attachments.",
         "image": "https://images.pexels.com/photos/7457180/pexels-photo-7457180.jpeg?w=600", "rating": 4.7, "owner": "Krishna Farms"},
        {"name": "John Deere 5310 Tractor", "category": "tractor", "daily_price": 2500,
         "location": "Pune, MH", "description": "55 HP premium tractor, well maintained.",
         "image": "https://images.pexels.com/photos/29465456/pexels-photo-29465456.jpeg?w=600", "rating": 4.8, "owner": "Green Fields Rental"},
        {"name": "Combine Harvester", "category": "harvester", "daily_price": 6500,
         "location": "Karnal, HR", "description": "New Holland combine, harvests 4 acres/hour.",
         "image": "https://images.unsplash.com/photo-1625246333195-78d9c38ad449?w=600", "rating": 4.9, "owner": "AgriRent India"},
        {"name": "Rotavator 7ft", "category": "rotavator", "daily_price": 1200,
         "location": "Ahmedabad, GJ", "description": "Heavy-duty rotavator for tractor mount.",
         "image": "https://images.unsplash.com/photo-1592982537447-6f2a6a0c8bfb?w=600", "rating": 4.5, "owner": "FarmTools Co."},
        {"name": "Power Tiller 12 HP", "category": "tiller", "daily_price": 900,
         "location": "Coimbatore, TN", "description": "Compact tiller for small farms.",
         "image": "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=600", "rating": 4.4, "owner": "South Agri"},
        {"name": "Cultivator 9 Tyne", "category": "cultivator", "daily_price": 700,
         "location": "Jaipur, RJ", "description": "9-tyne cultivator, tractor mounted.",
         "image": "https://images.unsplash.com/photo-1523348837708-15d4a09cfac2?w=600", "rating": 4.3, "owner": "Rajasthan Rentals"},
    ]
    for e in equipment:
        e["equipment_id"] = f"eq_{uuid.uuid4().hex[:10]}"
        e["created_at"] = now_utc().isoformat()
    await db.equipment.insert_many(equipment)

    services = [
        {"name": "Soil Testing (NPK + pH)", "category": "soil_testing", "price": 499,
         "description": "Complete soil analysis with recommendations. 3-day turnaround.",
         "provider": "AgriLab India", "rating": 4.8, "icon": "flask"},
        {"name": "Farm Consultancy — 1 hour", "category": "consultancy", "price": 799,
         "description": "1:1 consultation with agri expert for crop planning.",
         "provider": "Dr. Anil Yadav", "rating": 4.9, "icon": "person"},
        {"name": "Crop Advisory Package", "category": "advisory", "price": 1499,
         "description": "Monthly advisory with weather alerts and pest warnings.",
         "provider": "Cropido Experts", "rating": 4.7, "icon": "leaf"},
        {"name": "Pest Management Visit", "category": "pest", "price": 999,
         "description": "On-site pest scouting and IPM recommendations.",
         "provider": "PestPro Solutions", "rating": 4.6, "icon": "bug"},
        {"name": "Irrigation Planning", "category": "irrigation", "price": 1999,
         "description": "Drip/sprinkler design for your farm — includes layout.",
         "provider": "Blue Waters Engg.", "rating": 4.8, "icon": "water"},
        {"name": "Government Scheme Assistance", "category": "govt", "price": 299,
         "description": "PM-Kisan, KCC, PMFBY application help.",
         "provider": "KisanMitra", "rating": 4.5, "icon": "document-text"},
        {"name": "Crop Insurance Support", "category": "insurance", "price": 499,
         "description": "PMFBY enrollment and claim assistance.",
         "provider": "SafeHarvest Ins.", "rating": 4.6, "icon": "shield-checkmark"},
        {"name": "Financial Advisory", "category": "finance", "price": 999,
         "description": "Farm loans, KCC, credit planning.",
         "provider": "AgriCredit Advisors", "rating": 4.7, "icon": "cash"},
    ]
    for s in services:
        s["service_id"] = f"svc_{uuid.uuid4().hex[:10]}"
        s["created_at"] = now_utc().isoformat()
    await db.services.insert_many(services)

    knowledge = [
        {"title": "Complete Guide to Rabi Season Wheat Cultivation",
         "category": "guides", "author": "Dr. Rajesh Verma",
         "image": "https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?w=600",
         "excerpt": "Everything from sowing to harvesting for maximum yield.",
         "read_time": "8 min", "views": 12500},
        {"title": "PM-Kisan Samman Nidhi: How to Apply in 2026",
         "category": "schemes", "author": "Government Bureau",
         "image": "https://images.unsplash.com/photo-1560493676-04071c5f467b?w=600",
         "excerpt": "Step-by-step application process and eligibility.",
         "read_time": "5 min", "views": 45200},
        {"title": "Organic Farming: A Farmer's Success Story",
         "category": "success", "author": "Cropido Editorial",
         "image": "https://images.pexels.com/photos/17286188/pexels-photo-17286188.jpeg?w=600",
         "excerpt": "How Ramesh doubled his income switching to organic.",
         "read_time": "6 min", "views": 8900},
        {"title": "Drip Irrigation Tutorial for Small Farms",
         "category": "tutorials", "author": "AgriEngineering",
         "image": "https://images.unsplash.com/photo-1625246333195-78d9c38ad449?w=600",
         "excerpt": "Install drip irrigation in under 2 days.",
         "read_time": "10 min", "views": 6700, "is_video": True},
        {"title": "2026 Market Outlook: Top Crops to Grow",
         "category": "market", "author": "Market Analysts",
         "image": "https://images.unsplash.com/photo-1568347355280-d33fdf77d42a?w=600",
         "excerpt": "Data-driven crop recommendations for this year.",
         "read_time": "12 min", "views": 15800},
        {"title": "Pest Identification: Common Threats and Solutions",
         "category": "guides", "author": "Dr. Meena Iyer",
         "image": "https://images.unsplash.com/photo-1523348837708-15d4a09cfac2?w=600",
         "excerpt": "Recognize and treat 12 common pests.",
         "read_time": "15 min", "views": 9400},
    ]
    for k in knowledge:
        k["article_id"] = f"art_{uuid.uuid4().hex[:10]}"
        k["is_video"] = k.get("is_video", False)
        k["created_at"] = now_utc().isoformat()
    await db.knowledge.insert_many(knowledge)

    businesses = [
        {"name": "GreenLeaf Traders", "category": "traders", "location": "Pune, MH",
         "rating": 4.8, "phone": "+919876543210", "verified": True,
         "description": "Wholesale grain and pulses trader — 15 years experience.",
         "logo": "https://images.unsplash.com/photo-1560493676-04071c5f467b?w=300"},
        {"name": "Krishna AgroSupply", "category": "suppliers", "location": "Nashik, MH",
         "rating": 4.6, "phone": "+919876543211", "verified": True,
         "description": "Seeds, fertilizers, pesticides — one-stop shop.",
         "logo": "https://images.unsplash.com/photo-1592395927644-6b74d5060fb0?w=300"},
        {"name": "FarmFresh Buyers Co.", "category": "buyers", "location": "Delhi NCR",
         "rating": 4.9, "phone": "+919876543212", "verified": True,
         "description": "Bulk buyers of vegetables and fruits for retail chains.",
         "logo": "https://images.unsplash.com/photo-1546470427-e26264be0b8b?w=300"},
        {"name": "Dr. Anil Yadav — Agri Consultant", "category": "consultants", "location": "Karnal, HR",
         "rating": 4.9, "phone": "+919876543213", "verified": True,
         "description": "PhD Agronomy — 20 years consulting large farms.",
         "logo": "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=300"},
        {"name": "Tractor Dealers India", "category": "dealers", "location": "Bengaluru, KA",
         "rating": 4.5, "phone": "+919876543214", "verified": False,
         "description": "Authorized dealer for Mahindra, John Deere, TAFE.",
         "logo": "https://images.pexels.com/photos/7457180/pexels-photo-7457180.jpeg?w=300"},
        {"name": "AgriRent Solutions", "category": "service_providers", "location": "Ahmedabad, GJ",
         "rating": 4.7, "phone": "+919876543215", "verified": True,
         "description": "Farm equipment rental across Gujarat and MP.",
         "logo": "https://images.unsplash.com/photo-1592982537447-6f2a6a0c8bfb?w=300"},
    ]
    for b in businesses:
        b["business_id"] = f"biz_{uuid.uuid4().hex[:10]}"
        b["created_at"] = now_utc().isoformat()
    await db.businesses.insert_many(businesses)

    posts = [
        {"user_id": "seed_1", "user_name": "Ramesh Kumar",
         "user_picture": "https://i.pravatar.cc/150?img=13",
         "content": "Just harvested 50 quintals of organic basmati! 🌾 Best yield in 5 years. Anyone interested in bulk purchase, DM me.",
         "image": "https://images.unsplash.com/photo-1568347355280-d33fdf77d42a?w=600",
         "tags": ["basmati", "organic"], "likes_count": 87, "comments_count": 12, "shares_count": 5,
         "likes_by": [], "is_expert": False},
        {"user_id": "seed_2", "user_name": "Dr. Anil Yadav",
         "user_picture": "https://i.pravatar.cc/150?img=52",
         "content": "IMPORTANT: With recent rains, watch for fungal infections in wheat. Apply Propiconazole @ 0.1% if you see yellow rust. Better safe than sorry! 🚨",
         "image": None, "tags": ["advisory", "wheat"], "likes_count": 245, "comments_count": 38,
         "shares_count": 89, "likes_by": [], "is_expert": True},
        {"user_id": "seed_3", "user_name": "Priya Patil",
         "user_picture": "https://i.pravatar.cc/150?img=45",
         "content": "Installed drip irrigation last week — water usage down 60%! Investment recovered in 2 seasons. Highly recommend for tomato farmers. 💧",
         "image": "https://images.unsplash.com/photo-1625246333195-78d9c38ad449?w=600",
         "tags": ["drip", "success"], "likes_count": 156, "comments_count": 24, "shares_count": 18,
         "likes_by": [], "is_expert": False},
        {"user_id": "seed_4", "user_name": "Ganesh Sawant",
         "user_picture": "https://i.pravatar.cc/150?img=68",
         "content": "Alphonso season is peak now! Direct-to-consumer prices getting me 40% more than APMC. Cropido buyer network is a game-changer. 🥭",
         "image": "https://images.unsplash.com/photo-1553279768-865429fa0078?w=600",
         "tags": ["mango", "market"], "likes_count": 198, "comments_count": 45, "shares_count": 32,
         "likes_by": [], "is_expert": False},
    ]
    for p in posts:
        p["post_id"] = f"post_{uuid.uuid4().hex[:10]}"
        p["created_at"] = now_utc().isoformat()
    await db.community_posts.insert_many(posts)

    logger.info("Seed data inserted.")


# Root health
@api.get("/")
async def root():
    return {"service": "Cropido API", "status": "ok", "version": "1.0"}


app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    try:
        await db.users.create_index("email", unique=True)
        await db.users.create_index("user_id", unique=True)
        await db.user_sessions.create_index("session_token", unique=True)
        await db.products.create_index("product_id", unique=True)
    except Exception as e:
        logger.warning(f"Index creation warning: {e}")
    await seed_data()
    # Initialize MySQL engine for dual-write sync
    init_engine()


@app.on_event("shutdown")
async def shutdown():
    client.close()
