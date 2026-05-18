// ── Environment loader ───────────────────────────────────────────────────────
// Load .env.development or .env.production based on NODE_ENV.
// Falls back to .env for backwards compatibility.
const path = require("path");
const fs   = require("fs");

(function loadEnv() {
  const env     = process.env.NODE_ENV || "development";
  const envFile = path.resolve(__dirname, `../.env.${env}`);
  const fallback = path.resolve(__dirname, "../.env");
  const target  = fs.existsSync(envFile) ? envFile : fallback;
  require("dotenv").config({ path: target });
  // Ensure NODE_ENV is set after loading
  process.env.NODE_ENV = process.env.NODE_ENV || env;
})();

// ── Startup env validation ────────────────────────────────────────────────────
const REQUIRED_ENV = ["JWT_SECRET", "SERVICE_SECRET"];
const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`[startup] Missing required env vars: ${missing.join(", ")}`);
  process.exit(1);
}

// ── Production safety warnings ─────────────────────────────────────────────────
if (process.env.NODE_ENV === "production") {
  const warnings = [];
  if ((process.env.DATABASE_URL || "").startsWith("file:"))  warnings.push("DATABASE_URL is SQLite — use PostgreSQL in production");
  if ((process.env.FRONTEND_URL || "").includes("localhost")) warnings.push("FRONTEND_URL contains localhost");
  if ((process.env.JWT_SECRET || "").length < 32)             warnings.push("JWT_SECRET is too short (min 32 chars)");
  if (process.env.JWT_SECRET === "dev_secret_change_in_production") warnings.push("JWT_SECRET is the default dev value");
  if (process.env.SERVICE_SECRET === "dev_service_secret_change_in_production") warnings.push("SERVICE_SECRET is the default dev value");
  if (warnings.length) {
    console.warn("[startup] [PROD] Production safety warnings:");
    warnings.forEach((w) => console.warn(`  [PROD] WARNING: ${w}`));
  }
}

const express    = require("express");
const http       = require("http");
const cors       = require("cors");
const helmet     = require("helmet");
const rateLimit  = require("express-rate-limit");
const { Server } = require("socket.io");
const jwt        = require("jsonwebtoken");
const prisma     = require("./lib/prisma");
const { setIo, notify } = require("./lib/helpers");
const socketBridge      = require("./lib/socketBridge");
const log        = require("./lib/logger");
const { trackError }    = require("./lib/errorTracker");
const { runBackup }     = require("./lib/autoBackup");

const authRoutes         = require("./routes/auth");
const licenseRoutes      = require("./routes/licenses");
const userRoutes         = require("./routes/users");
const logRoutes          = require("./routes/logs");
const statsRoutes        = require("./routes/stats");
const requestRoutes      = require("./routes/requests");
const productRoutes      = require("./routes/products");
const notificationRoutes = require("./routes/notifications");
const ticketRoutes       = require("./routes/tickets");
const sessionRoutes      = require("./routes/sessions");
const backupRoutes       = require("./routes/backup");
const systemRoutes       = require("./routes/system");

const app    = express();
const server = http.createServer(app);
const PORT   = process.env.PORT || 4000;
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

// Trust proxy headers from Nginx — required for correct IP in rate limiting and logs
app.set("trust proxy", 1);

// ── Socket.IO ─────────────────────────────────────────────────────────────────
const io = new Server(server, {
  cors: { origin: FRONTEND_URL, credentials: true },
  transports: ["websocket", "polling"],
  pingTimeout:  20000,
  pingInterval: 25000,
});

io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error("Token requerido"));
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.user = decoded;
    next();
  } catch {
    next(new Error("Token inválido"));
  }
});

io.on("connection", (socket) => {
  socket.join(`user:${socket.user.id}`);
  if (socket.user.role === "owner") {
    socket.join("owner");
    socket.join("system");
  } else {
    socket.join(`reseller:${socket.user.id}`);
  }
  socket.join("global");
  log.app.debug({ userId: socket.user.id }, "Socket connected");
  socket.on("disconnect", (reason) => {
    log.app.debug({ userId: socket.user.id, reason }, "Socket disconnected");
  });
});

app.set("io", io);
setIo(io);
socketBridge.init(io);

// ── Security ──────────────────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc:  ["'self'"],
      styleSrc:   ["'self'", "'unsafe-inline'"],
      imgSrc:     ["'self'", "data:", "https:"],
      connectSrc: ["'self'", FRONTEND_URL],
      frameSrc:   ["'none'"],
      objectSrc:  ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

app.use(cors({ origin: FRONTEND_URL, credentials: true }));

const IS_PROD = process.env.NODE_ENV === "production";

