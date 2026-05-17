const express = require("express");
const bcrypt  = require("bcryptjs");
const jwt     = require("jsonwebtoken");
const crypto  = require("crypto");
const prisma  = require("../lib/prisma");
const { authenticate }    = require("../middleware/auth");
const { audit }           = require("../lib/helpers");
const { schemas, validate } = require("../lib/validate");
const log = require("../lib/logger");

const router = express.Router();

// ── Discord OAuth helpers ─────────────────────────────────────────────────────

const DISCORD_CLIENT_ID     = process.env.DISCORD_CLIENT_ID     || "";
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET || "";
const DISCORD_REDIRECT_URI  = process.env.DISCORD_REDIRECT_URI  || "";

// In-memory state store (TTL 10 min). Fine for single-instance; use Redis for multi-node.
const oauthStates = new Map(); // state -> { createdAt }
setInterval(() => {
  const cutoff = Date.now() - 10 * 60 * 1000;
  for (const [k, v] of oauthStates) if (v.createdAt < cutoff) oauthStates.delete(k);
}, 60_000);

function makeJwt(user) {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role, isBlocked: user.isBlocked },
    process.env.JWT_SECRET,
    { expiresIn: "8h" }
  );
}

// GET /api/auth/discord — redirect to Discord authorization page
router.get("/discord", (req, res) => {
  if (!DISCORD_CLIENT_ID || !DISCORD_REDIRECT_URI) {
    return res.status(503).json({ error: "Discord OAuth no configurado" });
  }
  const state = crypto.randomBytes(16).toString("hex");
  oauthStates.set(state, { createdAt: Date.now() });

  const params = new URLSearchParams({
    client_id:     DISCORD_CLIENT_ID,
    redirect_uri:  DISCORD_REDIRECT_URI,
    response_type: "code",
    scope:         "identify",
    state,
    prompt:        "none",
  });
  res.redirect(`https://discord.com/oauth2/authorize?${params}`);
});

// GET /api/auth/discord/callback — exchange code, login or create user
router.get("/discord/callback", async (req, res) => {
  const FRONTEND = process.env.FRONTEND_URL || "http://localhost:3000";
  const { code, state, error } = req.query;

  if (error) {
    return res.redirect(`${FRONTEND}/login?error=discord_denied`);
  }

  // Validate state
  if (!state || !oauthStates.has(state)) {
    return res.redirect(`${FRONTEND}/login?error=invalid_state`);
  }
  oauthStates.delete(state);

  if (!code) {
    return res.redirect(`${FRONTEND}/login?error=no_code`);
  }

  try {
    // 1. Exchange code for access token
    const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id:     DISCORD_CLIENT_ID,
        client_secret: DISCORD_CLIENT_SECRET,
        grant_type:    "authorization_code",
        code,
        redirect_uri:  DISCORD_REDIRECT_URI,
      }),
    });

    if (!tokenRes.ok) {
      log.security.warn({ status: tokenRes.status }, "Discord token exchange failed");
      return res.redirect(`${FRONTEND}/login?error=token_exchange`);
    }

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;

    // 2. Fetch Discord user
    const userRes = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!userRes.ok) {
      return res.redirect(`${FRONTEND}/login?error=discord_user`);
    }

    const discordUser = await userRes.json();
    const discordId   = discordUser.id;
    const discordTag  = discordUser.username;
    const avatarHash  = discordUser.avatar;
    const avatarUrl   = avatarHash
      ? `https://cdn.discordapp.com/avatars/${discordId}/${avatarHash}.png?size=128`
      : null;

    // 3. Find or create user
    let user = await prisma.user.findUnique({ where: { discordId } });

    if (!user) {
      // Auto-register as reseller — owner must manually promote if needed
      const baseUsername = `discord_${discordTag.replace(/[^a-z0-9_]/gi, "_").toLowerCase()}`;
      let username = baseUsername;
      let suffix = 1;
      while (await prisma.user.findUnique({ where: { username } })) {
        username = `${baseUsername}_${suffix++}`;
      }

      user = await prisma.user.create({
        data: {
          username,
          password:    "", // no password — Discord-only account
          role:        "reseller",
          discordId,
          discordUser: discordTag,
          avatarUrl,
          displayName: discordTag,
        },
      });

      await audit({
        actorId: user.id, actorRole: user.role, action: "DISCORD_REGISTER",
        targetType: "user", targetId: user.id,
        metadata: { discordId, discordTag }, ip: req.ip,
      });

      log.app.info({ userId: user.id, discordTag }, "New user registered via Discord");
    } else {
      // Update avatar/tag on every login
      await prisma.user.update({
        where: { id: user.id },
        data: { discordUser: discordTag, ...(avatarUrl && { avatarUrl }) },
      });
    }

    if (user.isBlocked) {
      return res.redirect(`${FRONTEND}/login?error=blocked`);
    }

    const token = makeJwt(user);

    await audit({
      actorId: user.id, actorRole: user.role, action: "LOGIN_DISCORD",
      targetType: "user", targetId: user.id,
      metadata: { discordId, discordTag }, ip: req.ip,
    });

    await prisma.session.create({
      data: { token, userId: user.id, ip: req.ip, userAgent: req.headers["user-agent"] || null },
    }).catch(() => {});

    // 4. Redirect to frontend with token in query param (frontend stores it)
    res.redirect(`${FRONTEND}/auth/discord/success?token=${token}`);
  } catch (err) {
    log.app.error(err, "Discord OAuth callback error");
    res.redirect(`${FRONTEND}/login?error=server`);
  }
});

// ── Traditional login ─────────────────────────────────────────────────────────

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
