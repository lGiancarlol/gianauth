const prisma    = require("./prisma");
const eventBus  = require("./eventBus");

// Kept for backwards compat — socketBridge now handles actual socket emission
let _io = null;
function setIo(io) { _io = io; }
function getIo()   { return _io; }

async function audit({ actorId, actorRole, action, targetType, targetId, metadata, ip }) {
  await prisma.auditLog.create({
    data: {
      actorId:    actorId    || null,
      actorRole:  actorRole  || null,
      action,
      targetType: targetType || null,
      targetId:   targetId   || null,
      metadata:   metadata   ? JSON.stringify(metadata) : null,
      ip:         ip         || null,
    },
  }).catch(() => {});
}

async function notify({ userId, type, title, body }) {
  const notification = await prisma.notification.create({
    data: { userId, type, title, body },
  }).catch(() => null);

  if (notification) {
    eventBus.emit("notification:new", { ...notification, userId }, { source: "system" });
  }
}

function calcExpiresAt(claimedAt, durationDays) {
  const d = new Date(claimedAt);
  d.setDate(d.getDate() + durationDays);
  return d;
}

module.exports = { audit, notify, calcExpiresAt, setIo, getIo };
