const express   = require("express");
const prisma    = require("../lib/prisma");
const { authenticate, requireOwner, requireActive } = require("../middleware/auth");
const { audit }             = require("../lib/helpers");
const { schemas, validate } = require("../lib/validate");
const eventBus  = require("../lib/eventBus");

const router = express.Router();

// GET /api/products
router.get("/", authenticate, requireActive, async (req, res, next) => {
  try {
    const where    = req.user.role === "reseller" ? { active: true } : {};
    const products = await prisma.product.findMany({ where, orderBy: { name: "asc" } });
    res.json(products);
  } catch (err) { next(err); }
});

// POST /api/products
router.post("/", authenticate, requireOwner, validate(schemas.createProduct), async (req, res, next) => {
  try {
    const { name, slug } = req.body;
    const exists = await prisma.product.findUnique({ where: { slug } });
    if (exists) return res.status(409).json({ error: "Ya existe un producto con ese slug" });

    const product = await prisma.product.create({ data: { name, slug } });

    await audit({ actorId: req.user.id, actorRole: req.user.role, action: "CREATE_PRODUCT",
      targetType: "product", targetId: product.id, metadata: { name, slug }, ip: req.ip });

    res.status(201).json(product);
  } catch (err) { next(err); }
});

// PATCH /api/products/:id
router.patch("/:id", authenticate, requireOwner, validate(schemas.updateProduct), async (req, res, next) => {
  try {
    const id      = parseInt(req.params.id);
    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) return res.status(404).json({ error: "Producto no encontrado" });

    const { name, active } = req.body;
    const updated = await prisma.product.update({
      where: { id },
      data:  { ...(name !== undefined && { name }), ...(active !== undefined && { active }) },
    });

    await audit({ actorId: req.user.id, actorRole: req.user.role, action: "UPDATE_PRODUCT",
      targetType: "product", targetId: id, metadata: { name, active }, ip: req.ip });

    if (active !== undefined) {
      eventBus.emit("product:state_changed", { id, active: updated.active, timestamp: new Date().toISOString() });
    }

    res.json(updated);
  } catch (err) { next(err); }
});

// DELETE /api/products/:id
router.delete("/:id", authenticate, requireOwner, async (req, res, next) => {
  try {
    const id         = parseInt(req.params.id);
    const product    = await prisma.product.findUnique({ where: { id } });
    if (!product) return res.status(404).json({ error: "Producto no encontrado" });

    const activeKeys = await prisma.license.count({ where: { productId: id, isDeleted: false } });
    if (activeKeys > 0) return res.status(409).json({ error: `No se puede eliminar: tiene ${activeKeys} keys activas` });

    await prisma.product.delete({ where: { id } });
    res.json({ message: "Producto eliminado" });
  } catch (err) { next(err); }
});

module.exports = router;
