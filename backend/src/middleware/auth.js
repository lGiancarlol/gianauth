const jwt    = require("jsonwebtoken");
const prisma = require("../lib/prisma");

function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Token requerido" });
  }
  const token = header.split(" ")[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: "Token inválido o expirado" });
  }
}

function requireOwner(req, res, next) {
  if (req.user?.role !== "owner") {
    return res.status(403).json({ error: "Acceso denegado: solo el owner puede hacer esto" });
  }
  next();
}

// Validates isBlocked from DB on every request — never trusts the JWT value.
// Service tokens (id === 0) are exempt from the DB check.
async function requireActive(req, res, next) {
  if (req.user?.service) return next(); // bot service token
  try {
    const user = await prisma.user.findUnique({
      where:  { id: req.user.id },
      select: { isBlocked: true },
    });
    if (!user || user.isBlocked) {
      return res.status(403).json({ error: "Tu cuenta está bloqueada" });
    }
    next();
  } catch {
    return res.status(500).json({ error: "Error al verificar estado de cuenta" });
  }
}

module.exports = { authenticate, requireOwner, requireActive };
