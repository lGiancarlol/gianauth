const express = require("express");
const bcrypt  = require("bcryptjs");
const prisma  = require("../lib/prisma");
const { authenticate, requireOwner }  = require("../middleware/auth");
const { audit }                       = require("../lib/helpers");
const { schemas, validate }           = require("../lib/validate");
const { notify }                      = require("../lib/helpers");
const eventBus = require("../lib/eventBus");

const router = express.Router();

// GET /api/users/owner/profile — accessible by any authenticated user
router.get("/owner/profile", authenticate, async (req, res, next) => {
  try {
    const owner = await prisma.user.findFirst({
      where:  { role: "owner" },
      select: { displayName: true, panelName: true, avatarUrl: true, accentColor: true, socialLinks: true },
    });
    if (!owner) return res.json({});
    res.json({
      ...owner,
      socialLinks: owner.socialLinks ? JSON.parse(owner.socialLinks) : [],
    });
  } catch (err) { next(err); }
});

// All routes below require owner role
router.use(authenticate, requireOwner);

// GET /api/users
router.get("/", async (req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      where: { role: "reseller" },
      select: {
        id: true, username: true, role: true, isBlocked: true, createdAt: true,
        maxClaimsDay: true, maxResetsDay: true,
        displayName: true, panelName: true, accentColor: true, avatarUrl: true,
        renewalDate: true, renewalStatus: true, renewalNote: true,
        _count: { select: { licenses: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const withStock = await Promise.all(
      users.map(async (u) => {
        const [available, used] = await Promise.all([
          prisma.license.count({ where: { resellerId: u.id, status: "available", isDeleted: false } }),
          prisma.license.count({ where: { resellerId: u.id, status: "used",      isDeleted: false } }),
        ]);
        return { ...u, availableKeys: available, usedKeys: used };
      })
    );

    res.json(withStock);
  } catch (err) { next(err); }
});

// GET /api/users/:id/stock
router.get("/:id/stock", async (req, res, next) => {
  try {
    const id   = parseInt(req.params.id);
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return res.status(404).json({ error: "Revendedor no encontrado" });

    const [stock, batches] = await Promise.all([
      prisma.license.groupBy({
        by: ["productId", "duration", "status"],
        where: { resellerId: id, isDeleted: false },
        _count: { id: true },
        orderBy: [{ productId: "asc" }, { duration: "asc" }],
      }),
      prisma.batch.findMany({
        where: { resellerId: id },
        include: { product: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
    ]);

    const productIds  = [...new Set(stock.map((s) => s.productId))];
    const products    = await prisma.product.findMany({ where: { id: { in: productIds } } });
    const productMap  = Object.fromEntries(products.map((p) => [p.id, p]));

    res.json({ stock: stock.map((s) => ({ ...s, product: productMap[s.productId] })), batches });
  } catch (err) { next(err); }
});

// POST /api/users
router.post("/", validate(schemas.createUser), async (req, res, next) => {
  try {
    const { username, password } = req.body;

    const exists = await prisma.user.findUnique({ where: { username } });
    if (exists) return res.status(409).json({ error: "El usuario ya existe" });

    const hashed = await bcrypt.hash(password, 10);
    const user   = await prisma.user.create({
      data: { username, password: hashed, role: "reseller" },
      select: { id: true, username: true, role: true, createdAt: true },
    });

    await audit({ actorId: req.user.id, actorRole: req.user.role, action: "CREATE_USER",
      targetType: "user", targetId: user.id, metadata: { username }, ip: req.ip });

    res.status(201).json(user);
  } catch (err) { next(err); }
});

// PATCH /api/users/:id/block
router.patch("/:id/block", async (req, res, next) => {
  try {
    const id   = parseInt(req.params.id);
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return res.status(404).json({ error: "Usuario no encontrado" });

    const updated = await prisma.user.update({
      where: { id },
      data:  { isBlocked: !user.isBlocked },
      select: { id: true, username: true, isBlocked: true },
    });

    await audit({ actorId: req.user.id, actorRole: req.user.role,
      action: updated.isBlocked ? "BLOCK_USER" : "UNBLOCK_USER",
      targetType: "user", targetId: id, metadata: { username: user.username }, ip: req.ip });

    eventBus.emit("user:blocked", { userId: id, isBlocked: updated.isBlocked });

    res.json(updated);
  } catch (err) { next(err); }
});

// PATCH /api/users/:id/branding
router.patch("/:id/branding", validate(schemas.updateBranding), async (req, res, next) => {
  try {
    const id   = parseInt(req.params.id);
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user || user.role !== "reseller") return res.status(404).json({ error: "Revendedor no encontrado" });

    const { displayName, panelName, accentColor, avatarUrl } = req.body;
    const updated = await prisma.user.update({
      where: { id },
      data: {
        ...(displayName !== undefined && { displayName: displayName || null }),
        ...(panelName   !== undefined && { panelName:   panelName   || null }),
        ...(accentColor !== undefined && { accentColor: accentColor || null }),
        ...(avatarUrl   !== undefined && { avatarUrl:   avatarUrl   || null }),
      },
      select: { id: true, username: true, displayName: true, panelName: true, accentColor: true, avatarUrl: true },
    });

    await audit({ actorId: req.user.id, actorRole: req.user.role, action: "UPDATE_BRANDING",
      targetType: "user", targetId: id,
      metadata: { displayName, panelName, accentColor, avatarUrl }, ip: req.ip });

    eventBus.emit("user:branding_updated", { userId: id, displayName, panelName, accentColor, avatarUrl });

    res.json(updated);
  } catch (err) { next(err); }
});

// PATCH /api/users/:id/limits
router.patch("/:id/limits", validate(schemas.updateLimits), async (req, res, next) => {
  try {
    const id   = parseInt(req.params.id);
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return res.status(404).json({ error: "Usuario no encontrado" });

    const { maxClaimsDay, maxResetsDay } = req.body;
    const updated = await prisma.user.update({
      where: { id },
      data: {
        maxClaimsDay: maxClaimsDay !== undefined ? maxClaimsDay : user.maxClaimsDay,
        maxResetsDay: maxResetsDay !== undefined ? maxResetsDay : user.maxResetsDay,
      },
      select: { id: true, username: true, maxClaimsDay: true, maxResetsDay: true },
    });

    await audit({ actorId: req.user.id, actorRole: req.user.role, action: "UPDATE_LIMITS",
      targetType: "user", targetId: id, metadata: { maxClaimsDay, maxResetsDay }, ip: req.ip });

    res.json(updated);
  } catch (err) { next(err); }
});

// PATCH /api/users/:id/renewal
router.patch("/:id/renewal", validate(schemas.updateRenewal), async (req, res, next) => {
  try {
    const id   = parseInt(req.params.id);
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user || user.role !== "reseller") return res.status(404).json({ error: "Revendedor no encontrado" });

    const { renewalDate, renewalStatus, renewalNote } = req.body;
    const updated = await prisma.user.update({
      where: { id },
      data: {
        ...(renewalDate   !== undefined && { renewalDate:   renewalDate ? new Date(renewalDate) : null }),
        ...(renewalStatus !== undefined && { renewalStatus }),
        ...(renewalNote   !== undefined && { renewalNote:   renewalNote || null }),
      },
      select: { id: true, username: true, renewalDate: true, renewalStatus: true, renewalNote: true },
    });

    await audit({ actorId: req.user.id, actorRole: req.user.role, action: "UPDATE_RENEWAL",
      targetType: "user", targetId: id,
      metadata: { renewalDate, renewalStatus, renewalNote }, ip: req.ip });

    // Notify reseller
    if (renewalStatus === "overdue") {
      await notify({ userId: id, type: "renewal_overdue", title: "Renovaci\u00f3n vencida", body: "Tu renovaci\u00f3n est\u00e1 vencida. Contacta al administrador." });
    } else if (renewalStatus === "pending") {
      await notify({ userId: id, type: "renewal_pending", title: "Renovaci\u00f3n pr\u00f3xima", body: "Tu renovaci\u00f3n est\u00e1 pr\u00f3xima. Contacta al administrador para renovar." });
    }

    res.json(updated);
  } catch (err) { next(err); }
});

// DELETE /api/users/:id
router.delete("/:id", async (req, res, next) => {
  try {
    const id   = parseInt(req.params.id);
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return res.status(404).json({ error: "Usuario no encontrado" });

    await prisma.user.delete({ where: { id } });

    await audit({ actorId: req.user.id, actorRole: req.user.role, action: "DELETE_USER",
      targetType: "user", targetId: id, metadata: { username: user.username }, ip: req.ip });

    res.json({ message: "Usuario eliminado" });
  } catch (err) { next(err); }
});

// PATCH /api/users/:id/profile — owner updates their own social links + branding
router.patch("/:id/profile", validate(schemas.updateOwnerProfile), async (req, res, next) => {
  try {
    const id   = parseInt(req.params.id);
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user || user.role !== "owner") return res.status(404).json({ error: "Perfil no encontrado" });

    const { displayName, panelName, accentColor, avatarUrl, socialLinks } = req.body;

    // Ensure every link has a stable UUID — frontend may omit it on first save
    const { randomUUID } = require("crypto");
    const normalizedLinks = socialLinks?.map((l) => ({
      id:    l.id ?? randomUUID(),
      type:  l.type,
      label: l.label,
      url:   l.url,
    }));

    const updated = await prisma.user.update({
      where: { id },
      data: {
        ...(displayName  !== undefined && { displayName:  displayName  ?? null }),
        ...(panelName    !== undefined && { panelName:    panelName    ?? null }),
        ...(accentColor  !== undefined && { accentColor:  accentColor  ?? null }),
        ...(avatarUrl    !== undefined && { avatarUrl:    avatarUrl    ?? null }),
        ...(socialLinks  !== undefined && { socialLinks:  JSON.stringify(normalizedLinks) }),
      },
      select: { id: true, displayName: true, panelName: true, accentColor: true, avatarUrl: true, socialLinks: true },
    });

    const parsedLinks = updated.socialLinks ? JSON.parse(updated.socialLinks) : [];

    await audit({ actorId: req.user.id, actorRole: req.user.role, action: "UPDATE_OWNER_PROFILE",
      targetType: "user", targetId: id, metadata: { linkCount: parsedLinks.length }, ip: req.ip });

    eventBus.emit("owner:profile_updated", {
      displayName:  updated.displayName,
      panelName:    updated.panelName,
      accentColor:  updated.accentColor,
      avatarUrl:    updated.avatarUrl,
      socialLinks:  parsedLinks,
    });

    res.json({ ...updated, socialLinks: parsedLinks });
  } catch (err) { next(err); }
});

module.exports = router;
