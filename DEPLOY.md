# GianAuth — Deploy Guide

## Table of Contents

1. [Pre-deploy checklist](#1-pre-deploy-checklist)
2. [Docker deployment](#2-docker-deployment)
3. [VPS deployment (PM2 + Nginx)](#3-vps-deployment-pm2--nginx)
4. [PostgreSQL migration](#4-postgresql-migration)
5. [Discord bot setup](#5-discord-bot-setup)
6. [SSL with Let's Encrypt](#6-ssl-with-lets-encrypt)
7. [Backup & restore](#7-backup--restore)
8. [First boot checklist](#8-first-boot-checklist)
9. [Update procedure](#9-update-procedure)
10. [Troubleshooting](#10-troubleshooting)
11. [Keyboard shortcuts](#11-keyboard-shortcuts)

---

## 1. Pre-deploy checklist

- [ ] Node.js 20+ installed
- [ ] Domain pointing to server IP
- [ ] Ports 80, 443, 4000, 3000 open (or behind Nginx)
- [ ] `JWT_SECRET` set to a strong random string (min 32 chars)
- [ ] `FRONTEND_URL` set to your actual domain
- [ ] `DATABASE_URL` configured (SQLite for single-server, PostgreSQL for scale)
- [ ] `.env` files created from `.env.example`
- [ ] Discord bot token ready (optional)

Generate a strong JWT secret:
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

---

## 2. Docker deployment

### Quick start

```bash
# Clone and configure
cp .env.example .env
# Edit .env with your values

# Start backend + frontend
docker compose up -d

# With Discord bot
docker compose --profile bot up -d

# View logs
docker compose logs -f backend
docker compose logs -f frontend
```

### Environment variables (`.env`)

```env
JWT_SECRET=your_strong_secret_min_32_chars
FRONTEND_URL=https://yourdomain.com
NEXT_PUBLIC_API_URL=https://yourdomain.com/api

# SQLite (default, single server)
DATABASE_URL=file:./prisma/dev.db

# Discord (optional)
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
DISCORD_BOT_TOKEN=
DISCORD_CLIENT_ID=
OWNER_API_TOKEN=
PANEL_URL=https://yourdomain.com/dashboard
```

### Volumes

- `backend_data` — persists SQLite database and backups across container restarts
- Backups are stored at `/app/prisma/backups/` inside the container

### Health check

```bash
curl http://localhost:4000/api/health
```

---

## 3. VPS deployment (PM2 + Nginx)

### Install dependencies

```bash
# Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# PM2
npm install -g pm2

# Nginx
sudo apt install nginx -y
```

### Backend

```bash
cd backend
npm install --omit=dev
cp .env.example .env   # fill in values
npx prisma db push
node src/seed.js       # only on first boot
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup            # follow the printed command
```

### Frontend

```bash
cd frontend
npm install
cp .env.local.example .env.local   # fill in NEXT_PUBLIC_API_URL
npm run build
pm2 start ecosystem.config.js --env production
pm2 save
```

### Nginx config

Copy `nginx.conf` to `/etc/nginx/sites-available/gianauth`:

```bash
sudo cp nginx.conf /etc/nginx/sites-available/gianauth
sudo ln -s /etc/nginx/sites-available/gianauth /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

Edit `nginx.conf` and replace `yourdomain.com` with your actual domain.

---

## 4. PostgreSQL migration

### When to migrate

Use PostgreSQL when:
- Multiple concurrent users (>10 resellers active simultaneously)
- Deploying on multiple servers
- Requiring point-in-time recovery

### Steps

1. **Backup SQLite first**
   ```bash
   # Via API (owner)
   curl -H "Authorization: Bearer $TOKEN" https://yourdomain.com/api/backup/db -o backup.db
   # Or via System panel > Backups > Create backup
   ```

2. **Provision PostgreSQL**
   ```bash
   # Docker
   docker run -d --name postgres \
     -e POSTGRES_DB=gianauth \
     -e POSTGRES_USER=gianauth \
     -e POSTGRES_PASSWORD=strongpassword \
     -p 5432:5432 postgres:16-alpine
   ```

3. **Update schema**
   ```prisma
   # backend/prisma/schema.prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```

4. **Update DATABASE_URL**
   ```env
   DATABASE_URL=postgresql://gianauth:strongpassword@localhost:5432/gianauth
   ```

5. **Run migration**
   ```bash
   cd backend
   npx prisma migrate dev --name init
   node src/seed.js
   ```

6. **Migrate data** (optional, for existing data)
   ```bash
   # Use pgloader or manual export/import
   # SQLite → CSV → PostgreSQL
   ```

### Rollback

If migration fails:
1. Revert `schema.prisma` to `provider = "sqlite"`
2. Restore `DATABASE_URL=file:./dev.db`
3. Restore from backup: copy `.db` file back to `prisma/dev.db`

### PostgreSQL tuning notes

```sql
-- Recommended for production
ALTER SYSTEM SET max_connections = 100;
ALTER SYSTEM SET shared_buffers = '256MB';
ALTER SYSTEM SET effective_cache_size = '1GB';
ALTER SYSTEM SET work_mem = '4MB';
SELECT pg_reload_conf();
```

---

## 5. Discord bot setup

### Create bot

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. New Application → Bot → Reset Token → copy token
3. Under **OAuth2 → URL Generator**, select scopes: `bot` + `applications.commands`
4. Select bot permissions (minimum required):
   - View Channels
   - Send Messages
   - Manage Messages
   - Embed Links
   - Read Message History
   - Use Application Commands
5. Copy the generated URL, open it in browser, add bot to your server
6. Copy **Application ID** from General Information (= `DISCORD_CLIENT_ID`)
7. Enable **Developer Mode** in Discord: Settings → Advanced → Developer Mode
8. Right-click the target channel → Copy Channel ID (= `DISCORD_CHANNEL_ID`)

### Configure

```env
# discord-bot/.env
DISCORD_BOT_TOKEN=your_bot_token
DISCORD_CLIENT_ID=your_application_id
DISCORD_CHANNEL_ID=your_channel_id
API_URL=http://localhost:4000/api
OWNER_API_TOKEN=your_owner_jwt_token
PANEL_URL=http://localhost:3000/dashboard
```

### Get OWNER_API_TOKEN

```bash
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"your_password"}'
# Copy the "token" field from the response
```

> Note: JWT tokens expire in 8h. For production, re-generate and update `OWNER_API_TOKEN` periodically,
> or automate it with a cron job that calls the login endpoint and restarts the bot.

### Run

```bash
cd discord-bot
npm install
npm start

# With PM2
pm2 start ecosystem.config.js --only gianauth-bot --env production

# With Docker
docker compose --profile bot up -d
```

### Verify startup

On successful start you should see:
```
[bot] Connecting to Discord...
[bot] Logged in as YourBot#1234 (123456789)
[bot] Notifications channel: 987654321
[bot] API URL: http://localhost:4000/api
[bot] 4 slash commands registered globally
```

If you see `Missing required environment variables` the bot will exit with a clear list of what's missing.

### Slash commands

| Command | Description |
|---------|-------------|
| `/pending` | List pending requests |
| `/stats` | System statistics |
| `/reseller <username>` | Reseller info |
| `/health` | Backend health status |

> Global slash commands can take up to 1 hour to propagate across Discord.
> For instant registration during development, use guild commands by replacing
> `Routes.applicationCommands(CLIENT_ID)` with `Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID)`.

### Button actions

When a request is created, the bot sends an embed to `DISCORD_CHANNEL_ID` with:
- **Aprobar** — approves the request, shows Complete button
- **Rechazar** — rejects the request
- **Marcar completada** — marks approved request as completed
- **Abrir panel** — link button to the web panel

---

## 6. SSL with Let's Encrypt

```bash
sudo apt install certbot python3-certbot-nginx -y

# Issue certificate
sudo certbot --nginx -d yourdomain.com

# Auto-renewal (already set up by certbot, verify with)
sudo certbot renew --dry-run

# Cron for renewal (if not automatic)
echo "0 12 * * * /usr/bin/certbot renew --quiet" | sudo crontab -
```

---

## 7. Backup & restore

### Automatic backups

The backend runs a daily backup at 03:00 server time.
- Location: `backend/prisma/backups/`
- Rotation: keeps last 7 backups (configurable via `MAX_BACKUPS` env var)
- History visible in: System panel > Backups

### Manual backup

```bash
# Via System panel (owner) > Backups > Create backup

# Via API
curl -H "Authorization: Bearer $TOKEN" \
  https://yourdomain.com/api/system/backups \
  -X POST
```

### Download backup

```bash
# Via System panel > Backups > Download icon

# Via API
curl -H "Authorization: Bearer $TOKEN" \
  https://yourdomain.com/api/system/backups/backup-2024-01-15-1705123456789.db \
  -o restore.db
```

### Restore SQLite

```bash
# Stop backend
pm2 stop gianauth-backend

# Replace database
cp restore.db backend/prisma/dev.db

# Restart
pm2 start gianauth-backend
```

### Export CSV

```bash
# All licenses (owner)
curl -H "Authorization: Bearer $TOKEN" \
  https://yourdomain.com/api/backup/licenses.csv -o licenses.csv

# Audit logs (owner)
curl -H "Authorization: Bearer $TOKEN" \
  https://yourdomain.com/api/backup/logs.csv -o logs.csv

# Own licenses (reseller)
curl -H "Authorization: Bearer $TOKEN" \
  https://yourdomain.com/api/backup/my-licenses.csv -o my-licenses.csv
```

---

## 8. First boot checklist

- [ ] Backend starts without errors (`pm2 logs gianauth-backend`)
- [ ] `GET /api/health` returns `{"status":"ok"}`
- [ ] Frontend loads at your domain
- [ ] Login with `admin` / `admin123` works
- [ ] **Change admin password immediately** (Resellers panel > edit)
- [ ] Create first reseller account
- [ ] Create first product
- [ ] Assign test keys to reseller
- [ ] Test claim flow as reseller
- [ ] Configure Discord webhook (optional)
- [ ] Run first manual backup (System panel)
- [ ] Verify backup file downloads correctly

---

## 9. Update procedure

```bash
# 1. Pull changes
git pull origin main

# 2. Backend
cd backend
npm install --omit=dev
npx prisma db push          # apply schema changes
pm2 restart gianauth-backend

# 3. Frontend
cd ../frontend
npm install
npm run build
pm2 restart gianauth-frontend

# 4. Discord bot (if updated)
cd ../discord-bot
npm install
pm2 restart gianauth-bot

# 5. Verify
curl https://yourdomain.com/api/health
```

### With Docker

```bash
docker compose pull
docker compose up -d --build
```

---

## 10. Troubleshooting

### Backend won't start

```bash
pm2 logs gianauth-backend --lines 50
# Check for: missing JWT_SECRET, DB connection error, port in use
```

### Frontend shows blank page

```bash
pm2 logs gianauth-frontend --lines 50
# Check NEXT_PUBLIC_API_URL points to correct backend
```

### Can't login

```bash
# Test backend directly
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'

# If 500: check DB is accessible
# If 401: wrong credentials
# If CORS error: check FRONTEND_URL in backend .env
```

### Socket.IO not connecting

- Check `FRONTEND_URL` in backend `.env` matches exactly (including protocol)
- Nginx must proxy `/socket.io` with WebSocket upgrade headers (see `nginx.conf`)
- Connection indicator in notification bell: green=connected, amber=connecting, red=disconnected

### Discord bot not responding

```bash
pm2 logs gianauth-bot
# Check DISCORD_BOT_TOKEN is valid
# Check OWNER_API_TOKEN is not expired (8h JWT)
# Slash commands may take up to 1h to propagate globally
```

### Database locked (SQLite)

```bash
# Only one process should access SQLite at a time
# Check for zombie processes
pm2 list
pm2 delete gianauth-backend
pm2 start ecosystem.config.js --only gianauth-backend --env production
```

### Backup fails

```bash
# Check disk space
df -h
# Check backup directory permissions
ls -la backend/prisma/backups/
```

---

## 11. Keyboard shortcuts

Available in the dashboard (press `Ctrl+K` to open command palette):

| Shortcut | Action |
|----------|--------|
| `Ctrl+K` | Open command palette |
| `G` then `D` | Go to Dashboard |
| `G` then `L` | Go to Licenses |
| `G` then `R` | Go to Requests |
| `G` then `U` | Go to Resellers (owner) |
| `G` then `P` | Go to Products (owner) |
| `G` then `S` | Go to Support |
| `G` then `Y` | Go to System (owner) |
| `Esc` | Close modal / palette |

---

## Security notes

- JWT tokens expire in 8h — users must re-login
- Rate limiting: 300 req/15min global, 20 req/15min on login
- All state-changing actions are recorded in the audit log
- Failed login attempts are logged with IP
- Sessions can be revoked from the Sessions panel
- Owner can view security events in System > Errors
- Reseller data is fully isolated — resellers cannot access other resellers' data
- Soft delete: licenses are never hard-deleted by default
- Backups are stored server-side and downloadable by owner only
