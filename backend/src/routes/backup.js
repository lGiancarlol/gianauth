const express = require("express");
const path    = require("path");
const fs      = require("fs");
const prisma  = require("../lib/prisma");
const { authenticate, requireOwner, requireActive } = require("../middleware/auth");
const { audit } = require("../lib/helpers");

const router = express.Router();
router.use(authenticate, requireActive);

// GET /api/backup/my-licenses.csv — any reseller exports their own licenses
router.get("/my-licenses.csv", async (req, res, next) => {
  try {
    const licenses = await prisma.license.findMany({
      where:   { resellerId: req.user.id, isDeleted: false },
      include: { product: { select: { name: true } } },
      orderBy: { claimedAt: "desc" },
    });

    const header = "key,status,product,duration,clientAlias,assignedUser,claimedAt,expiresAt,notes";
    const rows   = licenses.map((l) =>
      [
        l.key, l.status, l.product?.name ?? "", l.duration,
        l.clientAlias ?? "", l.assignedUser ?? "",
        l.claimedAt ? new Date(l.claimedAt).toISOString().slice(0, 10) : "",
        l.expiresAt ? new Date(l.expiresAt).toISOString().slice(0, 10) : "",
        (l.notes ?? "").replace(/,/g, " "),
      ].join(",")
    );

    res.setHeader("Content-Disposition", `attachment; filename="mis-keys-${new Date().toISOString().slice(0,10)}.csv"`);
    res.setHeader("Content-Type", "text/csv");
    res.send([header, ...rows].join("\n"));
  } catch (err) { next(err); }
});

// ── Owner-only routes ─────────────────────────────────────────────────────────
router.use(requireOwner);

// GET /api/backup/db — download SQLite file (dev/SQLite only)
router.get("/db", async (req, res, next) => {
  try {
    const isPostgres = (process.env.DATABASE_URL || "").startsWith("postgresql") ||
                       (process.env.DATABASE_URL || "").startsWith("postgres");
    if (isPostgres) {
      return res.status(400).json({ error: "Descarga directa de DB no disponible en PostgreSQL. Usa /api/system/backups para descargar un pg_dump." });
    }
    const dbPath = path.resolve(__dirname, "../../prisma/dev.db");
    if (!fs.existsSync(dbPath)) return res.status(404).json({ error: "Base de datos no encontrada" });

    await audit({ actorId: req.user.id, actorRole: req.user.role, action: "BACKUP_DB", ip: req.ip });

    const filename = `gianauth-backup-${new Date().toISOString().slice(0, 10)}.db`;
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Type", "application/octet-stream");
    fs.createReadStream(dbPath).pipe(res);
  } catch (err) { next(err); }
});

// GET /api/backup/licenses.csv — export all licenses as CSV
router.get("/licenses.csv", async (req, res, next) => {
  try {
    const licenses = await prisma.license.findMany({
      where:   { isDeleted: false },
      include: {
        product:  { select: { name: true } },
        reseller: { select: { username: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const header = "id,key,status,duration,product,reseller,assignedUser,claimedAt,expiresAt,createdAt";
    const rows   = licenses.map((l) =>
      [l.id, l.key, l.status, l.duration, l.product?.name ?? "", l.reseller?.username ?? "",
       l.assignedUser ?? "", l.claimedAt ?? "", l.expiresAt ?? "", l.createdAt].join(",")
    );

    await audit({ actorId: req.user.id, actorRole: req.user.role, action: "EXPORT_LICENSES_CSV",
      metadata: { count: licenses.length }, ip: req.ip });

    res.setHeader("Content-Disposition", `attachment; filename="licenses-${new Date().toISOString().slice(0,10)}.csv"`);
    res.setHeader("Content-Type", "text/csv");
    res.send([header, ...rows].join("\n"));
  } catch (err) { next(err); }
});

// GET /api/backup/logs.csv — export audit logs as CSV
router.get("/logs.csv", async (req, res, next) => {
  try {
    const logs = await prisma.auditLog.findMany({
      include: { actor: { select: { username: true } } },
      orderBy: { createdAt: "desc" },
      take:    10000,
    });

    const header = "id,action,actor,actorRole,targetType,targetId,ip,createdAt";
    const rows   = logs.map((l) =>
      [l.id, l.action, l.actor?.username ?? "", l.actorRole ?? "", l.targetType ?? "",
       l.targetId ?? "", l.ip ?? "", l.createdAt].join(",")
    );

    await audit({ actorId: req.user.id, actorRole: req.user.role, action: "EXPORT_LOGS_CSV",
      metadata: { count: logs.length }, ip: req.ip });

    res.setHeader("Content-Disposition", `attachment; filename="logs-${new Date().toISOString().slice(0,10)}.csv"`);
    res.setHeader("Content-Type", "text/csv");
    res.send([header, ...rows].join("\n"));
  } catch (err) { next(err); }
});

module.exports = router;
