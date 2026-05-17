const express  = require("express");
const prisma   = require("../lib/prisma");
const { authenticate, requireOwner, requireActive } = require("../middleware/auth");
const { audit, notify }                             = require("../lib/helpers");
const { schemas, validate }                         = require("../lib/validate");
const { ACTION_LABELS }                             = require("../lib/discord");
const eventBus = require("../lib/eventBus");

const router = express.Router();

function emitToRoom(req, room, event, data) {
  eventBus.emit(event, { ...data, _room: room });
}

// Merge live license data with snapshot fallback so consumers never get nulls
function withLicenseFallback(request) {
  if (request.license) return request;
  if (!request.licenseSnapshot) return request;
  try {
    const snap = JSON.parse(request.licenseSnapshot);
    return {
      ...request,
      license: {
        key:          snap.key          ?? "[deleted]",
        duration:     snap.duration     ?? 0,
        assignedUser: snap.assignedUser ?? null,
        product: {
          name: snap.productName ?? "-",
          slug: snap.productSlug ?? "-",
        },
      },
      licenseDeleted: true,
    };
  } catch {
    return request;
  }
}

// GET /api/requests/:id
router.get("/:id", authenticate, requireActive, async (req, res, next) => {
  try {
    const id      = parseInt(req.params.id);
    const request = await prisma.request.findUnique({
      where: { id },
      include: {
        license:  { select: { key: true, duration: true, assignedUser: true, product: { select: { name: true, slug: true } } } },
        reseller: { select: { id: true, username: true } },
      },
    });
    if (!request) return res.status(404).json({ error: "Solicitud no encontrada" });
    if (req.user.role === "reseller" && request.resellerId !== req.user.id) {
      return res.status(403).json({ error: "No autorizado" });
    }
    if (req.user.role !== "owner") delete request.discordMessageId;
    res.json(withLicenseFallback(request));
  } catch (err) { next(err); }
});

