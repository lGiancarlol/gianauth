// Persistent store — delegates to backend REST API.
// No direct DB access. Works with SQLite and PostgreSQL equally.

const { saveDiscordMessage, clearDiscordMessage, getDiscordMessageId } = require("./api");
const { makeLogger } = require("./logger");

const log = makeLogger("store");

// In-memory metadata store — holds type/productName/duration for live-updates.
// Keyed by requestId (number). Cleared when mapping is cleared.
const _meta = new Map();

async function saveMapping(requestId, messageId, meta = {}) {
  try {
    await saveDiscordMessage(requestId, messageId);
    _meta.set(requestId, {
      type:        meta.type        || null,
      productName: meta.productName || null,
      duration:    meta.duration    ?? null,
    });
    log.info("Mapping saved", { requestId, messageId, meta: _meta.get(requestId) });
  } catch (err) {
    log.error("Failed to save mapping", { requestId, error: err.message });
  }
}

async function getMapping(requestId) {
  try {
    const msgId = await getDiscordMessageId(requestId);
    return msgId || null;
  } catch (err) {
    log.error("Failed to get mapping", { requestId, error: err.message });
    return null;
  }
}

function getMeta(requestId) {
  return _meta.get(requestId) || { type: null, productName: null, duration: null };
}

async function clearMapping(requestId) {
  try {
    await clearDiscordMessage(requestId);
    _meta.delete(requestId);
    log.info("Mapping cleared", { requestId });
  } catch (err) {
    log.error("Failed to clear mapping", { requestId, error: err.message });
  }
}

// No-op on API-based store — backend handles its own data consistency.
function cleanupTerminalMappings() {
  log.info("Cleanup delegated to backend — no local action needed");
}

module.exports = { saveMapping, getMapping, getMeta, clearMapping, cleanupTerminalMappings };
