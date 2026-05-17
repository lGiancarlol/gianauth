const { io: ioClient } = require("socket.io-client");
const { makeLogger }   = require("./logger");
const config           = require("./config");

const log = makeLogger("socket");

let socket         = null;
let onRequestNew     = null;
let onRequestUpdated = null;

// Idempotency — ignore duplicate events
const seenEvents = new Set();
function isNew(eventId) {
  if (!eventId || seenEvents.has(eventId)) return false;
  seenEvents.add(eventId);
  if (seenEvents.size > 500) seenEvents.delete(seenEvents.values().next().value);
  return true;
}

function connect(token) {
  if (socket?.connected) return;

  socket = ioClient(config.apiUrl.replace("/api", ""), {
    auth:       { token },
    transports: ["websocket", "polling"],
    reconnectionDelay:    3000,
    reconnectionAttempts: Infinity,
  });

  socket.on("connect", () => {
    log.info("Socket connected", { id: socket.id });
  });

  socket.on("disconnect", (reason) => {
    log.warn("Socket disconnected", { reason });
  });

  socket.on("connect_error", (err) => {
    if (err.message === "Token invalido" || err.message === "Token requerido") {
      log.error("Socket auth failed — stopping reconnection. Restart bot with a valid token.", { error: err.message });
      socket.io.opts.reconnectionAttempts = 0;
      return;
    }
    log.error("Socket connection error", { error: err.message });
  });

  socket.on("reconnect", (attempt) => {
    log.info("Socket reconnected", { attempt });
  });

  socket.on("request:new", (data) => {
    if (!isNew(data._meta?.eventId)) return;
    log.info("request:new received", { id: data?.id, type: data?.type });
    if (onRequestNew && data?.id) onRequestNew(data);
  });

  socket.on("request:updated", (data) => {
    if (!isNew(data._meta?.eventId)) return;
    log.info("request:updated received", { id: data?.id, status: data?.status });
    if (onRequestUpdated && data?.id) onRequestUpdated(data.id, data.status);
  });

  socket.on("product:state_changed", (data) => {
    if (!isNew(data._meta?.eventId)) return;
    log.info("product:state_changed", { id: data?.id, active: data?.active });
    // Bot is informational only — no action needed, just log
  });

  socket.on("license:deleted", (data) => {
    if (!isNew(data._meta?.eventId)) return;
    log.info("license:deleted", { id: data?.id });
    // Handled gracefully via licenseSnapshot in request embeds
  });
}

function onNew(fn)    { onRequestNew     = fn; }
function onUpdate(fn) { onRequestUpdated = fn; }

function disconnect() {
  socket?.disconnect();
  socket = null;
}

module.exports = { connect, onNew, onUpdate, disconnect };
