"""Cropido backend API test suite (pytest).

Covers all endpoints defined in review_request:
- auth (register/login/me/otp/forgot)
- dashboard, marketplace, cart, orders
- crops, equipment, services, community, knowledge, businesses, notifications
- ai/chat (Claude Sonnet 4.5), subscriptions, payments
- MongoDB _id exclusion verification
"""
import os
import uuid
import time
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://agri-marketplace-144.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

DEMO_EMAIL = "demo@cropido.app"
DEMO_PASSWORD = "demo1234"

# Shared state across tests
STATE = {}


def _no_mongo_id(obj):
    """Recursively assert no MongoDB `_id` in any dict."""
    if isinstance(obj, dict):
        assert "_id" not in obj, f"_id leaked in response: {list(obj.keys())}"
        for v in obj.values():
            _no_mongo_id(v)
    elif isinstance(obj, list):
        for v in obj:
            _no_mongo_id(v)


@pytest.fixture(scope="session")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def demo_auth(session):
    """Ensure the demo user exists and return (token, user)."""
    # Try login
    r = session.post(f"{API}/auth/login", json={"email": DEMO_EMAIL, "password": DEMO_PASSWORD})
    if r.status_code != 200:
        # Register demo user
        session.post(f"{API}/auth/register", json={
            "email": DEMO_EMAIL, "password": DEMO_PASSWORD, "name": "Demo Farmer", "role": "farmer"
        })
        r = session.post(f"{API}/auth/login", json={"email": DEMO_EMAIL, "password": DEMO_PASSWORD})
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    data = r.json()
    return data["token"], data["user"]


@pytest.fixture(scope="session")
def auth_headers(demo_auth):
    return {"Authorization": f"Bearer {demo_auth[0]}", "Content-Type": "application/json"}


# ---------------- HEALTH ----------------
class TestHealth:
    def test_root(self, session):
        r = session.get(f"{API}/")
        assert r.status_code == 200
        assert r.json().get("status") == "ok"


# ---------------- AUTH ----------------
class TestAuth:
    def test_register_new_user(self, session):
        email = f"TEST_{uuid.uuid4().hex[:8]}@cropido.app"
        r = session.post(f"{API}/auth/register", json={
            "email": email, "password": "pass1234", "name": "TEST User", "role": "farmer"
        })
        assert r.status_code == 200, r.text
        data = r.json()
        assert "token" in data and "user" in data
        assert data["user"]["email"] == email
        assert "password_hash" not in data["user"]
        _no_mongo_id(data)
        STATE["new_user_email"] = email

    def test_register_duplicate_rejected(self, session):
        r = session.post(f"{API}/auth/register", json={
            "email": DEMO_EMAIL, "password": DEMO_PASSWORD, "name": "Dup", "role": "farmer"
        })
        assert r.status_code == 400

    def test_login_demo(self, session, demo_auth):
        token, user = demo_auth
        assert token
        assert user["email"] == DEMO_EMAIL

    def test_login_bad_password(self, session):
        r = session.post(f"{API}/auth/login", json={"email": DEMO_EMAIL, "password": "wrong"})
        assert r.status_code == 401

    def test_me(self, session, auth_headers):
        r = session.get(f"{API}/auth/me", headers=auth_headers)
        assert r.status_code == 200
        u = r.json()["user"]
        assert u["email"] == DEMO_EMAIL
        _no_mongo_id(r.json())

    def test_me_unauthenticated(self, session):
        r = session.get(f"{API}/auth/me")
        assert r.status_code == 401

    def test_otp_send_and_verify(self, session):
        phone = f"9{uuid.uuid4().int % 1000000000:09d}"
        r = session.post(f"{API}/auth/otp/send", json={"phone": phone})
        assert r.status_code == 200 and r.json().get("ok") is True
        r = session.post(f"{API}/auth/otp/verify", json={
            "phone": phone, "otp": "123456", "name": "OTP Tester", "role": "farmer"
        })
        assert r.status_code == 200
        data = r.json()
        assert "token" in data and data["user"]["phone"] == phone
        _no_mongo_id(data)

    def test_otp_wrong_code(self, session):
        phone = f"9{uuid.uuid4().int % 1000000000:09d}"
        session.post(f"{API}/auth/otp/send", json={"phone": phone})
        r = session.post(f"{API}/auth/otp/verify", json={"phone": phone, "otp": "000000"})
        assert r.status_code == 401

    def test_forgot_password_dev_code(self, session):
        r = session.post(f"{API}/auth/forgot-password", json={"email": DEMO_EMAIL})
        assert r.status_code == 200
        data = r.json()
        assert "dev_code" in data
        assert len(data["dev_code"]) >= 6


