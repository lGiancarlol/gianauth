# GianAuth

License management platform for software resellers.

## Stack

| Layer    | Technology                          |
|----------|-------------------------------------|
| Frontend | Next.js 14, TypeScript, TailwindCSS |
| Backend  | Node.js, Express                    |
| ORM      | Prisma                              |
| Database | SQLite (dev) / PostgreSQL (prod)    |
| Auth     | JWT (8h expiry), bcrypt             |
| Security | Helmet, express-rate-limit, Zod     |

---

## Project Structure

```
GianAuth/
├── backend/
│   ├── prisma/
│   │   └── schema.prisma          # Data models + indexes
│   └── src/
│       ├── index.js               # Server entry, security middleware
│       ├── seed.js                # Initial data
│       ├── lib/
│       │   ├── prisma.js          # Singleton Prisma client
│       │   ├── helpers.js         # audit(), notify(), calcExpiresAt()
│       │   ├── validate.js        # Zod schemas + validate middleware
│       │   └── discord.js         # Discord webhook service (bot-ready)
│       ├── middleware/
│       │   └── auth.js            # authenticate, requireOwner, requireActive
│       └── routes/
│           ├── auth.js
│           ├── licenses.js
│           ├── users.js
│           ├── products.js
│           ├── requests.js
│           ├── stats.js
│           ├── logs.js            # AuditLog with filters + pagination
│           └── notifications.js
└── frontend/
    └── src/
        ├── app/
        │   ├── login/
        │   └── dashboard/
        │       ├── page.tsx           # Stats dashboard
        │       ├── licenses/          # License management
        │       ├── products/          # Product management (owner)
        │       ├── resellers/         # Reseller management + branding (owner)
        │       ├── requests/          # Request queue (owner)
        │       ├── my-requests/       # Request history (reseller)
        │       ├── claim/             # Claim key (reseller)
        │       └── logs/              # Audit log (owner)
        ├── components/
        │   ├── Sidebar.tsx
        │   ├── StatCard.tsx
        │   ├── Badge.tsx
        │   ├── Skeleton.tsx
        │   └── NotificationDropdown.tsx
        ├── hooks/
        │   ├── useAuth.ts
        │   └── useNotifications.ts
        └── lib/
            ├── api.ts             # Axios client with auth interceptor
            └── utils.ts
```

---

## Roles

### Owner
- Full system access
- Manage resellers (create, block, delete, set limits)
- Configure reseller branding (displayName, panelName, accentColor, avatarUrl)
- Assign license batches to resellers
- Manage products
- Review and resolve requests
- Access audit log

### Reseller
- View and manage own licenses only
- Claim available keys
- Set private status and client alias on own keys
- Submit requests (reset HWID, ban, unban, delete, extend)
- Receive in-app notifications

---

## API Endpoints

### Auth
| Method | Route            | Description        | Auth     |
|--------|------------------|--------------------|----------|
| POST   | /api/auth/login  | Login              | Public   |
| GET    | /api/auth/me     | Current user       | Any      |

### Users
| Method | Route                    | Description              | Auth  |
|--------|--------------------------|--------------------------|-------|
| GET    | /api/users               | List resellers           | Owner |
| POST   | /api/users               | Create reseller          | Owner |
| GET    | /api/users/:id/stock     | Reseller stock detail    | Owner |
| PATCH  | /api/users/:id/block     | Toggle block             | Owner |
| PATCH  | /api/users/:id/branding  | Update branding          | Owner |
| PATCH  | /api/users/:id/limits    | Set daily limits         | Owner |
| DELETE | /api/users/:id           | Delete reseller          | Owner |

### Licenses
| Method | Route                        | Description              | Auth     |
|--------|------------------------------|--------------------------|----------|
| GET    | /api/licenses                | List licenses            | Any      |
| GET    | /api/licenses/stock          | Available stock          | Any      |
| GET    | /api/licenses/deleted        | Soft-deleted keys        | Owner    |
| POST   | /api/licenses/import         | Assign batch             | Owner    |
| POST   | /api/licenses/claim          | Claim a key              | Reseller |
| PATCH  | /api/licenses/:id/private    | Update private state     | Reseller |
| PATCH  | /api/licenses/:id/block      | Toggle block             | Owner    |
| PATCH  | /api/licenses/:id/restore    | Restore soft-deleted     | Owner    |
| DELETE | /api/licenses/:id            | Soft delete              | Owner    |

### Requests
| Method | Route                          | Description              | Auth     |
|--------|--------------------------------|--------------------------|----------|
| GET    | /api/requests                  | List requests            | Any      |
| POST   | /api/requests                  | Create request           | Reseller |
| PATCH  | /api/requests/:id              | Resolve request          | Owner    |
| PATCH  | /api/requests/license/:id/meta | Update license meta      | Any      |

### Products
| Method | Route              | Description     | Auth  |
|--------|--------------------|-----------------|-------|
| GET    | /api/products      | List products   | Any   |
| POST   | /api/products      | Create product  | Owner |
| PATCH  | /api/products/:id  | Update product  | Owner |
| DELETE | /api/products/:id  | Delete product  | Owner |

### Logs
| Method | Route             | Description              | Auth  |
|--------|-------------------|--------------------------|-------|
| GET    | /api/logs         | Audit log with filters   | Owner |
| GET    | /api/logs/actions | Distinct action list     | Owner |

### Stats & Notifications
| Method | Route                           | Description           | Auth |
|--------|---------------------------------|-----------------------|------|
| GET    | /api/stats                      | Dashboard stats       | Any  |
| GET    | /api/notifications              | User notifications    | Any  |
| PATCH  | /api/notifications/read-all     | Mark all read         | Any  |
| PATCH  | /api/notifications/:id/read     | Mark one read         | Any  |

