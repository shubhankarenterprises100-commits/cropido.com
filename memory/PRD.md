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
