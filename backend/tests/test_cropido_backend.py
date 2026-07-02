"""Cropido backend tests — covers new features (Weather, Stripe, Admin) and regression."""
import os
import pytest
import requests

BASE_URL = os.environ.get(
    "EXPO_PUBLIC_BACKEND_URL",
    "https://agri-marketplace-144.preview.emergentagent.com",
).rstrip("/")

DEMO_EMAIL = "demo@cropido.app"
DEMO_PASS = "demo1234"
ADMIN_EMAIL = "admin@cropido.app"
ADMIN_PASS = "admin1234"


# ---------- Fixtures ----------
@pytest.fixture(scope="session")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def demo_token(api):
    r = api.post(f"{BASE_URL}/api/auth/login",
                 json={"email": DEMO_EMAIL, "password": DEMO_PASS})
    assert r.status_code == 200, f"demo login failed: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="session")
def admin_token(api):
    r = api.post(f"{BASE_URL}/api/auth/login",
                 json={"email": ADMIN_EMAIL, "password": ADMIN_PASS})
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    data = r.json()
    assert data["user"]["role"] == "admin"
    return data["token"]


def h(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# ---------- Health ----------
class TestHealth:
    def test_root(self, api):
        r = api.get(f"{BASE_URL}/api/")
        assert r.status_code == 200
        assert r.json().get("status") == "ok"


# ---------- Weather (Open-Meteo, public) ----------
class TestWeather:
    def test_weather_mumbai(self, api):
        r = api.get(f"{BASE_URL}/api/weather", params={"lat": 19.076, "lon": 72.877})
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ("temp", "condition", "humidity", "wind", "icon", "forecast"):
            assert k in d, f"missing {k}"
        assert isinstance(d["temp"], (int, float))
        assert isinstance(d["forecast"], list)
        # forecast items shape
        if d["forecast"]:
            f0 = d["forecast"][0]
            assert set(f0.keys()) >= {"day", "temp", "icon"}


# ---------- Auth regression ----------
class TestAuth:
    def test_demo_login_returns_user(self, api):
        r = api.post(f"{BASE_URL}/api/auth/login",
                     json={"email": DEMO_EMAIL, "password": DEMO_PASS})
        assert r.status_code == 200
        d = r.json()
        assert "token" in d and "user" in d
        assert d["user"]["email"] == DEMO_EMAIL
        assert "password_hash" not in d["user"]
        assert "_id" not in d["user"]

    def test_invalid_login(self, api):
        r = api.post(f"{BASE_URL}/api/auth/login",
                     json={"email": DEMO_EMAIL, "password": "wrong"})
        assert r.status_code == 401

    def test_me(self, api, demo_token):
        r = api.get(f"{BASE_URL}/api/auth/me", headers=h(demo_token))
        assert r.status_code == 200
        assert r.json()["user"]["email"] == DEMO_EMAIL


# ---------- Stripe Payments ----------
class TestStripePayments:
    def test_checkout_subscription_returns_stripe_url(self, api, demo_token):
        r = api.post(
            f"{BASE_URL}/api/payments/checkout/subscription",
            headers=h(demo_token),
            json={"plan_id": "pro_farmer",
                  "origin_url": "https://agri-marketplace-144.preview.emergentagent.com"},
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert "url" in d and "session_id" in d
        assert "checkout.stripe.com" in d["url"], f"expected real Stripe URL, got {d['url']}"
        # persist session_id for status test
        TestStripePayments.sub_session_id = d["session_id"]

    def test_checkout_subscription_invalid_plan(self, api, demo_token):
        r = api.post(
            f"{BASE_URL}/api/payments/checkout/subscription",
            headers=h(demo_token),
            json={"plan_id": "free",
                  "origin_url": "https://agri-marketplace-144.preview.emergentagent.com"},
        )
        assert r.status_code == 400

    def test_checkout_subscription_requires_auth(self, api):
        r = api.post(
            f"{BASE_URL}/api/payments/checkout/subscription",
            json={"plan_id": "pro_farmer",
                  "origin_url": "https://agri-marketplace-144.preview.emergentagent.com"},
        )
        assert r.status_code == 401

    def test_checkout_order_returns_stripe_url(self, api, demo_token):
        r = api.post(
            f"{BASE_URL}/api/payments/checkout/order",
            headers=h(demo_token),
            json={"order_id": "TEST_ord_123", "amount": 500.0,
                  "origin_url": "https://agri-marketplace-144.preview.emergentagent.com"},
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert "url" in d and "checkout.stripe.com" in d["url"]
        assert "session_id" in d

    def test_payment_status_pending(self, api, demo_token):
        sid = getattr(TestStripePayments, "sub_session_id", None)
        assert sid, "sub_session_id not set from prior test"
        r = api.get(f"{BASE_URL}/api/payments/status/{sid}", headers=h(demo_token))
        assert r.status_code == 200, r.text
        d = r.json()
        assert "payment_status" in d
        # Stripe unpaid session returns 'unpaid' or 'pending'
        assert d["payment_status"] in {"pending", "unpaid", "no_payment_required"}
        tx = d.get("transaction", {})
        assert "_id" not in tx
        assert tx.get("kind") == "subscription"
        assert tx.get("plan_id") == "pro_farmer"

    def test_payment_status_unknown_session(self, api, demo_token):
        r = api.get(f"{BASE_URL}/api/payments/status/cs_nonexistent_xyz",
                    headers=h(demo_token))
        assert r.status_code == 404


# ---------- Admin ----------
class TestAdmin:
    def test_admin_stats_forbidden_for_non_admin(self, api, demo_token):
        r = api.get(f"{BASE_URL}/api/admin/stats", headers=h(demo_token))
        assert r.status_code == 403

    def test_admin_stats_requires_auth(self, api):
        r = api.get(f"{BASE_URL}/api/admin/stats")
        assert r.status_code == 401

    def test_admin_stats(self, api, admin_token):
        r = api.get(f"{BASE_URL}/api/admin/stats", headers=h(admin_token))
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ("totals", "plan_counts", "recent_orders"):
            assert k in d
        totals = d["totals"]
        for k in ("users", "verified", "farmers", "products", "crop_listings",
                  "orders", "community_posts", "revenue", "paid_transactions"):
            assert k in totals, f"missing totals.{k}"
        assert isinstance(totals["users"], int) and totals["users"] >= 2
        # No mongo _id anywhere
        for o in d["recent_orders"]:
            assert "_id" not in o
        # plan_counts must include known plans
        for p in ("free", "pro_farmer", "business", "enterprise"):
            assert p in d["plan_counts"]

    def test_admin_users_list(self, api, admin_token):
        r = api.get(f"{BASE_URL}/api/admin/users", headers=h(admin_token))
        assert r.status_code == 200
        users = r.json()["users"]
        assert isinstance(users, list) and len(users) >= 2
        for u in users:
            assert "_id" not in u
            assert "password_hash" not in u
            assert "user_id" in u and "email" in u

    def test_admin_verify_user(self, api, admin_token):
        # find demo user id
        r = api.get(f"{BASE_URL}/api/admin/users", headers=h(admin_token))
        assert r.status_code == 200
        demo = next((u for u in r.json()["users"] if u["email"] == DEMO_EMAIL), None)
        assert demo is not None
        r2 = api.post(
            f"{BASE_URL}/api/admin/users/{demo['user_id']}/verify",
            headers=h(admin_token),
        )
        assert r2.status_code == 200
        # verify persistence
        r3 = api.get(f"{BASE_URL}/api/admin/users", headers=h(admin_token))
        updated = next(u for u in r3.json()["users"] if u["email"] == DEMO_EMAIL)
        assert updated.get("verified") is True
        assert updated.get("kyc_verified") is True

    def test_admin_delete_product(self, api, admin_token):
        # Create a product as admin, then delete it
        create = api.post(
            f"{BASE_URL}/api/products",
            headers=h(admin_token),
            json={"title": "TEST_admin_del", "category": "seeds", "price": 10.0,
                  "unit": "kg", "description": "test", "stock": 1},
        )
        assert create.status_code == 200
        pid = create.json()["product"]["product_id"]
        # Verify exists
        g = api.get(f"{BASE_URL}/api/products/{pid}")
        assert g.status_code == 200
        # Delete
        d = api.delete(f"{BASE_URL}/api/admin/products/{pid}", headers=h(admin_token))
        assert d.status_code == 200
        # Verify gone
        g2 = api.get(f"{BASE_URL}/api/products/{pid}")
        assert g2.status_code == 404

    def test_admin_endpoints_forbidden_for_non_admin(self, api, demo_token):
        r = api.get(f"{BASE_URL}/api/admin/users", headers=h(demo_token))
        assert r.status_code == 403


# ---------- Regression on existing endpoints ----------
class TestRegression:
    def test_dashboard(self, api, demo_token):
        r = api.get(f"{BASE_URL}/api/dashboard", headers=h(demo_token))
        assert r.status_code == 200
        d = r.json()
        for k in ("weather", "market_prices", "featured_products", "trending_crops",
                  "nearby_services", "news", "recommendations"):
            assert k in d

    def test_products_list(self, api):
        r = api.get(f"{BASE_URL}/api/products")
        assert r.status_code == 200
        assert len(r.json()["products"]) > 0

    def test_crops_list(self, api):
        r = api.get(f"{BASE_URL}/api/crops")
        assert r.status_code == 200

    def test_equipment_list(self, api):
        r = api.get(f"{BASE_URL}/api/equipment")
        assert r.status_code == 200
        assert len(r.json()["equipment"]) > 0

    def test_services_list(self, api):
        r = api.get(f"{BASE_URL}/api/services")
        assert r.status_code == 200

    def test_community_posts(self, api):
        r = api.get(f"{BASE_URL}/api/community/posts")
        assert r.status_code == 200

    def test_knowledge_list(self, api):
        r = api.get(f"{BASE_URL}/api/knowledge")
        assert r.status_code == 200

    def test_businesses_list(self, api):
        r = api.get(f"{BASE_URL}/api/businesses")
        assert r.status_code == 200

    def test_notifications(self, api, demo_token):
        r = api.get(f"{BASE_URL}/api/notifications", headers=h(demo_token))
        assert r.status_code == 200

    def test_subscriptions_plans(self, api, demo_token):
        r = api.get(f"{BASE_URL}/api/subscriptions/plans", headers=h(demo_token))
        assert r.status_code == 200
        d = r.json()
        assert "plans" in d and "current" in d
        assert len(d["plans"]) >= 4

    def test_payments_list(self, api, demo_token):
        r = api.get(f"{BASE_URL}/api/payments", headers=h(demo_token))
        assert r.status_code == 200
        assert "payments" in r.json()

    def test_ai_chat(self, api, demo_token):
        r = api.post(
            f"{BASE_URL}/api/ai/chat",
            headers=h(demo_token),
            json={"session_id": "test_reg", "message": "Say hi in one word", "language": "en"},
            timeout=30,
        )
        assert r.status_code == 200
        assert "reply" in r.json() and len(r.json()["reply"]) > 0
