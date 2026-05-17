const express = require("express");
const prisma   = require("../lib/prisma");
const { authenticate, requireActive } = require("../middleware/auth");

const router = express.Router();

router.get("/", authenticate, requireActive, async (req, res, next) => {
  try {
    if (req.user.role === "owner") {
      const [totalKeys, availableKeys, usedKeys, blockedKeys, expiredKeys, totalResellers, pendingRequests, recentLogs, renewalAlerts, openTickets, stockWarnings] =
        await Promise.all([
          prisma.license.count({ where: { isDeleted: false } }),
          prisma.license.count({ where: { status: "available", isDeleted: false } }),
          prisma.license.count({ where: { status: "used",      isDeleted: false } }),
          prisma.license.count({ where: { status: "blocked",   isDeleted: false } }),
          prisma.license.count({ where: { status: "expired",   isDeleted: false } }),
          prisma.user.count({ where: { role: "reseller" } }),
          prisma.request.count({ where: { status: "pending" } }),
          prisma.auditLog.findMany({
            take: 8,
            orderBy: { createdAt: "desc" },
            include: { actor: { select: { id: true, username: true } } },
          }),
          prisma.user.findMany({
            where: {
              role: "reseller",
              renewalDate: { not: null },
              renewalStatus: { in: ["pending", "overdue"] },
            },
            select: { id: true, username: true, displayName: true, renewalDate: true, renewalStatus: true, renewalNote: true },
            orderBy: { renewalDate: "asc" },
            take: 10,
          }),
          prisma.supportTicket.count({ where: { status: { not: "closed" } } }),
          // Resellers with low stock (< 5 available keys)
          prisma.user.findMany({
            where: { role: "reseller", isBlocked: false },
            select: { id: true, username: true, displayName: true,
              licenses: { where: { status: "available", isDeleted: false }, select: { id: true } } },
          }),
        ]);

      const lowStockResellers = stockWarnings
        .filter((u) => u.licenses.length < 5)
        .map((u) => ({ id: u.id, username: u.username, displayName: u.displayName, availableKeys: u.licenses.length }));

      return res.json({ totalKeys, availableKeys, usedKeys, blockedKeys, expiredKeys, totalResellers,
        pendingRequests, recentLogs, renewalAlerts, openTickets, lowStockResellers });
    }

    // Reseller
    const [totalKeys, availableKeys, usedKeys, blockedKeys, pendingRequests, recentClaimed, resellerInfo] =
      await Promise.all([
        prisma.license.count({ where: { resellerId: req.user.id, isDeleted: false } }),
        prisma.license.count({ where: { resellerId: req.user.id, status: "available", isDeleted: false } }),
        prisma.license.count({ where: { resellerId: req.user.id, status: "used",      isDeleted: false } }),
        prisma.license.count({ where: { resellerId: req.user.id, status: "blocked",   isDeleted: false } }),
        prisma.request.count({ where: { resellerId: req.user.id, status: "pending" } }),
        prisma.license.findMany({
          where:   { resellerId: req.user.id, status: "used", isDeleted: false },
          include: { product: { select: { name: true } } },
          take:    5,
          orderBy: { claimedAt: "desc" },
        }),
        prisma.user.findUnique({
          where: { id: req.user.id },
          select: { renewalDate: true, renewalStatus: true, renewalNote: true },
        }),
      ]);

    const stockByProduct = await prisma.license.groupBy({
      by:    ["productId", "duration"],
      where: { resellerId: req.user.id, status: "available", isDeleted: false },
      _count: { id: true },
      orderBy: [{ productId: "asc" }, { duration: "asc" }],
    });

    const productIds = [...new Set(stockByProduct.map((s) => s.productId))];
    const products   = await prisma.product.findMany({ where: { id: { in: productIds } } });
    const productMap = Object.fromEntries(products.map((p) => [p.id, p]));

    res.json({
      totalKeys, availableKeys, usedKeys, blockedKeys, pendingRequests, recentClaimed,
      stockByProduct: stockByProduct.map((s) => ({ ...s, product: productMap[s.productId] })),
      renewal: resellerInfo,
    });
  } catch (err) { next(err); }
});

module.exports = router;
