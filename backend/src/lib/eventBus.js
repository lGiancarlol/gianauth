const { randomUUID } = require("crypto");

// Central event bus — single source of truth for all system events.
// Routes emit here; socketBridge distributes to Socket.IO rooms.

const handlers = new Map(); // eventType → Set<handler>

/**
 * Emit a system event.
 * @param {string} type  - "entity:action" format, e.g. "license:deleted"
 * @param {object} payload
 * @param {{ source?: string }} [opts]
 */
function emit(type, payload, opts = {}) {
  const event = {
    eventId:   randomUUID(),
    type,
    entity:    type.split(":")[0] ?? "system",
    action:    type.split(":")[1] ?? "unknown",
    payload,
    timestamp: Date.now(),
    source:    opts.source ?? "api",
  };

  const set = handlers.get(type);
  if (set) set.forEach((fn) => { try { fn(event); } catch {} });

  // Wildcard subscribers (type = "*")
  const all = handlers.get("*");
  if (all) all.forEach((fn) => { try { fn(event); } catch {} });

  return event;
}

/**
 * Subscribe to an event type (or "*" for all).
 * Returns an unsubscribe function.
 */
function subscribe(type, handler) {
  if (!handlers.has(type)) handlers.set(type, new Set());
  handlers.get(type).add(handler);
  return () => handlers.get(type)?.delete(handler);
}

module.exports = { emit, subscribe };
