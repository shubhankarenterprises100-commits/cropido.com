# Cropido — Hostinger MySQL Deployment Guide

This guide activates the MySQL layer (SQLAlchemy + Alembic) after MongoDB-based preview is complete.

## Current State (Preview)

- ✅ MongoDB is running the app in preview (no disruption)
- ✅ SQLAlchemy models built for all 26 tables (`/app/backend/models.py`)
- ✅ Initial Alembic migration generated (`/app/backend/alembic/versions/be572a6bf2c0_initial_cropido_schema.py`)
- ✅ MySQL layer is **inactive** (`USE_MYSQL=false` in `.env`)
- ✅ Preview app still uses MongoDB — no breakage

## Tables Created by Migration (26 total)

| Category | Tables |
|---|---|
| Users | `users`, `profiles`, `roles` |
| Marketplace | `products`, `categories`, `cart_items`, `orders`, `payments` |
| Crop Trading | `crop_listings` |
| Equipment | `equipment`, `equipment_rentals` |
| Services | `services`, `bookings` |
| Community | `community_posts`, `comments`, `likes` |
| Messaging | `message_threads`, `messages` |
| Notifications | `notifications` |
| Knowledge | `knowledge_articles` |
| AI | `ai_sessions`, `ai_messages` |
| Directory | `businesses` |
| Subscriptions | `subscriptions` |
| Analytics | `analytics_events` |
| Audit | `audit_logs` |

All tables include: `created_at`, `updated_at`, `deleted_at` (soft-delete), proper indexes, foreign keys with `ON DELETE` guardrails, utf8mb4 charset (Hindi/Bengali/emoji support).

## 🚀 Activation Steps (When Ready to Switch to MySQL)

### 1. Enable Remote MySQL Access in Hostinger

1. Login to Hostinger hPanel → https://hpanel.hostinger.com
2. Navigate to **Databases** → **Remote MySQL**
3. Add **"Any host (%)"** — OR whitelist your deployment's public IP
4. Save

### 2. Get Real MySQL Host

1. hPanel → **Databases** → **MySQL Databases**
2. Copy the **"Database host"** value (looks like `srv####.hstgr.io` or IP)

### 3. Update `/app/backend/.env`

```bash
USE_MYSQL="true"
DB_HOST="srv####.hstgr.io"      # ← paste real host from hPanel
DB_PORT="3306"
DB_NAME_MYSQL="u748887577_cropido_app"
DB_USER="u748887577_cropido_user"
DB_PASSWORD="Cropido321@"
```

### 4. Test Connection

```bash
cd /app/backend
python3 -c "
import asyncio
from database import init_engine, build_async_url
from sqlalchemy import text
engine = init_engine()
async def check():
    async with engine.connect() as c:
        r = await c.execute(text('SELECT 1'))
        print('MySQL OK:', r.scalar())
asyncio.run(check())
"
```

### 5. Run Migrations Against Hostinger MySQL

```bash
cd /app/backend
alembic upgrade head
```

This creates all 26 tables in your `u748887577_cropido_app` database.

### 6. Verify Tables

Login to phpMyAdmin (Hostinger hPanel → Databases → phpMyAdmin) and confirm 26+ tables exist (including `alembic_version`).

### 7. Data Migration from MongoDB → MySQL

⚠️ **Not automated yet** — this is the next milestone. When ready:

```bash
python3 /app/backend/scripts/migrate_mongo_to_mysql.py
```

(Script to be written once real MySQL is reachable — will read from `db.users`, `db.products`, etc., and INSERT into MySQL tables.)

### 8. Switch API Layer (Code Change)

The current `server.py` uses `motor` (MongoDB async). To fully switch, we'll:
1. Create SQLAlchemy-based session/query helpers
2. Rewrite endpoints one-by-one to use MySQL
3. Add feature flag: `if USE_MYSQL: use_sqlalchemy() else: use_motor()`

Recommended: do this in a separate branch/deploy after MySQL connection is verified.

## Generating Future Migrations

Whenever you add/modify a model in `/app/backend/models.py`:

```bash
cd /app/backend
alembic revision --autogenerate -m "add xyz feature"
alembic upgrade head
```

## Offline Migration (No DB Connection)

To generate migration SQL without connecting to MySQL:

```bash
cd /app/backend
ALEMBIC_TMP_SQLITE=1 alembic revision --autogenerate -m "your message"
```

The migration file is dialect-agnostic and works on MySQL when applied.

## Rollback

```bash
alembic downgrade -1     # rollback one revision
alembic downgrade base   # rollback all
alembic history          # list revisions
```

## Environment Variables Summary

| Variable | Purpose | Preview | Production |
|---|---|---|---|
| `MONGO_URL` | MongoDB connection | ✅ used | Optional (keep as fallback) |
| `USE_MYSQL` | Switch to MySQL | `false` | `true` |
| `DB_HOST` | Hostinger MySQL host | placeholder | Real hostname |
| `DB_PORT` | 3306 | 3306 | 3306 |
| `DB_NAME_MYSQL` | Database name | `u748887577_cropido_app` | same |
| `DB_USER` | MySQL user | `u748887577_cropido_user` | same |
| `DB_PASSWORD` | MySQL password | `Cropido321@` | same |

## Troubleshooting

**"Can't connect to MySQL server on 'your_hostinger_mysql_host'"**
- DB_HOST is still placeholder. Set real hostname.

**"Access denied for user 'u748887577_cropido_user'@'X.X.X.X'"**
- Remote MySQL access not enabled or IP not whitelisted. See Step 1.

**"Unknown database 'u748887577_cropido_app'"**
- Database name mismatch. Check hPanel → Databases → MySQL Databases.

**Migration fails with "specific SQL error"**
- Delete `/app/backend/alembic/versions/*` and regenerate with `ALEMBIC_TMP_SQLITE=1 alembic revision --autogenerate ...`