### Support Tickets
| Method | Route                        | Description              | Auth     |
|--------|------------------------------|--------------------------|----------|
| GET    | /api/tickets                 | List tickets             | Any      |
| GET    | /api/tickets/:id             | Ticket detail + messages | Any      |
| POST   | /api/tickets                 | Create ticket            | Reseller |
| POST   | /api/tickets/:id/messages    | Reply to ticket          | Any      |
| PATCH  | /api/tickets/:id             | Update status/priority   | Owner    |

### Sessions
| Method | Route              | Description              | Auth |
|--------|--------------------|--------------------------|------|
| GET    | /api/sessions      | List active sessions     | Any  |
| DELETE | /api/sessions/:id  | Revoke session           | Any  |
| DELETE | /api/sessions      | Revoke all other sessions| Any  |

### System (Owner only)
| Method | Route                          | Description                  | Auth  |
|--------|--------------------------------|------------------------------|-------|
| GET    | /api/system/health             | Full system health metrics   | Owner |
| GET    | /api/system/errors             | Error log viewer             | Owner |
| PATCH  | /api/system/errors/:id/resolve | Mark error resolved          | Owner |
| DELETE | /api/system/errors             | Clear resolved errors        | Owner |
| POST   | /api/system/admin/:action      | Run admin action             | Owner |
| GET    | /api/system/backups            | List backup history          | Owner |
| POST   | /api/system/backups            | Create manual backup         | Owner |
| GET    | /api/system/backups/:filename  | Download backup file         | Owner |

### Backup (Owner only)
| Method | Route                      | Description              | Auth        |
|--------|----------------------------|--------------------------|-------------|
| GET    | /api/backup/db             | Download SQLite file     | Owner       |
| GET    | /api/backup/licenses.csv   | Export licenses CSV      | Owner       |
| GET    | /api/backup/logs.csv       | Export audit logs CSV    | Owner       |
| GET    | /api/backup/my-licenses.csv| Export own licenses CSV  | Any         |

---

## Environment Variables

### Backend (`backend/.env`)

```env
DATABASE_URL="file:./dev.db"
JWT_SECRET="your_strong_secret"
PORT=4000
NODE_ENV=development
FRONTEND_URL="http://localhost:3000"
DISCORD_WEBHOOK_URL=""        # optional
```

### Frontend (`frontend/.env.local`)

```env
NEXT_PUBLIC_API_URL="http://localhost:4000/api"
```

---

## Quick Start

```bash
# 1. Backend
cd backend
npm install
cp .env.example .env        # fill in values
npx prisma db push
node src/seed.js
npm run dev

# 2. Frontend (new terminal)
cd frontend
npm install
cp .env.local.example .env.local
npm run dev
```

Default credentials: `admin` / `admin123`

---

## Security

- **Helmet** — sets secure HTTP headers
- **Rate limiting** — 300 req/15min global, 20 req/15min on login
- **Zod validation** — all request bodies and query params validated
- **JWT** — 8h expiry, role and block status embedded
- **Ownership checks** — resellers can only access their own data
- **Soft delete** — licenses are never hard-deleted by default
- **Audit log** — every state-changing action is recorded with actor, IP, and metadata

---

## Docker Deployment

```bash
cp .env.example .env   # fill in JWT_SECRET and domain
docker compose up -d

# With discord bot
docker compose --profile bot up -d
```

The backend volume `backend_data` persists the SQLite database across restarts.

---

## Production Deployment (VPS)

### Prerequisites
- Node.js 18+
- Nginx (reverse proxy)
- PM2 (process manager)

### Steps

```bash
# Backend
cd backend
npm install --production
npx prisma db push
NODE_ENV=production pm2 start src/index.js --name gianauth-backend

# Frontend
cd frontend
npm install
npm run build
pm2 start npm --name gianauth-frontend -- start
```

### Nginx config (example)

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location /api {
        proxy_pass http://localhost:4000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
    }
}
```

### Migrate to PostgreSQL

1. Update `DATABASE_URL` in `.env`
2. Change `provider = "sqlite"` to `provider = "postgresql"` in `schema.prisma`
3. Run `npx prisma migrate dev`

---

## Discord Bot Integration

The `discord-bot/` directory contains a fully functional discord.js bot.

### Setup

```bash
cd discord-bot
cp .env.example .env   # fill DISCORD_BOT_TOKEN, API_URL, OWNER_API_TOKEN
npm install
npm start
```

### How it works

1. When a reseller creates a request, the backend sends a Discord embed with **Approve** / **Reject** buttons
2. The owner clicks a button in Discord
3. The bot calls `PATCH /api/requests/:id` using the owner JWT token
4. The embed is updated to reflect the new status
5. The reseller receives an in-app notification in real time
6. The AuditLog records the action

### Environment variables

| Variable          | Description                                      |
|-------------------|--------------------------------------------------|
| DISCORD_BOT_TOKEN | Bot token from Discord Developer Portal         |
| API_URL           | Backend API URL (default: http://localhost:4000/api) |
| OWNER_API_TOKEN   | Owner JWT token for API authentication          |

---

## Realtime (Socket.IO)

The system uses Socket.IO for real-time updates with polling fallback.

| Event               | Direction         | Trigger                          |
|---------------------|-------------------|----------------------------------|
| `notification:new`  | server → user     | New notification created         |
| `request:new`       | server → owner    | Reseller creates a request       |
| `request:updated`   | server → owner+reseller | Request status changes     |
| `licenses:expired`  | server → all      | Expiration job runs              |

Fallback: if Socket.IO fails to connect, polling runs every 30s automatically.

---