// ── Rate limit helpers ────────────────────────────────────────────────────────
function makeLimit(opts) {
  // In development: allow 10× more requests so normal testing never hits limits
  const max = IS_PROD ? opts.max : opts.max * 10;
  return rateLimit({
    windowMs:       opts.windowMs,
    max,
    standardHeaders: true,
    legacyHeaders:   false,
    skip: (req) => {
      // Never rate-limit health checks, socket.io, or static assets
      const p = req.path;
      return p === "/api/health" || p.startsWith("/socket.io");
    },
    handler: (req, res) => {
      const retryAfter = Math.ceil(opts.windowMs / 1000);
      log.security.warn({ ip: req.ip, path: req.path, route: opts.route }, "Rate limit triggered");
      res.status(429).json({
        error:      "Rate limit exceeded",
        message:    opts.message || "Demasiadas solicitudes. Intenta más tarde.",
        retryAfter,
        route:      opts.route || req.path,
      });
    },
  });
}

// Global limit — applied to all /api/* routes
app.use(makeLimit({
  windowMs: 15 * 60 * 1000,
  max:      IS_PROD ? 200 : 2000,
  route:    "global",
  message:  "Demasiadas solicitudes. Intenta más tarde.",
}));

// Login — stricter, brute-force protection
app.use("/api/auth/login", makeLimit({
  windowMs: 15 * 60 * 1000,
  max:      30,
  route:    "/auth/login",
  message:  "Demasiados intentos de login. Intenta en 15 minutos.",
}));

// Discord OAuth callback
app.use("/api/auth/discord", makeLimit({
  windowMs: 15 * 60 * 1000,
  max:      50,
  route:    "/auth/discord",
  message:  "Demasiadas solicitudes OAuth. Intenta más tarde.",
}));

app.use(express.json({ limit: "1mb" }));

// ── Request logger (info level, skips health) ─────────────────────────────────
app.use((req, _res, next) => {
  if (req.path !== "/api/health") {
    log.request.debug({ method: req.method, path: req.path, ip: req.ip });
  }
  next();
});

// ── Routes ────────────────────────────────────────────────────────────────────
app.use("/api/auth",          authRoutes);
app.use("/api/licenses",      licenseRoutes);
app.use("/api/users",         userRoutes);
app.use("/api/logs",          logRoutes);
app.use("/api/stats",         statsRoutes);
app.use("/api/requests",      requestRoutes);
app.use("/api/products",      productRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/tickets",       ticketRoutes);
app.use("/api/sessions",      sessionRoutes);
app.use("/api/backup",        backupRoutes);
app.use("/api/system",        systemRoutes);

app.get("/api/health", (_req, res) => res.json({
  status:  "ok",
  version: "3.0.0",
  env:     process.env.NODE_ENV || "development",
  uptime:  Math.floor(process.uptime()),
}));

// GET /api/sync/state — full state snapshot for client resync on reconnect
app.get("/api/sync/state", async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return res.status(401).json({ error: "Token requerido" });
  const jwt = require("jsonwebtoken");
  let user;
  try { user = jwt.verify(header.split(" ")[1], process.env.JWT_SECRET); }
  catch { return res.status(401).json({ error: "Token inv\u00e1lido" }); }

  try {
    const isOwner = user.role === "owner";
    const [products, notifications] = await Promise.all([
      prisma.product.findMany({ where: isOwner ? {} : { active: true }, orderBy: { name: "asc" } }),
      prisma.notification.findMany({ where: { userId: user.id, isRead: false }, orderBy: { createdAt: "desc" }, take: 50 }),
    ]);

    const licenseWhere = { isDeleted: false, status: { in: ["available", "used"] } };
    if (!isOwner) licenseWhere.resellerId = user.id;
    const licenses = await prisma.license.findMany({
      where: licenseWhere,
      select: { id: true, key: true, status: true, productId: true, resellerId: true, expiresAt: true, claimedAt: true },
      take: 200,
      orderBy: { createdAt: "desc" },
    });

    const requestWhere = { status: { in: ["pending", "approved"] } };
    if (!isOwner) requestWhere.resellerId = user.id;
    const requests = await prisma.request.findMany({
      where: requestWhere,
      select: { id: true, type: true, status: true, licenseId: true, resellerId: true, createdAt: true },
      take: 100,
      orderBy: { createdAt: "desc" },
    });

    res.json({ products, licenses, requests, notifications, syncedAt: Date.now() });
  } catch (err) { next(err); }
});

// ── Session tracking ──────────────────────────────────────────────────────────
app.use(async (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return next();
  const token = header.split(" ")[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    await prisma.session.upsert({
      where:  { token },
      update: { lastSeenAt: new Date(), ip: req.ip, userAgent: req.headers["user-agent"] || null },
      create: { token, userId: decoded.id, ip: req.ip, userAgent: req.headers["user-agent"] || null },
    }).catch(() => {});
  } catch {}
  next();
});

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ error: "Ruta no encontrada" }));

// ── Centralized error handler ─────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use(async (err, req, res, next) => {
  await trackError(err, { req });
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === "production" ? "Error interno del servidor" : err.message,
  });
});

// ── Background jobs ───────────────────────────────────────────────────────────
async function runExpirationJob() {
  try {
    const { count } = await prisma.license.updateMany({
      where: { status: "used", expiresAt: { lte: new Date() }, isDeleted: false },
      data:  { status: "expired" },
    });
    if (count > 0) {
      log.job.info({ count }, "Keys marked as expired");
      io.emit("licenses:expired", { count });
    }
  } catch (err) {
    log.job.error(err, "Expiration job failed");
  }
}