// GET /api/requests
router.get("/", authenticate, requireActive, async (req, res, next) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page  || "1")  || 1);
    const limit = Math.min(100, parseInt(req.query.limit || "20") || 20);
    const { status } = req.query;
    const where = {};
    if (req.user.role === "reseller") where.resellerId = req.user.id;
    if (status) where.status = status;

    const skip = (page - 1) * limit;
    const [requests, total] = await Promise.all([
      prisma.request.findMany({
        where,
        include: {
          license:  { select: { key: true, duration: true, assignedUser: true, product: { select: { name: true, slug: true } } } },
          reseller: { select: { id: true, username: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.request.count({ where }),
    ]);

    res.json({ requests: requests.map(withLicenseFallback), total, page, pages: Math.ceil(total / limit) });
  } catch (err) { next(err); }
});

// POST /api/requests
router.post("/", authenticate, requireActive, validate(schemas.createRequest), async (req, res, next) => {
  try {
    const { licenseId, type, comment } = req.body;

    const license = await prisma.license.findUnique({
      where: { id: licenseId, isDeleted: false },
      include: { product: { select: { name: true, slug: true, active: true } } },
    });
    if (!license) return res.status(404).json({ error: "Key no encontrada" });
    if (req.user.role === "reseller" && license.resellerId !== req.user.id) {
      return res.status(403).json({ error: "No autorizado" });
    }
    if (!license.product?.active) {
      return res.status(400).json({ error: "Este producto está deshabilitado" });
    }

    // Límite diario de resets
    if (type === "reset_hwid") {
      const reseller = await prisma.user.findUnique({ where: { id: req.user.id } });
      if (reseller.maxResetsDay !== null) {
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const resetsToday = await prisma.request.count({
          where: { resellerId: req.user.id, type: "reset_hwid", createdAt: { gte: today } },
        });
        if (resetsToday >= reseller.maxResetsDay) {
          return res.status(429).json({ error: `Límite diario de ${reseller.maxResetsDay} resets alcanzado` });
        }
      }
    }

    const existing = await prisma.request.findFirst({
      where: { licenseId, type, status: "pending" },
    });
    if (existing) return res.status(409).json({ error: "Ya existe una solicitud pendiente de este tipo" });

    const reseller = await prisma.user.findUnique({ where: { id: req.user.id }, select: { username: true } });

    // Build immutable snapshot of license state at request creation time
    const snapshot = JSON.stringify({
      key:             license.key,
      duration:        license.duration,
      status:          license.status,
      productId:       license.productId,
      productName:     license.product?.name ?? null,
      productSlug:     license.product?.slug ?? null,
      resellerId:      license.resellerId,
      resellerUsername: reseller.username,
      assignedUser:    license.assignedUser ?? null,
    });

    const request = await prisma.request.create({
      data: { licenseId, type, comment, resellerId: req.user.id, licenseSnapshot: snapshot },
      include: {
        license:  { select: { key: true, duration: true, assignedUser: true, product: { select: { name: true } } } },
        reseller: { select: { username: true } },
      },
    });

    await audit({ actorId: req.user.id, actorRole: req.user.role, action: "CREATE_REQUEST",
      targetType: "request", targetId: request.id,
      metadata: { type, licenseId, key: license.key }, ip: req.ip });

    eventBus.emit("request:new", {
      id: request.id, type: request.type, status: request.status, comment: request.comment,
      reseller: request.reseller, license: request.license, createdAt: request.createdAt,
    });

    res.status(201).json(request);
  } catch (err) { next(err); }
});

// PATCH /api/requests/:id
router.patch("/:id", authenticate, requireOwner, validate(schemas.resolveRequest), async (req, res, next) => {
  try {
    const id                    = parseInt(req.params.id);
    const { status, resolvedNote } = req.body;

    const request = await prisma.request.findUnique({
      where: { id },
      include: {
        license:  { select: { key: true, product: { select: { name: true } } } },
        reseller: { select: { id: true, username: true } },
      },
    });
    if (!request) return res.status(404).json({ error: "Solicitud no encontrada" });

    const validTransitions = { pending: ["approved", "rejected"], approved: ["completed", "rejected"] };
    if (!validTransitions[request.status]?.includes(status)) {
      return res.status(409).json({ error: `No se puede pasar de '${request.status}' a '${status}'` });
    }

    const updated = await prisma.request.update({
      where: { id },
      data:  { status, resolvedNote, resolvedAt: new Date() },
    });

    await audit({ actorId: req.user.id, actorRole: req.user.role,
      action: `REQUEST_${status.toUpperCase()}`,
      targetType: "request", targetId: id,
      metadata: { type: request.type, key: request.license?.key ?? "[deleted]", resolvedNote }, ip: req.ip });

    const notifMessages = {
      approved:  { type: "request_approved",  title: "Solicitud aprobada",   body: `Tu solicitud de ${ACTION_LABELS[request.type]} fue aprobada.${request.license?.key ? ` Key: ${request.license.key}` : ""}` },
      rejected:  { type: "request_rejected",  title: "Solicitud rechazada",  body: `Tu solicitud de ${ACTION_LABELS[request.type]} fue rechazada.${resolvedNote ? ` Motivo: ${resolvedNote}` : ""}` },
      completed: { type: "request_completed", title: "Solicitud completada", body: `Tu solicitud de ${ACTION_LABELS[request.type]} fue completada.${request.license?.key ? ` Key: ${request.license.key}` : ""}` },
    };
    await notify({ userId: request.reseller.id, ...notifMessages[status] });

    eventBus.emit("request:updated", { id, status, resellerId: request.reseller.id });

    res.json(updated);
  } catch (err) { next(err); }
});

// PATCH /api/requests/:id/discord-message
// Bot saves the Discord message ID after sending the embed.
router.patch("/:id/discord-message", authenticate, requireOwner, async (req, res, next) => {
  try {
    const id        = parseInt(req.params.id);
    const { messageId } = req.body;
    if (!messageId || typeof messageId !== "string") {
      return res.status(400).json({ error: "messageId requerido" });
    }
    await prisma.request.update({ where: { id }, data: { discordMessageId: messageId } });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// DELETE /api/requests/:id/discord-message
// Bot clears the Discord message ID when the message is deleted or request is terminal.
router.delete("/:id/discord-message", authenticate, requireOwner, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    await prisma.request.update({ where: { id }, data: { discordMessageId: null } });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// PATCH /api/requests/license/:id/meta
router.patch("/license/:id/meta", authenticate, requireActive, validate(schemas.updateMeta), async (req, res, next) => {
  try {
    const id      = parseInt(req.params.id);
    const license = await prisma.license.findUnique({ where: { id, isDeleted: false } });
    if (!license) return res.status(404).json({ error: "Key no encontrada" });
    if (req.user.role === "reseller" && license.resellerId !== req.user.id) {
      return res.status(403).json({ error: "No autorizado" });
    }

    const { assignedUser, notes } = req.body;
    const updated = await prisma.license.update({ where: { id }, data: { assignedUser, notes } });

    await audit({ actorId: req.user.id, actorRole: req.user.role, action: "UPDATE_LICENSE_META",
      targetType: "license", targetId: id, metadata: { assignedUser, notes }, ip: req.ip });

    res.json(updated);
  } catch (err) { next(err); }
});

module.exports = router;
