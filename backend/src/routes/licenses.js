const express   = require("express");
const prisma    = require("../lib/prisma");
const { authenticate, requireOwner, requireActive } = require("../middleware/auth");
const { audit, notify, calcExpiresAt }              = require("../lib/helpers");
const { schemas, validate, validateQuery }          = require("../lib/validate");
const eventBus  = require("../lib/eventBus");

const router = express.Router();

// GET /api/licenses
router.get("/", authenticate, requireActive, validateQuery(schemas.licensesQuery), async (req, res, next) => {
  try {
    const { product, status, duration, search, page, limit } = req.query;
    const where = { isDeleted: false };

    if (req.user.role === "reseller") where.resellerId = req.user.id;
    if (product)  where.productId = product;
    if (status)   where.status    = status;
    if (duration) where.duration  = duration;
    if (search && search.length >= 2) {
      const mode = process.env.DATABASE_URL?.startsWith("postgresql") ? "insensitive" : undefined;
      const contains = () => mode ? { contains: search, mode } : { contains: search };
      where.OR = [
        { key:          contains() },
        { clientAlias:  contains() },
        { assignedUser: contains() },
        { product: { name: contains() } },
      ];
    }

    const skip = (page - 1) * limit;
    const [licenses, total] = await Promise.all([
      prisma.license.findMany({
        where,
        include: {
          reseller: { select: { id: true, username: true } },
          product:  { select: { id: true, name: true, slug: true } },
        },
        orderBy: [{ favorite: "desc" }, { createdAt: "desc" }],
        skip,
        take: limit,
      }),
      prisma.license.count({ where }),
    ]);

    res.json({ licenses, total, page, pages: Math.ceil(total / limit) });
  } catch (err) { next(err); }
});

// GET /api/licenses/ids — returns only IDs for bulk selection, respects ownership
router.get("/ids", authenticate, requireActive, validateQuery(schemas.licensesQuery), async (req, res, next) => {
  try {
    const { product, status, search } = req.query;
    const where = { isDeleted: false };

    if (req.user.role === "reseller") where.resellerId = req.user.id;
    if (product) where.productId = product;
    if (status)  where.status    = status;
    if (search && search.length >= 2) {
      const mode = process.env.DATABASE_URL?.startsWith("postgresql") ? "insensitive" : undefined;
      const contains = () => mode ? { contains: search, mode } : { contains: search };
      where.OR = [
        { key:          contains() },
        { clientAlias:  contains() },
        { assignedUser: contains() },
        { product: { name: contains() } },
      ];
    }

    const licenses = await prisma.license.findMany({
      where,
      select: { id: true },
      orderBy: { createdAt: "desc" },
    });

    res.json({ ids: licenses.map((l) => l.id) });
  } catch (err) { next(err); }
});

// GET /api/licenses/stock
router.get("/stock", authenticate, requireActive, async (req, res, next) => {
  try {
    const where = { status: "available", isDeleted: false };
    if (req.user.role === "reseller") where.resellerId = req.user.id;

    const stock = await prisma.license.groupBy({
      by: ["productId", "duration"],
      where,
      _count: { id: true },
      orderBy: [{ productId: "asc" }, { duration: "asc" }],
    });

    const productIds = [...new Set(stock.map((s) => s.productId))];
    const products   = await prisma.product.findMany({ where: { id: { in: productIds } } });
    const productMap = Object.fromEntries(products.map((p) => [p.id, p]));

    res.json(stock.map((s) => ({ ...s, product: productMap[s.productId] })));
  } catch (err) { next(err); }
});

// GET /api/licenses/deleted
router.get("/deleted", authenticate, requireOwner, async (req, res, next) => {
  try {
    const licenses = await prisma.license.findMany({
      where: { isDeleted: true },
      include: {
        reseller: { select: { id: true, username: true } },
        product:  { select: { name: true } },
      },
      orderBy: { deletedAt: "desc" },
    });
    res.json(licenses);
  } catch (err) { next(err); }
});

