const express = require("express");
const prisma   = require("../lib/prisma");
const { authenticate, requireOwner } = require("../middleware/auth");
const { schemas, validateQuery }     = require("../lib/validate");

const router = express.Router();

// GET /api/logs
router.get("/", authenticate, requireOwner, validateQuery(schemas.logsQuery), async (req, res, next) => {
  try {
    const { action, actorId, targetType, search, from, to, page, limit } = req.query;
    const where = {};

    if (action)     where.action     = { contains: action };
    if (actorId)    where.actorId    = actorId;
    if (targetType) where.targetType = targetType;
    if (search)     where.OR = [
      { action:    { contains: search } },
      { actorRole: { contains: search } },
      { metadata:  { contains: search } },
    ];
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to)   where.createdAt.lte = new Date(to);
    }

    const skip = (page - 1) * limit;
    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: { actor: { select: { id: true, username: true } } },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.auditLog.count({ where }),
    ]);

    const parsed = logs.map((l) => ({
      ...l,
      metadata: l.metadata
        ? (() => { try { return JSON.parse(l.metadata); } catch { return l.metadata; } })()
        : null,
    }));

    res.json({ logs: parsed, total, page, pages: Math.ceil(total / limit) });
  } catch (err) { next(err); }
});

// GET /api/logs/actions
router.get("/actions", authenticate, requireOwner, async (req, res, next) => {
  try {
    const actions = await prisma.auditLog.findMany({
      select:   { action: true },
      distinct: ["action"],
      orderBy:  { action: "asc" },
    });
    res.json(actions.map((a) => a.action));
  } catch (err) { next(err); }
});

module.exports = router;
