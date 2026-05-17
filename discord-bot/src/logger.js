const os      = require("os");
const { nodeEnv } = require("./config");

const LEVELS    = { debug: 0, info: 1, warn: 2, error: 3 };
const MIN       = LEVELS[nodeEnv === "production" ? "info" : "debug"];
const ENV_LABEL = nodeEnv === "production" ? "[PROD]" : "[DEV]";

function ts() { return new Date().toISOString().slice(11, 19); }

function write(level, ctx, msg, meta) {
  if (LEVELS[level] < MIN) return;
  const prefix = `[${ts()}] [${level.toUpperCase().padEnd(5)}] ${ENV_LABEL} [${ctx}]`;
  const line   = meta ? `${prefix} ${msg} ${JSON.stringify(meta)}` : `${prefix} ${msg}`;
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

function makeLogger(ctx) {
  return {
    debug: (msg, meta) => write("debug", ctx, msg, meta),
    info:  (msg, meta) => write("info",  ctx, msg, meta),
    warn:  (msg, meta) => write("warn",  ctx, msg, meta),
    error: (msg, meta) => write("error", ctx, msg, meta),
  };
}

module.exports = { makeLogger };
