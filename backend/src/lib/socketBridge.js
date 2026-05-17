// Socket Bridge — subscribes to ALL eventBus events and routes them to the
// correct Socket.IO rooms. This is the ONLY place that touches io.emit/to().
// Routes must NEVER call io directly.

const eventBus = require("./eventBus");

// Room routing rules per entity
// Each entry: { rooms: fn(event) → string[] }
const ROOM_RULES = {
  "license:state_changed": (e) => ["global", "owner", e.payload.resellerId ? `reseller:${e.payload.resellerId}` : null].filter(Boolean),
  "license:deleted":       (e) => ["global", "owner", e.payload.resellerId ? `reseller:${e.payload.resellerId}` : null].filter(Boolean),
  "license:bulk_deleted":  ()  => ["global", "owner"],
  "license:claimed":       (e) => ["owner", `reseller:${e.payload.resellerId}`],
  "license:imported":      ()  => ["owner"],
  "product:state_changed": ()  => ["global"],
  "request:new":           ()  => ["owner"],
  "request:updated":       (e) => ["owner", `reseller:${e.payload.resellerId}`],
  "user:blocked":          (e) => ["owner", `user:${e.payload.userId}`, `reseller:${e.payload.userId}`],
  "user:branding_updated": (e) => [`reseller:${e.payload.userId}`],
  "owner:profile_updated": ()  => ["global"],
  "notification:new":      (e) => [`user:${e.payload.userId}`],
  "system:health":         ()  => ["system"],
};

function getRooms(event) {
  const rule = ROOM_RULES[event.type];
  if (rule) return rule(event);
  // Default: broadcast to owner + global
  return ["owner"];
}

let _initialized = false;

function init(io) {
  if (_initialized) return;
  _initialized = true;

  eventBus.subscribe("*", (event) => {
    const rooms = getRooms(event);
    rooms.forEach((room) => {
      io.to(room).emit(event.type, {
        ...event.payload,
        _meta: { eventId: event.eventId, timestamp: event.timestamp, source: event.source },
      });
    });
  });
}

module.exports = { init };
