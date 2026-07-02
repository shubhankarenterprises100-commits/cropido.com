# Cropido — Product Requirements (MVP v1)

## Vision
India's digital agriculture ecosystem connecting farmers, buyers, suppliers, service providers, consultants and agri-businesses on a single platform.

## Stack
- Frontend: Expo (React Native) + TypeScript + expo-router
- Backend: FastAPI + MongoDB (motor async)
- Auth: JWT (email/password) + Emergent-managed Google OAuth + simulated OTP
- AI: Claude Sonnet 4.5 via Emergent Universal Key (`emergentintegrations`)
- Payments: Stripe (test mode, subscription upgrade — mocked flow that logs a payment record)
- i18n: `i18next` — English, Hindi, Bengali (static translation files)

## Modules Implemented
1. Splash + 7-screen Onboarding (with language picker)
2. Auth: Login, Register (role select), Forgot Password, OTP, Google Sign-in
3. Home Dashboard: personalized greeting, weather widget, market prices ticker, quick actions bento grid (8), AI insight card, featured products, trending crops, nearby services, news
4. Marketplace: product listing (2-col grid) with category chips, search, product detail, cart, orders (order placed → order tracking)
5. Crop Trading: browse by category, create listing modal, verified seller badges
6. Equipment Rental: list, category chips, booking modal with date range & confirm
7. Agri Services: 8 categories, booking modal
8. Community: 4 tabs (Feed, Communities, Experts, Trending), post composer modal, like, comments count
9. Knowledge Center: featured article, category chips, articles list (video badge support)
10. AI Farming Assistant: multi-turn chat, image upload for disease detection, suggestion chips, EN/HI/BN response
11. Business Directory: 6 categories, verified badges, call/message actions
12. Messaging: threads list (with empty state pointing to directory)
13. Notifications: seeded demo alerts, mark-all-read
14. Subscription: 4 plans (Free/Pro Farmer/Business/Enterprise) with Stripe-style checkout, mocked upgrade flow
15. Payments history
16. Profile: verified badge, stats row, upgrade card, dark mode toggle, language, logout
17. Settings: language switcher, dark mode, account details

## Design System
- Primary green `#2E7D32`, accent orange `#FF9800`, clean white background
- Card-based, generous spacing, rounded corners (16-24px), subtle shadows
- Bento-grid dashboards, sticky-header + chip-row pattern for browse screens
- All interactive elements have `testID` (kebab-case, role-based)

## Known Simulations / Placeholders
- OTP is simulated (code `123456`)
- Stripe subscription flow is MOCKED (records payment, upgrades in Mongo; no live Stripe Checkout Session opened)
- Google Auth uses Emergent's demobackend session broker
- Weather widget shows static demo data (Nashik)

## Future Enhancements (post-MVP)
- Live weather API (OpenWeather / IMD)
- Real Stripe Checkout Sessions with webhook
- Twilio / Firebase OTP
- Real-time messaging (websockets)
- Push notifications (Emergent-managed)
- Admin panel (React admin dashboard on separate route group)