# ---------------- DASHBOARD ----------------
class TestDashboard:
    def test_dashboard(self, session, auth_headers):
        r = session.get(f"{API}/dashboard", headers=auth_headers)
        assert r.status_code == 200
        d = r.json()
        for key in ("weather", "market_prices", "featured_products", "trending_crops",
                    "nearby_services", "news", "recommendations"):
            assert key in d, f"missing dashboard key: {key}"
        assert len(d["featured_products"]) > 0
        assert len(d["market_prices"]) >= 3
        _no_mongo_id(d)


# ---------------- PRODUCTS ----------------
class TestProducts:
    def test_list_products_all(self, session):
        r = session.get(f"{API}/products")
        assert r.status_code == 200
        products = r.json()["products"]
        assert len(products) >= 10
        STATE["sample_product_id"] = products[0]["product_id"]
        _no_mongo_id(r.json())

    def test_list_products_seeds(self, session):
        r = session.get(f"{API}/products", params={"category": "seeds"})
        assert r.status_code == 200
        products = r.json()["products"]
        assert len(products) >= 1
        assert all(p["category"] == "seeds" for p in products)

    def test_get_product_by_id(self, session):
        pid = STATE.get("sample_product_id")
        assert pid, "sample product id missing"
        r = session.get(f"{API}/products/{pid}")
        assert r.status_code == 200
        data = r.json()
        assert data["product"]["product_id"] == pid
        assert "reviews" in data
        _no_mongo_id(data)

    def test_get_product_404(self, session):
        r = session.get(f"{API}/products/nonexistent_prod_xyz")
        assert r.status_code == 404


# ---------------- CART & ORDERS ----------------
class TestCartOrders:
    def test_cart_add_get_delete(self, session, auth_headers):
        pid = STATE.get("sample_product_id")
        r = session.post(f"{API}/cart/add", json={"product_id": pid, "quantity": 2}, headers=auth_headers)
        assert r.status_code == 200

        r = session.get(f"{API}/cart", headers=auth_headers)
        assert r.status_code == 200
        cart = r.json()["cart"]
        assert any(c["product_id"] == pid and c["quantity"] == 2 for c in cart)
        _no_mongo_id(r.json())

        r = session.delete(f"{API}/cart/{pid}", headers=auth_headers)
        assert r.status_code == 200

        r = session.get(f"{API}/cart", headers=auth_headers)
        assert all(c["product_id"] != pid for c in r.json()["cart"])

    def test_order_create_empties_cart(self, session, auth_headers):
        pid = STATE.get("sample_product_id")
        # add to cart first
        session.post(f"{API}/cart/add", json={"product_id": pid, "quantity": 1}, headers=auth_headers)
        r = session.post(f"{API}/orders", json={
            "items": [{"product_id": pid, "price": 850, "quantity": 1, "title": "TEST"}],
            "address": "TEST Address, City", "payment_method": "cod"
        }, headers=auth_headers)
        assert r.status_code == 200, r.text
        order = r.json()["order"]
        assert order["total"] == 850
        assert order["status"] == "confirmed"
        _no_mongo_id(r.json())

        # cart should be empty
        r = session.get(f"{API}/cart", headers=auth_headers)
        assert r.json()["cart"] == []

    def test_list_orders(self, session, auth_headers):
        r = session.get(f"{API}/orders", headers=auth_headers)
        assert r.status_code == 200
        orders = r.json()["orders"]
        assert len(orders) >= 1
        _no_mongo_id(r.json())


# ---------------- CROPS ----------------
class TestCrops:
    def test_list_crops(self, session):
        r = session.get(f"{API}/crops")
        assert r.status_code == 200
        listings = r.json()["listings"]
        assert len(listings) >= 3
        _no_mongo_id(r.json())

    def test_create_crop(self, session, auth_headers):
        r = session.post(f"{API}/crops", json={
            "crop": "TEST Wheat", "category": "wheat", "quantity": 10, "unit": "quintal",
            "expected_price": 2500, "location": "TEST City", "negotiable": True,
            "description": "TEST listing"
        }, headers=auth_headers)
        assert r.status_code == 200, r.text
        assert r.json()["listing"]["crop"] == "TEST Wheat"


# ---------------- EQUIPMENT ----------------
class TestEquipment:
    def test_list_and_book_equipment(self, session, auth_headers):
        r = session.get(f"{API}/equipment")
        assert r.status_code == 200
        eq = r.json()["equipment"]
        assert len(eq) >= 3
        _no_mongo_id(r.json())
        eq_id = eq[0]["equipment_id"]

        r = session.post(f"{API}/equipment/bookings", json={
            "equipment_id": eq_id, "start_date": "2026-02-01", "end_date": "2026-02-03"
        }, headers=auth_headers)
        assert r.status_code == 200, r.text
        b = r.json()["booking"]
        assert b["equipment_id"] == eq_id
        assert b["status"] == "confirmed"