// POST /api/licenses/import
router.post("/import", authenticate, requireOwner, validate(schemas.importLicenses), async (req, res, next) => {
  try {
    const { keys, productId, duration, resellerId } = req.body;

    const [reseller, product] = await Promise.all([
      prisma.user.findUnique({ where: { id: resellerId } }),
      prisma.product.findUnique({ where: { id: productId } }),
    ]);
    if (!reseller || reseller.role !== "reseller") return res.status(404).json({ error: "Revendedor no encontrado" });
    if (!product  || !product.active)              return res.status(404).json({ error: "Producto no encontrado o inactivo" });

    const uniqueKeys   = [...new Set(keys.map((k) => k.trim()).filter(Boolean))];
    const existing     = await prisma.license.findMany({ where: { key: { in: uniqueKeys } }, select: { key: true } });
    const existingSet  = new Set(existing.map((l) => l.key));
    const newKeys      = uniqueKeys.filter((k) => !existingSet.has(k));

    if (newKeys.length === 0) return res.status(409).json({ error: "Todas las keys ya existen" });

    await prisma.$transaction([
      prisma.license.createMany({
        data: newKeys.map((key) => ({ key, productId, duration, resellerId })),
      }),
      prisma.batch.create({
        data: { productId, duration, quantity: newKeys.length, resellerId },
      }),
    ]);

    await audit({ actorId: req.user.id, actorRole: req.user.role, action: "ASSIGN_KEYS",
      targetType: "user", targetId: resellerId,
      metadata: { product: product.name, duration, quantity: newKeys.length, skipped: uniqueKeys.length - newKeys.length },
      ip: req.ip });

    await notify({ userId: resellerId, type: "key_assigned",
      title: "Nuevo lote asignado",
      body: `Se te asignaron ${newKeys.length} keys de ${product.name} (${duration} días)` });

    eventBus.emit("license:imported", { resellerId, productId, quantity: newKeys.length });

    res.status(201).json({ imported: newKeys.length, skipped: uniqueKeys.length - newKeys.length });
  } catch (err) { next(err); }
});

// POST /api/licenses/bulk-delete  (owner only)
router.post("/bulk-delete", authenticate, requireOwner, validate(schemas.bulkDeleteLicenses), async (req, res, next) => {
  try {
    const { ids } = req.body;

    // Only operate on licenses that exist and are not already deleted
    const licenses = await prisma.license.findMany({
      where: { id: { in: ids }, isDeleted: false },
      select: { id: true, status: true, resellerId: true },
    });

    if (licenses.length === 0) {
      return res.status(404).json({ error: "No se encontraron licencias válidas para eliminar" });
    }

    const validIds = licenses.map((l) => l.id);
    const now      = new Date();

    await prisma.$transaction([
      // Soft-delete all valid licenses
      prisma.license.updateMany({
        where: { id: { in: validIds } },
        data:  { isDeleted: true, deletedAt: now, status: "blocked" },
      }),
      // Mark related pending/approved requests as licenseDeleted, preserve licenseSnapshot
      prisma.request.updateMany({
        where: { licenseId: { in: validIds }, status: { in: ["pending", "approved"] } },
        data:  { licenseDeleted: true },
      }),
    ]);

    await audit({
      actorId:    req.user.id,
      actorRole:  req.user.role,
      action:     "OWNER_BULK_DELETE_LICENSES",
      targetType: "license",
      targetId:   null,
      metadata:   { ownerId: req.user.id, count: validIds.length, ids: validIds },
      ip:         req.ip,
    });

    eventBus.emit("license:bulk_deleted", {
      ids:       validIds,
      ownerId:   req.user.id,
      timestamp: now.toISOString(),
    });

    res.json({ deleted: validIds.length, ids: validIds });
  } catch (err) { next(err); }
});

// POST /api/licenses/claim
router.post("/claim", authenticate, requireActive, validate(schemas.claimLicense), async (req, res, next) => {
  try {
    const { productId, duration } = req.body;
    const reseller = await prisma.user.findUnique({ where: { id: req.user.id } });

    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product || !product.active) {
      return res.status(400).json({ error: "Este producto está deshabilitado" });
    }
    if (reseller.maxClaimsDay !== null) {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const claimsToday = await prisma.license.count({
        where: { resellerId: req.user.id, claimedAt: { gte: today } },
      });
      if (claimsToday >= reseller.maxClaimsDay) {
        return res.status(429).json({ error: `Límite diario de ${reseller.maxClaimsDay} claims alcanzado` });
      }
    }

    const claimed = await prisma.$transaction(async (tx) => {
      const license = await tx.license.findFirst({
        where: { productId, duration, status: "available", resellerId: req.user.id, isDeleted: false },
        orderBy: { createdAt: "asc" },
      });
      if (!license) return null;

      const now = new Date();
      return tx.license.update({
        where: { id: license.id },
        data:  { status: "used", claimedAt: now, expiresAt: calcExpiresAt(now, duration) },
        include: { product: { select: { name: true, slug: true } } },
      });
    });

    if (!claimed) return res.status(404).json({ error: "No tienes keys disponibles para ese producto y duración" });

    await audit({ actorId: req.user.id, actorRole: req.user.role, action: "CLAIM_KEY",
      targetType: "license", targetId: claimed.id,
      metadata: { key: claimed.key, product: claimed.product.name, duration, expiresAt: claimed.expiresAt },
      ip: req.ip });

    eventBus.emit("license:claimed", {
      id:         claimed.id,
      resellerId: req.user.id,
      productId,
      duration,
      expiresAt:  claimed.expiresAt,
    });

    res.json(claimed);
  } catch (err) { next(err); }
});

