# Cropido — Product Requirements (v1.1)

## Vision
India's digital agriculture ecosystem connecting farmers, buyers, suppliers, service providers, consultants and agri-businesses on a single platform.

## Stack
- Frontend: Expo (React Native) + TypeScript + expo-router
- Backend: FastAPI + MongoDB (motor async)
- Auth: JWT (email/password) + Emergent-managed Google OAuth + simulated OTP
- AI: Claude Sonnet 4.5 via Emergent Universal Key (`emergentintegrations`)
- Payments: **Real Stripe test mode** via `emergentintegrations.payments.stripe.checkout`
- Weather: **Live Open-Meteo API** (no key, GPS-driven)
- Location: `expo-location` (native) + browser Geolocation + OpenStreetMap Nominatim reverse-geocoding
- i18n: `i18next` — English, Hindi, Bengali (static translation files)

## Modules Implemented
1. Splash + 7-screen Onboarding (with language picker)
2. Auth: Login, Register (role select), Forgot Password, OTP, Google Sign-in
3. Home Dashboard: personalized greeting, **real GPS location**, **live weather widget (Open-Meteo)**, market prices ticker, quick actions bento grid (8), AI insight card, featured products, trending crops, nearby services, news
4. Marketplace (12 seeded products, categories, search, cart, checkout, orders)
5. Crop Trading (5 seeded listings, create-listing modal)
6. Equipment Rental (6 items, booking modal)
7. Agri Services (8 categories, booking modal)
8. Community (4 tabs, compose modal, likes, comments)
9. Knowledge Center (magazine layout)
10. AI Farming Assistant — Claude Sonnet 4.5, image upload, EN/HI/BN
11. Business Directory (6 categories, call/message actions)
12. Messaging (threads list)
13. Notifications (auto-seeded demo alerts)
14. **Real Stripe Subscription Checkout** — Pro Farmer / Business / Enterprise plans open real `checkout.stripe.com` hosted page; on success, poll `/api/payments/status/{session_id}` → upgrade user + log payment
15. Payments history
16. Profile with verified badge, stats, dark-mode toggle, admin link (conditional)
17. Settings with instant language switching
18. **Admin Dashboard** (`/admin`, requires `role='admin'`) — Overview stats (users, verified, products, revenue, plan breakdown, recent orders), user management (verify), product moderation (delete)

## Design System
- Primary green `#2E7D32`, accent orange `#FF9800`, clean white background
- Card-based, generous spacing, rounded corners, subtle shadows
- Bento-grid dashboards, sticky-header + chip-row pattern for browse screens
- All interactive elements have kebab-case `testID`s

## Test Credentials
- Farmer: `demo@cropido.app` / `demo1234`
- Admin: `admin@cropido.app` / `admin1234`
- OTP: any phone + `123456`
- Stripe test card: `4242 4242 4242 4242`

## Testing Status
- Backend: **30/30 pass** (iteration_3.json) — Stripe checkout, weather, admin RBAC, all regression
- Frontend GPS location: verified by testing_agent

## Known Notes (Non-blocking)
- `/api/subscriptions/subscribe` legacy mock endpoint still present alongside real Stripe (used only for free plan downgrade)
- `STRIPE_WEBHOOK_SECRET` empty — webhook still succeeds because `emergentintegrations` handles signature; add value if you configure a real webhook in Stripe dashboard
- `/api/payments/checkout/order` should verify order ownership (add before enabling one-time payment UI)
- `server.py` is ~1430 lines — modularize into routers post-MVP

## Future Enhancements
- Twilio for real mobile OTP
- Real-time messaging (websockets)
- Push notifications (Emergent-managed)
- Modularize backend into routers (auth, marketplace, community, ai, payments, admin)
- Referral system + farmer badges
### Update (Session 2, July 2026): Crop Trading Buyer Journey Overhaul

**Status:** ✅ COMPLETE

Delivered a full-stack redesign of the crop-trading module transforming it from a basic listing view to an investor-ready B2B agri-marketplace.

Backend:
- Added 15 enhanced fields to `crop_listings` (crop_variety, harvest_date, minimum_order_quantity + unit, quality_grade, available_quantity, packaging_type, moisture_percentage, delivery_available, pickup_available, certificate_url, storage_condition, expected_delivery_days, preferred_payment, lab_tested)
- New tables via Alembic: `crop_images`, `crop_inquiries`
- New endpoints: `GET /api/crops/{id}`, `POST /api/crops/inquiry`, `GET /api/crops/inquiries/mine`, `GET /api/sellers/{id}`
- Server-side validation for all critical fields
- Inquiry flow auto-creates message thread + seller notification
- Enriched seed data (6 listings with full field set)
- MySQL migration `c1d2e3f4a5b6` applied to Hostinger
- Fixed load_dotenv() ordering bug that was silently disabling MySQL sync

Frontend:
- Completely rebuilt `/crop-trading` with search, filter sheet (grade / price range / sort), category chips, enriched cards showing grade badges / lab-tested / fresh-harvest badges / MOQ / delivery-pickup / seller info + Inquire CTA
- New multi-step "List a Crop" wizard: Basics → Quality → Logistics → Media → Review with inline validation, expo-image-picker (up to 5), date picker
- New `/crop/{listing_id}` detail screen with image gallery, all 13 spec fields, seller card, sticky Inquire + Call CTAs, safety note
- New `/seller/{seller_id}` public profile with stats, farm details, crops grown, listings/products tabs
- Empty state, loading state, pull-to-refresh, keyboard handling

Testing:
- 33/33 backend crop-trading tests pass, 79/80 full regression
- Frontend smoke: 100%