# ---------------- SERVICES ----------------
class TestServices:
    def test_list_and_book_service(self, session, auth_headers):
        r = session.get(f"{API}/services")
        assert r.status_code == 200
        svcs = r.json()["services"]
        assert len(svcs) >= 3
        _no_mongo_id(r.json())
        sid = svcs[0]["service_id"]

        r = session.post(f"{API}/services/bookings", json={
            "service_id": sid, "date": "2026-02-10", "notes": "TEST booking"
        }, headers=auth_headers)
        assert r.status_code == 200, r.text
        assert r.json()["booking"]["service_id"] == sid


# ---------------- COMMUNITY ----------------
class TestCommunity:
    def test_list_posts_feed(self, session):
        r = session.get(f"{API}/community/posts", params={"tab": "feed"})
        assert r.status_code == 200
        posts = r.json()["posts"]
        assert len(posts) >= 1
        STATE["seed_post_id"] = posts[0]["post_id"]
        _no_mongo_id(r.json())

    def test_create_post(self, session, auth_headers):
        r = session.post(f"{API}/community/posts", json={
            "content": "TEST post from pytest", "tags": ["test"]
        }, headers=auth_headers)
        assert r.status_code == 200
        pid = r.json()["post"]["post_id"]
        STATE["created_post_id"] = pid

    def test_like_toggle(self, session, auth_headers):
        pid = STATE["created_post_id"]
        r1 = session.post(f"{API}/community/posts/{pid}/like", headers=auth_headers)
        assert r1.status_code == 200
        assert r1.json()["liked"] is True
        assert r1.json()["likes_count"] == 1
        r2 = session.post(f"{API}/community/posts/{pid}/like", headers=auth_headers)
        assert r2.json()["liked"] is False
        assert r2.json()["likes_count"] == 0


# ---------------- KNOWLEDGE / BUSINESSES ----------------
class TestKnowledge:
    def test_list_knowledge(self, session):
        r = session.get(f"{API}/knowledge")
        assert r.status_code == 200
        arts = r.json()["articles"]
        assert len(arts) >= 3
        _no_mongo_id(r.json())


class TestBusinesses:
    def test_list_businesses(self, session):
        r = session.get(f"{API}/businesses")
        assert r.status_code == 200
        biz = r.json()["businesses"]
        assert len(biz) >= 3
        _no_mongo_id(r.json())


# ---------------- NOTIFICATIONS ----------------
class TestNotifications:
    def test_notifications_seeds_on_first_call(self, session, auth_headers):
        r = session.get(f"{API}/notifications", headers=auth_headers)
        assert r.status_code == 200
        notifs = r.json()["notifications"]
        assert len(notifs) >= 1
        _no_mongo_id(r.json())


# ---------------- AI CHAT ----------------
class TestAI:
    def test_ai_chat_multi_turn(self, session, auth_headers):
        sid = f"pytest_{uuid.uuid4().hex[:8]}"
        r = session.post(f"{API}/ai/chat", json={
            "session_id": sid,
            "message": "In 1-2 sentences: what is the best month to sow wheat in North India?",
            "language": "en"
        }, headers=auth_headers, timeout=60)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "reply" in data and len(data["reply"]) > 0
        # Confirm not a canned failure
        assert not data["reply"].lower().startswith("i apologize"), f"AI errored: {data['reply']}"
        STATE["ai_reply1"] = data["reply"]

        # multi-turn
        r2 = session.post(f"{API}/ai/chat", json={
            "session_id": sid,
            "message": "And which fertilizer for that crop?",
            "language": "en"
        }, headers=auth_headers, timeout=60)
        assert r2.status_code == 200
        assert len(r2.json()["reply"]) > 0


# ---------------- SUBSCRIPTIONS / PAYMENTS ----------------
class TestSubscriptions:
    def test_list_plans(self, session, auth_headers):
        r = session.get(f"{API}/subscriptions/plans", headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        assert len(data["plans"]) == 4
        plan_ids = [p["plan_id"] for p in data["plans"]]
        for pid in ("free", "pro_farmer", "business", "enterprise"):
            assert pid in plan_ids

    def test_subscribe_pro_farmer(self, session, auth_headers):
        r = session.post(f"{API}/subscriptions/subscribe",
                         json={"plan_id": "pro_farmer"}, headers=auth_headers)
        assert r.status_code == 200
        assert r.json()["plan"]["plan_id"] == "pro_farmer"

        # Verify user upgraded
        me = session.get(f"{API}/auth/me", headers=auth_headers).json()["user"]
        assert me["subscription"] == "pro_farmer"

    def test_subscribe_invalid_plan(self, session, auth_headers):
        r = session.post(f"{API}/subscriptions/subscribe",
                         json={"plan_id": "invalid_xyz"}, headers=auth_headers)
        assert r.status_code == 404

    def test_list_payments(self, session, auth_headers):
        r = session.get(f"{API}/payments", headers=auth_headers)
        assert r.status_code == 200
        pays = r.json()["payments"]
        assert len(pays) >= 1
        assert any(p["plan_id"] == "pro_farmer" and p["status"] == "paid" for p in pays)
        _no_mongo_id(r.json())
