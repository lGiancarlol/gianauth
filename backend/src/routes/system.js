const express = require("express");
const os      = require("os");
const fs      = require("fs");
const prisma  = require("../lib/prisma");
const { authenticate, requireOwner, requireActive } = require("../middleware/auth");
const { audit }          = require("../lib/helpers");
const { runBackup, getBackupHistory, getBackupPath } = require("../lib/autoBackup");
const { z }              = require("zod");

const router = express.Router();
router.use(authenticate, requireActive, requireOwner);

// ── GET /api/system/health ────────────────────────────────────────────────────
router.get("/health", async (req, res, next) => {
  try {
    // DB check
    let dbOk = false;
    try { await prisma.$queryRaw`SELECT 1`; dbOk = true; } catch {}

    const mem     = process.memoryUsage();
    const totMem  = os.totalmem();
    const freeMem = os.freemem();
    const cpus    = os.cpus();
    const load    = os.loadavg();

    // Disk (best-effort — only works on Linux/Mac in prod)
    let diskInfo = null;
    try {
      const { execSync } = require("child_process");
      const raw = execSync("df -k / 2>/dev/null || echo ''").toString().trim();
      const lines = raw.split("\n");
      if (lines.length >= 2) {
        const parts = lines[1].split(/\s+/);
        diskInfo = {
          total:     parseInt(parts[1]) * 1024,
          used:      parseInt(parts[2]) * 1024,
          available: parseInt(parts[3]) * 1024,
        };
      }
    } catch {}

    // Last backup
    const lastBackup = await prisma.backupRecord.findFirst({ orderBy: { createdAt: "desc" } });

    // Socket.IO connected clients
    const io = req.app.get("io");
    const socketCount = io ? io.engine.clientsCount : 0;

    // Pending jobs summary
    const [pendingRequests, openTickets, errorCount] = await Promise.all([
      prisma.request.count({ where: { status: "pending" } }),
      prisma.supportTicket.count({ where: { status: { not: "closed" } } }),
      prisma.errorLog.count({ where: { resolved: false } }),
    ]);

    res.json({
      status:    dbOk ? "ok" : "degraded",
      version:   "3.0.0",
      env:       process.env.NODE_ENV || "development",
      uptime:    Math.floor(process.uptime()),
      db:        { ok: dbOk },
      memory: {
        heapUsed:  mem.heapUsed,
        heapTotal: mem.heapTotal,
        rss:       mem.rss,
        systemTotal: totMem,
        systemFree:  freeMem,
        systemUsedPct: Math.round((1 - freeMem / totMem) * 100),
      },
      cpu: {
        cores:  cpus.length,
        model:  cpus[0]?.model || "unknown",
        load1:  load[0],
        load5:  load[1],
        load15: load[2],
      },
      disk: diskInfo,
      socket: { connected: socketCount },
      lastBackup: lastBackup ? { filename: lastBackup.filename, sizeBytes: lastBackup.sizeBytes, createdAt: lastBackup.createdAt } : null,
      alerts: { pendingRequests, openTickets, unresolvedErrors: errorCount },
    });
  } catch (err) { next(err); }
});

// ── GET /api/system/errors ────────────────────────────────────────────────────
router.get("/errors", async (req, res, next) => {
  try {
    const page     = Math.max(1, parseInt(req.query.page  || "1"));
    const limit    = Math.min(100, parseInt(req.query.limit || "50"));
    const severity = req.query.severity;
    const resolved = req.query.resolved === "true" ? true : req.query.resolved === "false" ? false : undefined;
    const search   = req.query.search;

    const where = {};
    if (severity)            where.severity = severity;
    if (resolved !== undefined) where.resolved = resolved;
    if (search)              where.OR = [
      { message:  { contains: search } },
      { endpoint: { contains: search } },
      { username: { contains: search } },
    ];

    const [errors, total] = await Promise.all([
      prisma.errorLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.errorLog.count({ where }),
    ]);

    res.json({ errors, total, page, pages: Math.ceil(total / limit) });
  } catch (err) { next(err); }
});