// PATCH /api/licenses/:id/private
router.patch("/:id/private", authenticate, requireActive, validate(schemas.updatePrivate), async (req, res, next) => {
  try {
    const id      = parseInt(req.params.id);
    const license = await prisma.license.findUnique({ where: { id, isDeleted: false } });
    if (!license) return res.status(404).json({ error: "Key no encontrada" });
    if (req.user.role === "reseller" && license.resellerId !== req.user.id) {
      return res.status(403).json({ error: "No autorizado" });
    }

    const { resellerPrivateStatus, clientAlias, favorite } = req.body;
    const updated = await prisma.license.update({
      where: { id },
      data: {
        ...(resellerPrivateStatus !== undefined && { resellerPrivateStatus }),
        ...(clientAlias           !== undefined && { clientAlias }),
        ...(favorite              !== undefined && { favorite }),
        lastPrivateUpdate: new Date(),
      },
    });
    res.json(updated);
  } catch (err) { next(err); }
});

// PATCH /api/licenses/:id/block
router.patch("/:id/block", authenticate, requireOwner, async (req, res, next) => {
  try {
    const id      = parseInt(req.params.id);
    const license = await prisma.license.findUnique({ where: { id, isDeleted: false } });
    if (!license) return res.status(404).json({ error: "Key no encontrada" });

    const newStatus = license.status === "blocked" ? "available" : "blocked";
    const updated   = await prisma.license.update({ where: { id }, data: { status: newStatus } });

    await audit({ actorId: req.user.id, actorRole: req.user.role,
      action: newStatus === "blocked" ? "BLOCK_KEY" : "UNBLOCK_KEY",
      targetType: "license", targetId: id, metadata: { key: license.key }, ip: req.ip });

    eventBus.emit("license:state_changed", {
      id,
      status:         newStatus,
      previousStatus: license.status,
      resellerId:     license.resellerId,
      deleted:        false,
      timestamp:      new Date().toISOString(),
    });

    res.json(updated);
  } catch (err) { next(err); }
});

// PATCH /api/licenses/:id/restore
router.patch("/:id/restore", authenticate, requireOwner, async (req, res, next) => {
  try {
    const id      = parseInt(req.params.id);
    const license = await prisma.license.findUnique({ where: { id, isDeleted: true } });
    if (!license) return res.status(404).json({ error: "Key no encontrada o no está eliminada" });

    const restored = await prisma.license.update({
      where: { id },
      data:  { isDeleted: false, deletedAt: null, status: "available" },
    });

    await audit({ actorId: req.user.id, actorRole: req.user.role, action: "RESTORE_KEY",
      targetType: "license", targetId: id, metadata: { key: license.key }, ip: req.ip });

    res.json(restored);
  } catch (err) { next(err); }
});

// DELETE /api/licenses/:id
router.delete("/:id", authenticate, requireOwner, async (req, res, next) => {
  try {
    const id      = parseInt(req.params.id);
    const license = await prisma.license.findUnique({ where: { id } });
    if (!license) return res.status(404).json({ error: "Key no encontrada" });

    await prisma.license.update({
      where: { id },
      data:  { isDeleted: true, deletedAt: new Date(), status: "blocked" },
    });

    // Mark all active requests for this license as licenseDeleted
    await prisma.request.updateMany({
      where:  { licenseId: id, status: { in: ["pending", "approved"] } },
      data:   { licenseDeleted: true },
    });

    await audit({ actorId: req.user.id, actorRole: req.user.role, action: "SOFT_DELETE_KEY",
      targetType: "license", targetId: id, metadata: { key: license.key }, ip: req.ip });

    eventBus.emit("license:deleted", {
      id,
      resellerId:     license.resellerId,
      previousStatus: license.status,
      deleted:        true,
      timestamp:      new Date().toISOString(),
    });

    res.json({ message: "Key eliminada" });
  } catch (err) { next(err); }
});

module.exports = router;
