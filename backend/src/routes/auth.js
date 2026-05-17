const express = require("express");
const bcrypt  = require("bcryptjs");
const jwt     = require("jsonwebtoken");
const prisma  = require("../lib/prisma");
const { authenticate }    = require("../middleware/auth");
const { audit }           = require("../lib/helpers");
const { schemas, validate } = require("../lib/validate");
const log = require("../lib/logger");

const router = express.Router();

// POST /api/auth/login
router.post("/login", validate(schemas.login), async (req, res, next) => {
  try {
    const { username, password } = req.body;
    const ip = req.ip;

    const user = await prisma.user.findUnique({ where: { username } });

    // Track failed attempts — log security event but don't reveal reason
    if (!user) {
      log.security.warn({ ip, username }, "Login failed: user not found");
      await audit({ actorId: null, actorRole: null, action: "LOGIN_FAILED",
        metadata: { username, reason: "not_found", ip }, ip });
      return res.status(401).json({ error: "Credenciales incorrectas" });
    }

    if (user.isBlocked) {
      log.security.warn({ ip, username }, "Login blocked: account blocked");
      return res.status(403).json({ error: "Cuenta bloqueada" });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      log.security.warn({ ip, username }, "Login failed: wrong password");
      await audit({ actorId: user.id, actorRole: user.role, action: "LOGIN_FAILED",
        metadata: { username, reason: "wrong_password", ip }, ip });
      return res.status(401).json({ error: "Credenciales incorrectas" });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, isBlocked: user.isBlocked },
      process.env.JWT_SECRET,
      { expiresIn: "8h" }
    );

    await audit({
      actorId: user.id, actorRole: user.role, action: "LOGIN",
      targetType: "user", targetId: user.id, metadata: { username }, ip: req.ip,
    });

    // Track session
    await prisma.session.create({
      data: { token, userId: user.id, ip: req.ip, userAgent: req.headers["user-agent"] || null },
    }).catch(() => {});

    res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
  } catch (err) { next(err); }
});

// POST /api/auth/service-token
// Genera un JWT sin expiración para servicios internos (bot).
// Protegido por SERVICE_SECRET — nunca expone credenciales de usuario.
router.post("/service-token", async (req, res) => {
  const { secret } = req.body;
  if (!secret || secret !== process.env.SERVICE_SECRET) {
    return res.status(401).json({ error: "Secret inválido" });
  }
  const token = jwt.sign(
    { id: 0, username: "bot-service", role: "owner", isBlocked: false, service: true },
    process.env.JWT_SECRET
    // sin expiresIn — token permanente de servicio
  );
  res.json({ token });
});

// GET /api/auth/me
router.get("/me", authenticate, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true, username: true, role: true, isBlocked: true, createdAt: true,
        displayName: true, panelName: true, accentColor: true, avatarUrl: true,
      },
    });
    if (!user) return res.status(404).json({ error: "Usuario no encontrado" });
    res.json(user);
  } catch (err) { next(err); }
});

module.exports = router;
