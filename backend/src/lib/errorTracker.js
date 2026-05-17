const prisma = require("./prisma");
const log    = require("./logger");

/**
 * Track an error centrally.
 * @param {Error|string} err
 * @param {{ req?: import("express").Request, severity?: string, extra?: object }} opts
 */
async function trackError(err, { req, severity = "error", extra = {} } = {}) {
  const message = err?.message || String(err);
  const stack   = err?.stack   || null;

  const endpoint = req ? `${req.method} ${req.path}` : extra.endpoint || null;
  const method   = req?.method || null;
  const userId   = req?.user?.id   || null;
  const username = req?.user?.username || null;
  const ip       = req?.ip || null;

  // Summarize payload — never store raw passwords
  let payload = null;
  if (req?.body && Object.keys(req.body).length) {
    const safe = { ...req.body };
    delete safe.password;
    try { payload = JSON.stringify(safe).slice(0, 512); } catch {}
  }

  log.error.error({ endpoint, userId, severity, extra }, message);

  await prisma.errorLog.create({
    data: { severity, message, stack, endpoint, method, userId, username, payload, ip },
  }).catch(() => {});
}

module.exports = { trackError };
