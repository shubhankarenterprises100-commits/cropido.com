"""Cropido backend tests — covers new features (Weather, Stripe, Razorpay, Admin) and regression."""
import hashlib
import hmac
import os
import re

import pytest
import requests

BASE_URL = os.environ.get(
    "EXPO_PUBLIC_BACKEND_URL",
    "https://agri-marketplace-144.preview.emergentagent.com",
).rstrip("/")

RAZORPAY_KEY_ID = "rzp_test_T8dp0FhJUKqtqK"
RAZORPAY_KEY_SECRET = "M2H4LNpoaWu1usEuxPPvPkQ7"


def _rzp_sig(order_id: str, payment_id: str, secret: str = RAZORPAY_KEY_SECRET) -> str:
    return hmac.new(
        secret.encode(),
        f"{order_id}|{payment_id}".encode(),
        hashlib.sha256,
    ).hexdigest()

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

# ---------- RAZORPAY (India: UPI, cards, netbanking, wallets) ----------
class TestRazorpayCreateOrder:
    """POST /api/razorpay/create-order"""

    def test_create_subscription_order_pro_farmer(self, api, demo_token):
        r = api.post(
            f"{BASE_URL}/api/razorpay/create-order",
            headers=h(demo_token),
            json={"kind": "subscription", "plan_id": "pro_farmer"},
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert "_id" not in d
        assert d["key_id"] == RAZORPAY_KEY_ID
        assert d["currency"] == "INR"
        assert d["amount"] == 29900  # ₹299 in paise
        assert d["amount_inr"] == 299
        assert d["razorpay_order_id"].startswith("order_"), d["razorpay_order_id"]
        assert isinstance(d["session_token"], str) and len(d["session_token"]) >= 16
        assert d["checkout_url"].endswith(f"/api/razorpay/checkout/{d['session_token']}")

        # Verify rzp_transactions record via status endpoint (indirect DB check)
        s = api.get(
            f"{BASE_URL}/api/razorpay/status/{d['session_token']}",
            headers=h(demo_token),
        )
        assert s.status_code == 200
        sdata = s.json()
        assert sdata["payment_status"] == "created"
        assert "_id" not in sdata
        tx = sdata["transaction"]
        assert "_id" not in tx
        assert tx["razorpay_order_id"] == d["razorpay_order_id"]
        assert tx["amount_paise"] == 29900
        assert tx["kind"] == "subscription"
        assert tx["plan_id"] == "pro_farmer"

        # Stash for verify tests via pytest namespace-like class attr
        TestRazorpayCreateOrder._sub_order = d

    def test_create_order_free_plan_rejected(self, api, demo_token):
        r = api.post(
            f"{BASE_URL}/api/razorpay/create-order",
            headers=h(demo_token),
            json={"kind": "subscription", "plan_id": "free"},
        )
        assert r.status_code == 400, r.text

    def test_create_order_invalid_plan_rejected(self, api, demo_token):
        r = api.post(
            f"{BASE_URL}/api/razorpay/create-order",
            headers=h(demo_token),
            json={"kind": "subscription", "plan_id": "does_not_exist"},
        )
        assert r.status_code == 400

    def test_create_order_no_auth(self, api):
        r = api.post(
            f"{BASE_URL}/api/razorpay/create-order",
            json={"kind": "subscription", "plan_id": "pro_farmer"},
        )
        assert r.status_code in (401, 403)

    def test_create_order_marketplace_missing(self, api, demo_token):
        r = api.post(
            f"{BASE_URL}/api/razorpay/create-order",
            headers=h(demo_token),
            json={"kind": "order", "order_id": "ord_does_not_exist_xxx"},
        )
        assert r.status_code == 404

    def test_create_order_marketplace_success(self, api, demo_token):
        # Create a real order first
        order_body = {
            "items": [{"product_id": "TEST_p1", "name": "TEST_prod", "price": 150, "quantity": 2}],
            "address": "TEST_addr, Test, 000000",
            "payment_method": "razorpay",
        }
        oc = api.post(f"{BASE_URL}/api/orders", headers=h(demo_token), json=order_body)
        assert oc.status_code == 200, oc.text
        order = oc.json()["order"]
        assert order["total"] == 300.0

        r = api.post(
            f"{BASE_URL}/api/razorpay/create-order",
            headers=h(demo_token),
            json={"kind": "order", "order_id": order["order_id"]},
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["amount"] == 30000  # ₹300 in paise
        assert d["razorpay_order_id"].startswith("order_")
        assert d["key_id"] == RAZORPAY_KEY_ID


class TestRazorpayStatus:
    def test_status_unknown_token(self, api, demo_token):
        r = api.get(
            f"{BASE_URL}/api/razorpay/status/nonexistent_token_xyz",
            headers=h(demo_token),
        )
        assert r.status_code == 404

    def test_status_no_auth(self, api):
        r = api.get(f"{BASE_URL}/api/razorpay/status/anytoken")
        assert r.status_code in (401, 403)

    def test_status_wrong_user_returns_404(self, api, demo_token, admin_token):
        # Create with demo, query with admin (different user_id)
        c = api.post(
            f"{BASE_URL}/api/razorpay/create-order",
            headers=h(demo_token),
            json={"kind": "subscription", "plan_id": "pro_farmer"},
        )
        assert c.status_code == 200
        tok = c.json()["session_token"]
        r = api.get(f"{BASE_URL}/api/razorpay/status/{tok}", headers=h(admin_token))
        assert r.status_code == 404


class TestRazorpayCheckoutPage:
    """GET /api/razorpay/checkout/{session_token} — PUBLIC HTML page."""

    def test_checkout_html_public(self, api, demo_token):
        c = api.post(
            f"{BASE_URL}/api/razorpay/create-order",
            headers=h(demo_token),
            json={"kind": "subscription", "plan_id": "pro_farmer"},
        )
        assert c.status_code == 200
        tok = c.json()["session_token"]
        oid = c.json()["razorpay_order_id"]

        # Note: no auth header
        s = requests.Session()
        r = s.get(f"{BASE_URL}/api/razorpay/checkout/{tok}")
        assert r.status_code == 200, r.text
        assert "text/html" in r.headers.get("content-type", "").lower()
        body = r.text
        assert "checkout.razorpay.com/v1/checkout.js" in body
        assert RAZORPAY_KEY_ID in body
        assert oid in body

    def test_checkout_html_unknown_token(self, api):
        s = requests.Session()
        r = s.get(f"{BASE_URL}/api/razorpay/checkout/definitely_not_a_token")
        assert r.status_code == 404


class TestRazorpayVerify:
    """POST /api/razorpay/verify + /verify-public — signature validation."""

    @pytest.fixture()
    def fresh_sub_order(self, api, demo_token):
        r = api.post(
            f"{BASE_URL}/api/razorpay/create-order",
            headers=h(demo_token),
            json={"kind": "subscription", "plan_id": "pro_farmer"},
        )
        assert r.status_code == 200
        return r.json()

    def test_verify_wrong_signature_returns_400(self, api, demo_token, fresh_sub_order):
        payload = {
            "razorpay_order_id": fresh_sub_order["razorpay_order_id"],
            "razorpay_payment_id": "pay_TestFake123",
            "razorpay_signature": "0" * 64,
        }
        r = api.post(f"{BASE_URL}/api/razorpay/verify", headers=h(demo_token), json=payload)
        assert r.status_code == 400, r.text

        # Status should now be failed_signature
        s = api.get(
            f"{BASE_URL}/api/razorpay/status/{fresh_sub_order['session_token']}",
            headers=h(demo_token),
        )
        assert s.status_code == 200
        assert s.json()["payment_status"] == "failed_signature"

    def test_verify_valid_signature_upgrades_subscription(self, api, demo_token, fresh_sub_order):
        order_id = fresh_sub_order["razorpay_order_id"]
        payment_id = "pay_TestFake123"
        sig = _rzp_sig(order_id, payment_id)
        r = api.post(
            f"{BASE_URL}/api/razorpay/verify",
            headers=h(demo_token),
            json={
                "razorpay_order_id": order_id,
                "razorpay_payment_id": payment_id,
                "razorpay_signature": sig,
            },
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["ok"] is True
        assert d["kind"] == "subscription"
        assert d["amount_inr"] == 299
        assert "_id" not in d

        # Status paid
        s = api.get(
            f"{BASE_URL}/api/razorpay/status/{fresh_sub_order['session_token']}",
            headers=h(demo_token),
        )
        assert s.status_code == 200
        sdata = s.json()
        assert sdata["payment_status"] == "paid"
        assert "_id" not in sdata["transaction"]
        assert sdata["transaction"].get("razorpay_payment_id") == payment_id

        # Subscription upgraded on user
        me = api.get(f"{BASE_URL}/api/auth/me", headers=h(demo_token))
        assert me.status_code == 200
        me_data = me.json()
        # /auth/me may return {"user": {...}} wrapper or flat user object
        me_user = me_data.get("user", me_data)
        assert me_user.get("subscription") == "pro_farmer"

        # Payment record logged (no _id leak)
        pays = api.get(f"{BASE_URL}/api/payments", headers=h(demo_token))
        assert pays.status_code == 200
        pdata = pays.json()
        assert "_id" not in pdata
        found = [p for p in pdata.get("payments", [])
                 if p.get("razorpay_payment_id") == payment_id]
        assert len(found) >= 1
        assert "_id" not in found[0]
        assert found[0]["gateway"] == "razorpay"
        assert found[0]["status"] == "paid"

    def test_verify_no_auth(self, api, fresh_sub_order):
        r = api.post(
            f"{BASE_URL}/api/razorpay/verify",
            json={
                "razorpay_order_id": fresh_sub_order["razorpay_order_id"],
                "razorpay_payment_id": "pay_TestFake123",
                "razorpay_signature": "0" * 64,
            },
        )
        assert r.status_code in (401, 403)

    def test_verify_public_wrong_signature(self, api, demo_token, fresh_sub_order):
        r = requests.post(
            f"{BASE_URL}/api/razorpay/verify-public",
            json={
                "session_token": fresh_sub_order["session_token"],
                "razorpay_order_id": fresh_sub_order["razorpay_order_id"],
                "razorpay_payment_id": "pay_TestFake123",
                "razorpay_signature": "deadbeef" * 8,
            },
        )
        assert r.status_code == 400, r.text

    def test_verify_public_valid_signature(self, api, demo_token, fresh_sub_order):
        order_id = fresh_sub_order["razorpay_order_id"]
        payment_id = "pay_TestFakePub999"
        sig = _rzp_sig(order_id, payment_id)
        r = requests.post(
            f"{BASE_URL}/api/razorpay/verify-public",
            json={
                "session_token": fresh_sub_order["session_token"],
                "razorpay_order_id": order_id,
                "razorpay_payment_id": payment_id,
                "razorpay_signature": sig,
            },
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("ok") is True
        assert "_id" not in d

        # Verify status via authenticated status endpoint
        s = api.get(
            f"{BASE_URL}/api/razorpay/status/{fresh_sub_order['session_token']}",
            headers=h(demo_token),
        )
        assert s.status_code == 200
        assert s.json()["payment_status"] == "paid"


# ---------- No MongoDB _id leaks across new endpoints ----------
class TestRazorpayNoIdLeak:
    def test_no_id_in_create_and_status(self, api, demo_token):
        c = api.post(
            f"{BASE_URL}/api/razorpay/create-order",
            headers=h(demo_token),
            json={"kind": "subscription", "plan_id": "pro_farmer"},
        )
        assert c.status_code == 200
        raw = c.text
        assert '"_id"' not in raw

        s = api.get(
            f"{BASE_URL}/api/razorpay/status/{c.json()['session_token']}",
            headers=h(demo_token),
        )
        assert s.status_code == 200
        assert '"_id"' not in s.text

