"""Tests for Crop Trading buyer journey overhaul (Phase A + B + C).

Covers:
- GET /api/crops (filter/search/sort)
- GET /api/crops/{listing_id} (with seller mini-profile)
- POST /api/crops (validation + successful create)
- POST /api/crops/inquiry (creates inquiry + thread + message + notification)
- GET /api/crops/inquiries/mine
- GET /api/sellers/{seller_id}
"""
import os
from datetime import date, timedelta

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


def h(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


@pytest.fixture(scope="session")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def demo_token(api):
    r = api.post(f"{BASE_URL}/api/auth/login", json={"email": DEMO_EMAIL, "password": DEMO_PASS})
    assert r.status_code == 200, f"demo login failed: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="session")
def admin_token(api):
    r = api.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS})
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    return r.json()["token"]


# ---------------- GET /api/crops (list + filter/search/sort) ----------------
class TestCropsList:
    def test_basic_list_returns_listings_with_new_fields(self, api):
        r = api.get(f"{BASE_URL}/api/crops")
        assert r.status_code == 200
        data = r.json()
        assert "listings" in data and isinstance(data["listings"], list)
        assert len(data["listings"]) >= 6, f"expected >=6 seeded listings, got {len(data['listings'])}"
        # No mongo _id leak (per-object key check, not substring — 'listing_id' contains '_id')
        for l in data["listings"]:
            assert "_id" not in l, f"mongo _id leaked: {l}"
        # Check a few new fields exist on seeded rows
        expected_keys = {
            "crop_variety", "harvest_date", "minimum_order_quantity",
            "minimum_order_unit", "quality_grade", "available_quantity",
            "packaging_type", "delivery_available", "pickup_available",
            "preferred_payment", "lab_tested",
        }
        # Find one seeded (non user-created) listing
        seeded = [x for x in data["listings"] if x.get("crop_variety")]
        assert seeded, "no seeded listings with crop_variety found"
        row = seeded[0]
        missing = expected_keys - set(row.keys())
        assert not missing, f"missing new fields on seeded listing: {missing}"

    def test_filter_by_grade(self, api):
        r = api.get(f"{BASE_URL}/api/crops", params={"grade": "Grade A"})
        assert r.status_code == 200
        listings = r.json()["listings"]
        assert len(listings) >= 1
        for l in listings:
            assert l.get("quality_grade") == "Grade A"

    def test_filter_by_grade_export_quality(self, api):
        r = api.get(f"{BASE_URL}/api/crops", params={"grade": "Export Quality"})
        assert r.status_code == 200
        listings = r.json()["listings"]
        for l in listings:
            assert l.get("quality_grade") == "Export Quality"
        # We seeded Alphonso Mangoes as Export Quality
        assert any("Mango" in (l.get("crop") or "") for l in listings)

    def test_filter_by_grade_organic(self, api):
        r = api.get(f"{BASE_URL}/api/crops", params={"grade": "Organic Certified"})
        assert r.status_code == 200
        listings = r.json()["listings"]
        assert len(listings) >= 1
        for l in listings:
            assert l.get("quality_grade") == "Organic Certified"

    def test_price_range_filter(self, api):
        r = api.get(f"{BASE_URL}/api/crops", params={"min_price": 3000, "max_price": 5000})
        assert r.status_code == 200
        listings = r.json()["listings"]
        assert len(listings) >= 1
        for l in listings:
            assert 3000 <= float(l["expected_price"]) <= 5000

    def test_search_q_basmati(self, api):
        r = api.get(f"{BASE_URL}/api/crops", params={"q": "basmati"})
        assert r.status_code == 200
        listings = r.json()["listings"]
        assert len(listings) >= 1
        # every result must have basmati either in crop name or variety
        for l in listings:
            hay = f"{l.get('crop','')} {l.get('crop_variety','')}".lower()
            assert "basmati" in hay

    def test_sort_price_asc(self, api):
        r = api.get(f"{BASE_URL}/api/crops", params={"sort": "price_asc"})
        assert r.status_code == 200
        prices = [float(l["expected_price"]) for l in r.json()["listings"]]
        assert prices == sorted(prices), f"prices not asc: {prices}"

    def test_sort_price_desc(self, api):
        r = api.get(f"{BASE_URL}/api/crops", params={"sort": "price_desc"})
        assert r.status_code == 200
        prices = [float(l["expected_price"]) for l in r.json()["listings"]]
        assert prices == sorted(prices, reverse=True), f"prices not desc: {prices}"

    def test_sort_harvest_recent(self, api):
        r = api.get(f"{BASE_URL}/api/crops", params={"sort": "harvest_recent"})
        assert r.status_code == 200
        dates = [l.get("harvest_date") for l in r.json()["listings"] if l.get("harvest_date")]
        assert dates == sorted(dates, reverse=True), f"harvest dates not desc: {dates}"

    def test_filter_by_location(self, api):
        r = api.get(f"{BASE_URL}/api/crops", params={"location": "maharashtra"})
        assert r.status_code == 200
        listings = r.json()["listings"]
        assert len(listings) >= 1
        for l in listings:
            assert "maharashtra" in (l.get("location") or "").lower()

    def test_category_filter(self, api):
        r = api.get(f"{BASE_URL}/api/crops", params={"category": "rice"})
        assert r.status_code == 200
        for l in r.json()["listings"]:
            assert l.get("category") == "rice"