async function runStockWarningJob() {
  try {
    const LOW_STOCK_THRESHOLD = 5;
    const EXPIRY_WARN_DAYS    = 3;

    const resellers = await prisma.user.findMany({
      where: { role: "reseller", isBlocked: false },
      select: { id: true, username: true,
        licenses: {
          where: { isDeleted: false, status: { in: ["available", "used"] } },
          select: { id: true, status: true, expiresAt: true },
        },
      },
    });

    const now        = new Date();
    const warnCutoff = new Date(now.getTime() + EXPIRY_WARN_DAYS * 24 * 60 * 60 * 1000);

    for (const reseller of resellers) {
      const available    = reseller.licenses.filter((l) => l.status === "available").length;
      const expiringSoon = reseller.licenses.filter(
        (l) => l.status === "used" && l.expiresAt && l.expiresAt > now && l.expiresAt <= warnCutoff
      ).length;

      if (available > 0 && available <= LOW_STOCK_THRESHOLD) {
        const recent = await prisma.notification.findFirst({
          where: { userId: reseller.id, type: "low_stock", createdAt: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) } },
        });
        if (!recent) {
          await notify({ userId: reseller.id, type: "low_stock",
            title: "Stock bajo",
            body: `Te quedan ${available} key${available !== 1 ? "s" : ""} disponible${available !== 1 ? "s" : ""}. Contacta al administrador para recargar.`,
          });
        }
      }

      if (expiringSoon > 0) {
        const recent = await prisma.notification.findFirst({
          where: { userId: reseller.id, type: "expiring_soon", createdAt: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) } },
        });
        if (!recent) {
          await notify({ userId: reseller.id, type: "expiring_soon",
            title: "Keys próximas a expirar",
            body: `${expiringSoon} key${expiringSoon !== 1 ? "s" : ""} expira${expiringSoon === 1 ? "" : "n"} en menos de ${EXPIRY_WARN_DAYS} días.`,
          });
        }
      }
    }

    const owners = await prisma.user.findMany({ where: { role: "owner" }, select: { id: true } });
    const lowStockCount = resellers.filter((r) => r.licenses.filter((l) => l.status === "available").length < LOW_STOCK_THRESHOLD).length;
    if (lowStockCount > 0) {
      for (const owner of owners) {
        const recent = await prisma.notification.findFirst({
          where: { userId: owner.id, type: "owner_low_stock", createdAt: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) } },
        });
        if (!recent) {
          await notify({ userId: owner.id, type: "owner_low_stock",
            title: "Alerta de stock",
            body: `${lowStockCount} revendedor${lowStockCount !== 1 ? "es tienen" : " tiene"} menos de ${LOW_STOCK_THRESHOLD} keys disponibles.`,
          });
        }
      }
    }

    log.job.info({ resellers: resellers.length }, "Stock warning job completed");
  } catch (err) {
    log.job.error(err, "Stock warning job failed");
  }
}

// Expose job fn for admin route
app.set("stockWarningJob", runStockWarningJob);

// Run immediately then on schedule
runExpirationJob();
setInterval(runExpirationJob, 60 * 60 * 1000);

runStockWarningJob().catch(() => {});
setInterval(() => runStockWarningJob().catch(() => {}), 6 * 60 * 60 * 1000);

// Daily backup at 03:00
function scheduleDailyBackup() {
  const now  = new Date();
  const next = new Date(now);
  next.setHours(3, 0, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  const delay = next.getTime() - now.getTime();
  setTimeout(async () => {
    await runBackup().catch((err) => log.job.error(err, "Auto backup failed"));
    setInterval(() => runBackup().catch((err) => log.job.error(err, "Auto backup failed")), 24 * 60 * 60 * 1000);
  }, delay);
  log.job.info({ nextBackupIn: `${Math.round(delay / 60000)}min` }, "Daily backup scheduled");
}
scheduleDailyBackup();

// ── Startup DB check ──────────────────────────────────────────────────────────
async function startupChecks() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    log.app.info("Database connection OK");
  } catch (err) {
    log.app.error(err, "Database connection FAILED — exiting");
    process.exit(1);
  }
}

// ── Graceful shutdown ─────────────────────────────────────────────────────────
async function shutdown(signal) {
  log.app.info({ signal }, "Shutting down gracefully...");
  server.close(async () => {
    await prisma.$disconnect().catch(() => {});
    log.app.info("Server closed");
    process.exit(0);
  });
  setTimeout(() => { log.app.warn("Forced shutdown after timeout"); process.exit(1); }, 10000);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT",  () => shutdown("SIGINT"));
process.on("uncaughtException",  (err) => { log.error.fatal(err, "Uncaught exception"); process.exit(1); });
process.on("unhandledRejection", (err) => { log.error.error(err, "Unhandled rejection"); });

// ── Start ─────────────────────────────────────────────────────────────────────
startupChecks().then(() => {
  server.listen(PORT, () => {
    log.app.info({ port: PORT, env: process.env.NODE_ENV || "development" }, "GianAuth backend started");
  });
});
