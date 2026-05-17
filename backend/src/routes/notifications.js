const express = require("express");
const prisma   = require("../lib/prisma");
const { authenticate, requireActive } = require("../middleware/auth");

const router = express.Router();

// GET /api/notifications
router.get("/", authenticate, requireActive, async (req, res, next) => {
  try {
    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where:   { userId: req.user.id },
        orderBy: { createdAt: "desc" },
        take:    50,
      }),
      prisma.notification.count({ where: { userId: req.user.id, isRead: false } }),
    ]);
    res.json({ notifications, unreadCount });
  } catch (err) { next(err); }
});

// PATCH /api/notifications/read-all
router.patch("/read-all", authenticate, requireActive, async (req, res, next) => {
  try {
    await prisma.notification.updateMany({
      where: { userId: req.user.id, isRead: false },
      data:  { isRead: true },
    });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// PATCH /api/notifications/:id/read
router.patch("/:id/read", authenticate, requireActive, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    await prisma.notification.updateMany({
      where: { id, userId: req.user.id },
      data:  { isRead: true },
    });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