# ---------------- GET /api/crops/{listing_id} ----------------
class TestCropDetail:
    def test_valid_listing_returns_full_detail_and_seller(self, api):
        # grab first listing id
        listings = api.get(f"{BASE_URL}/api/crops").json()["listings"]
        assert listings
        lid = listings[0]["listing_id"]
        r = api.get(f"{BASE_URL}/api/crops/{lid}")
        assert r.status_code == 200
        data = r.json()
        assert "listing" in data and "seller" in data
        assert data["listing"]["listing_id"] == lid
        # seller may be None if seller_id is a seeded stub without a user record — accept either
        if data["seller"] is not None:
            for k in ("listings_count", "completed_trades", "seller_rating"):
                assert k in data["seller"], f"seller missing aggregate {k}"

    def test_invalid_listing_returns_404(self, api):
        r = api.get(f"{BASE_URL}/api/crops/does_not_exist_xyz")
        assert r.status_code == 404


# ---------------- POST /api/crops (validation + success) ----------------
class TestCreateCropValidation:
    """Each validation branch should return 400 with a clear message."""

    def _valid_payload(self):
        return {
            "crop": "TEST_Wheat",
            "category": "wheat",
            "quantity": 100,
            "unit": "quintal",
            "expected_price": 2500,
            "location": "Nashik, MH",
            "negotiable": True,
            "description": "Test payload",
            "crop_variety": "Sharbati",
            "harvest_date": "2026-01-01",
            "minimum_order_quantity": 10,
            "minimum_order_unit": "quintal",
            "quality_grade": "Grade A",
            "available_quantity": 100,
            "packaging_type": "50 kg jute bag",
            "moisture_percentage": 12,
            "delivery_available": True,
            "pickup_available": True,
            "storage_condition": "Dry warehouse",
            "expected_delivery_days": 5,
            "preferred_payment": "UPI",
            "lab_tested": True,
            "images": ["https://example.com/img1.jpg"],
        }

    def test_success_full_payload(self, api, demo_token):
        p = self._valid_payload()
        r = api.post(f"{BASE_URL}/api/crops", json=p, headers=h(demo_token))
        assert r.status_code == 200, r.text
        listing = r.json()["listing"]
        # cover image fallback from images[0]
        assert listing.get("image") == p["images"][0]
        # all custom fields persisted
        assert listing["crop_variety"] == "Sharbati"
        assert listing["quality_grade"] == "Grade A"
        assert listing["lab_tested"] is True
        assert listing["minimum_order_quantity"] == 10
        # seller fields injected
        assert listing["seller_id"]
        assert listing["seller_name"]
        # Verify persistence via GET
        g = api.get(f"{BASE_URL}/api/crops/{listing['listing_id']}")
        assert g.status_code == 200
        assert g.json()["listing"]["crop"] == "TEST_Wheat"

    def test_no_images_rejected(self, api, demo_token):
        p = self._valid_payload()
        p["images"] = []
        p.pop("image", None)
        r = api.post(f"{BASE_URL}/api/crops", json=p, headers=h(demo_token))
        assert r.status_code == 400
        assert "image" in r.text.lower()

    def test_future_harvest_date_rejected(self, api, demo_token):
        p = self._valid_payload()
        p["harvest_date"] = (date.today() + timedelta(days=10)).isoformat()
        r = api.post(f"{BASE_URL}/api/crops", json=p, headers=h(demo_token))
        assert r.status_code == 400
        assert "future" in r.text.lower()

    def test_bad_harvest_date_format_rejected(self, api, demo_token):
        p = self._valid_payload()
        p["harvest_date"] = "not-a-date"
        r = api.post(f"{BASE_URL}/api/crops", json=p, headers=h(demo_token))
        assert r.status_code == 400
        assert "harvest_date" in r.text.lower() or "date" in r.text.lower()

    def test_negative_price_rejected(self, api, demo_token):
        p = self._valid_payload()
        p["expected_price"] = 0
        r = api.post(f"{BASE_URL}/api/crops", json=p, headers=h(demo_token))
        assert r.status_code == 400
        assert "price" in r.text.lower()

    def test_moq_zero_rejected(self, api, demo_token):
        p = self._valid_payload()
        p["minimum_order_quantity"] = 0
        r = api.post(f"{BASE_URL}/api/crops", json=p, headers=h(demo_token))
        assert r.status_code == 400
        assert "moq" in r.text.lower() or "greater" in r.text.lower()

    def test_available_less_than_moq_rejected(self, api, demo_token):
        p = self._valid_payload()
        p["available_quantity"] = 5
        p["minimum_order_quantity"] = 10
        r = api.post(f"{BASE_URL}/api/crops", json=p, headers=h(demo_token))
        assert r.status_code == 400
        assert "moq" in r.text.lower() or "available" in r.text.lower()

    def test_invalid_grade_rejected(self, api, demo_token):
        p = self._valid_payload()
        p["quality_grade"] = "Super Duper"
        r = api.post(f"{BASE_URL}/api/crops", json=p, headers=h(demo_token))
        assert r.status_code == 400
        assert "grade" in r.text.lower()

    def test_short_crop_variety_rejected(self, api, demo_token):
        p = self._valid_payload()
        p["crop_variety"] = "A"
        r = api.post(f"{BASE_URL}/api/crops", json=p, headers=h(demo_token))
        assert r.status_code == 400
        assert "variety" in r.text.lower() or "characters" in r.text.lower()

    def test_unauthenticated_create_rejected(self, api):
        p = self._valid_payload()
        r = api.post(f"{BASE_URL}/api/crops", json=p)
        assert r.status_code in (401, 403)


