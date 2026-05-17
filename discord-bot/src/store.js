// Persistent store — delegates to backend REST API.
// No direct DB access. Works with SQLite and PostgreSQL equally.

const { saveDiscordMessage, clearDiscordMessage, getDiscordMessageId } = require("./api");
const { makeLogger } = require("./logger");

const log = makeLogger("store");

async function saveMapping(requestId, messageId) {
  try {
    await saveDiscordMessage(requestId, messageId);
    log.info("Mapping saved", { requestId, messageId });
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

async function clearMapping(requestId) {
  try {
    await clearDiscordMessage(requestId);
    log.info("Mapping cleared", { requestId });
  } catch (err) {
    log.error("Failed to clear mapping", { requestId, error: err.message });
  }
}

// No-op on API-based store — backend handles its own data consistency.
function cleanupTerminalMappings() {
  log.info("Cleanup delegated to backend — no local action needed");
}

module.exports = { saveMapping, getMapping, clearMapping, cleanupTerminalMappings };
