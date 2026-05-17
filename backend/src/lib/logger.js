const pino = require("pino");
const os   = require("os");

const isDev = process.env.NODE_ENV !== "production";
const env   = process.env.NODE_ENV || "development";

const logger = pino({
  level: process.env.LOG_LEVEL || (isDev ? "debug" : "info"),
  timestamp: pino.stdTimeFunctions.isoTime,
  // Production: structured JSON with env/host/pid for log aggregators
  ...(!isDev && {
    base: {
      env,
      host: os.hostname(),
      pid:  process.pid,
    },
    formatters: {
      level: (label) => ({ level: label }),
    },
  }),
  // Development: pretty human-readable output
  ...(isDev && {
    transport: {
      target: "pino-pretty",
      options: {
        colorize:      true,
        translateTime: "SYS:HH:MM:ss",
        ignore:        "pid,hostname",
        messageFormat: `[${env.toUpperCase()}] {msg}`,
        levelFirst:    true,
      },
    },
  }),
});

const log = {
  app:      logger.child({ ctx: "app" }),
  security: logger.child({ ctx: "security" }),
  request:  logger.child({ ctx: "request" }),
  error:    logger.child({ ctx: "error" }),
  job:      logger.child({ ctx: "job" }),
};

module.exports = log;