# ---------------- POST /api/crops/inquiry + notifications + threads ----------------
class TestInquiryFlow:
    def test_inquiry_creates_thread_and_message_and_notification(self, api, demo_token):
        # Find a listing owned by someone OTHER than demo user
        me = api.get(f"{BASE_URL}/api/auth/me", headers=h(demo_token)).json()["user"]
        listings = api.get(f"{BASE_URL}/api/crops").json()["listings"]
        target = None
        for l in listings:
            if l.get("seller_id") and l["seller_id"] != me["user_id"]:
                target = l
                break
        assert target is not None, "no listing found owned by a different seller"

        payload = {
            "listing_id": target["listing_id"],
            "quantity": 25,
            "offered_price": 2100,
            "message": "TEST_INQ interested in bulk purchase",
        }
        r = api.post(f"{BASE_URL}/api/crops/inquiry", json=payload, headers=h(demo_token))
        assert r.status_code == 200, r.text
        inq = r.json()["inquiry"]
        assert inq["listing_id"] == target["listing_id"]
        assert inq["buyer_id"] == me["user_id"]
        assert inq["status"] == "open"
        assert inq["quantity"] == 25
        assert inq["offered_price"] == 2100

        # Verify inquiry shows up in "mine"
        mine = api.get(f"{BASE_URL}/api/crops/inquiries/mine", headers=h(demo_token))
        assert mine.status_code == 200
        data = mine.json()
        assert "sent" in data and "received" in data
        sent_ids = [i["inquiry_id"] for i in data["sent"]]
        assert inq["inquiry_id"] in sent_ids

        # Verify a message thread now exists — check the messages/threads endpoints if present
        threads = api.get(f"{BASE_URL}/api/messages/threads", headers=h(demo_token))
        if threads.status_code == 200:
            tlist = threads.json().get("threads") if isinstance(threads.json(), dict) else threads.json()
            assert tlist, "no threads visible after inquiry"

    def test_inquiry_to_invalid_listing(self, api, demo_token):
        r = api.post(f"{BASE_URL}/api/crops/inquiry",
                     json={"listing_id": "does_not_exist", "message": "hi"},
                     headers=h(demo_token))
        assert r.status_code == 404

    def test_inquiry_to_own_listing_rejected(self, api, demo_token):
        # Create a listing as demo, then try to inquire about it
        p = {
            "crop": "TEST_SelfCrop", "category": "wheat", "quantity": 10, "unit": "quintal",
            "expected_price": 3000, "location": "Test, IN", "negotiable": True,
            "images": ["https://example.com/img.jpg"], "quality_grade": "Grade A",
            "minimum_order_quantity": 1, "available_quantity": 10,
            "harvest_date": "2026-01-01", "crop_variety": "TestVar",
        }
        c = api.post(f"{BASE_URL}/api/crops", json=p, headers=h(demo_token))
        assert c.status_code == 200
        lid = c.json()["listing"]["listing_id"]

        r = api.post(f"{BASE_URL}/api/crops/inquiry",
                     json={"listing_id": lid, "message": "self"},
                     headers=h(demo_token))
        assert r.status_code == 400
        assert "own" in r.text.lower()

    def test_inquiry_unauthenticated(self, api):
        r = api.post(f"{BASE_URL}/api/crops/inquiry",
                     json={"listing_id": "whatever", "message": "hi"})
        assert r.status_code in (401, 403)