// ── PATCH /api/system/errors/:id/resolve ─────────────────────────────────────
router.patch("/errors/:id/resolve", async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    await prisma.errorLog.update({ where: { id }, data: { resolved: true } });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ── DELETE /api/system/errors ─────────────────────────────────────────────────
router.delete("/errors", async (req, res, next) => {
  try {
    const { count } = await prisma.errorLog.deleteMany({ where: { resolved: true } });
    await audit({ actorId: req.user.id, actorRole: req.user.role, action: "CLEAR_RESOLVED_ERRORS",
      metadata: { count }, ip: req.ip });
    res.json({ deleted: count });
  } catch (err) { next(err); }
});

// ── POST /api/system/admin/:action ───────────────────────────────────────────
const ADMIN_ACTIONS = z.enum([
  "clear_old_notifications",
  "clear_old_audit_logs",
  "force_expiration_job",
  "force_stock_warning_job",
  "clear_inactive_sessions",
]);

router.post("/admin/:action", async (req, res, next) => {
  try {
    const parsed = ADMIN_ACTIONS.safeParse(req.params.action);
    if (!parsed.success) return res.status(400).json({ error: "Acción no válida" });

    const action = parsed.data;
    let result   = {};

    if (action === "clear_old_notifications") {
      const days = parseInt(req.body.days || "30");
      const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      const { count } = await prisma.notification.deleteMany({
        where: { isRead: true, createdAt: { lt: cutoff } },
      });
      result = { deleted: count, days };
    }

    if (action === "clear_old_audit_logs") {
      const days = parseInt(req.body.days || "90");
      const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      const { count } = await prisma.auditLog.deleteMany({ where: { createdAt: { lt: cutoff } } });
      result = { deleted: count, days };
    }

    if (action === "force_expiration_job") {
      const { count } = await prisma.license.updateMany({
        where: { status: "used", expiresAt: { lte: new Date() }, isDeleted: false },
        data:  { status: "expired" },
      });
      const io = req.app.get("io");
      if (io && count > 0) io.emit("licenses:expired", { count });
      result = { expired: count };
    }

    if (action === "force_stock_warning_job") {
      // Trigger via app-level reference
      const jobFn = req.app.get("stockWarningJob");
      if (jobFn) await jobFn();
      result = { triggered: true };
    }

    if (action === "clear_inactive_sessions") {
      const { count } = await prisma.session.deleteMany({ where: { isActive: false } });
      result = { deleted: count };
    }

    await audit({ actorId: req.user.id, actorRole: req.user.role, action: `ADMIN_${action.toUpperCase()}`,
      metadata: result, ip: req.ip });

    res.json({ ok: true, action, result });
  } catch (err) { next(err); }
});

// ── GET /api/system/backups ───────────────────────────────────────────────────
router.get("/backups", async (req, res, next) => {
  try {
    const history = await getBackupHistory();
    res.json(history);
  } catch (err) { next(err); }
});

// ── POST /api/system/backups ──────────────────────────────────────────────────
router.post("/backups", async (req, res, next) => {
  try {
    const result = await runBackup();
    if (!result) return res.status(500).json({ error: "No se pudo crear el backup" });
    await audit({ actorId: req.user.id, actorRole: req.user.role, action: "MANUAL_BACKUP",
      metadata: result, ip: req.ip });
    res.json(result);
  } catch (err) { next(err); }
});

// ── GET /api/system/backups/:filename ─────────────────────────────────────────
router.get("/backups/:filename", async (req, res, next) => {
  try {
    const { filename } = req.params;
    // Sanitize: only allow exact backup filename format, no path separators
    if (!/^backup-\d{4}-\d{2}-\d{2}-\d+\.db$/.test(filename)) {
      return res.status(400).json({ error: "Nombre inválido" });
    }
    const filePath = getBackupPath(filename);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: "Backup no encontrado" });

    await audit({ actorId: req.user.id, actorRole: req.user.role, action: "DOWNLOAD_BACKUP",
      metadata: { filename }, ip: req.ip });

    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Type", "application/octet-stream");
    fs.createReadStream(filePath).pipe(res);
  } catch (err) { next(err); }
});

module.exports = router;
