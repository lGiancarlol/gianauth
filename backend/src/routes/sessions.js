const express = require("express");
const prisma   = require("../lib/prisma");
const { authenticate, requireActive } = require("../middleware/auth");
const { audit }                       = require("../lib/helpers");

const router = express.Router();
router.use(authenticate, requireActive);

// GET /api/sessions — list active sessions for current user
router.get("/", async (req, res, next) => {
  try {
    const sessions = await prisma.session.findMany({
      where:   { userId: req.user.id, isActive: true },
      orderBy: { lastSeenAt: "desc" },
      select:  { id: true, ip: true, userAgent: true, lastSeenAt: true, createdAt: true, token: true },
    });

    const currentToken = req.headers.authorization?.split(" ")[1];
    // Build result without exposing the token value
    const result = sessions.map(({ token, ...rest }) => ({
      ...rest,
      isCurrent: token === currentToken,
    }));

    res.json(result);
  } catch (err) { next(err); }
});

// DELETE /api/sessions/:id — revoke a specific session
router.delete("/:id", async (req, res, next) => {
  try {
    const id      = parseInt(req.params.id);
    const session = await prisma.session.findUnique({ where: { id } });
    if (!session) return res.status(404).json({ error: "Sesión no encontrada" });
    if (session.userId !== req.user.id) return res.status(403).json({ error: "No autorizado" });

    await prisma.session.update({ where: { id }, data: { isActive: false } });

    await audit({ actorId: req.user.id, actorRole: req.user.role, action: "REVOKE_SESSION",
      targetType: "session", targetId: id, metadata: { ip: session.ip }, ip: req.ip });

    res.json({ message: "Sesión revocada" });
  } catch (err) { next(err); }
});

// DELETE /api/sessions — revoke all other sessions
router.delete("/", async (req, res, next) => {
  try {
    const currentToken = req.headers.authorization?.split(" ")[1];
    const { count } = await prisma.session.updateMany({
      where: { userId: req.user.id, isActive: true, NOT: { token: currentToken } },
      data:  { isActive: false },
    });

    await audit({ actorId: req.user.id, actorRole: req.user.role, action: "REVOKE_ALL_SESSIONS",
      metadata: { count }, ip: req.ip });

    res.json({ message: `${count} sesión(es) cerrada(s)` });
  } catch (err) { next(err); }
});

module.exports = router;