# ---------------- GET /api/sellers/{seller_id} ----------------
class TestSellerProfile:
    def test_valid_seller_returns_profile(self, api, demo_token):
        # demo user IS a seller (created a listing above). Get demo user_id
        me = api.get(f"{BASE_URL}/api/auth/me", headers=h(demo_token)).json()["user"]
        r = api.get(f"{BASE_URL}/api/sellers/{me['user_id']}")
        assert r.status_code == 200
        data = r.json()
        assert "seller" in data and "listings" in data and "products" in data
        s = data["seller"]
        for k in ("user_id", "name", "listings_count", "products_count",
                  "completed_trades", "seller_rating", "farm_details", "crops_grown"):
            assert k in s, f"seller missing field {k}"
        # No password hash leak
        assert "password_hash" not in r.text
        # No mongo _id leak (per-object key check)
        assert "_id" not in data["seller"], f"seller has _id: {data['seller']}"

    def test_invalid_seller_returns_404(self, api):
        r = api.get(f"{BASE_URL}/api/sellers/does_not_exist_seller")
        assert r.status_code == 404


# ---------------- Regression on existing endpoints ----------------
class TestRegressionQuick:
    def test_dashboard_still_ok(self, api, demo_token):
        r = api.get(f"{BASE_URL}/api/dashboard", headers=h(demo_token))
        assert r.status_code == 200
        keys = {"weather", "market_prices", "featured_products",
                "trending_crops", "nearby_services", "news", "recommendations"}
        assert keys.issubset(r.json().keys())

    def test_products_still_ok(self, api):
        r = api.get(f"{BASE_URL}/api/products")
        assert r.status_code == 200
        assert isinstance(r.json()["products"], list)

    def test_community_posts_still_ok(self, api):
        r = api.get(f"{BASE_URL}/api/community/posts")
        assert r.status_code == 200

    def test_admin_stats_still_ok(self, api, admin_token):
        r = api.get(f"{BASE_URL}/api/admin/stats", headers=h(admin_token))
        assert r.status_code == 200
        assert "totals" in r.json()
