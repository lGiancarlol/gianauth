const pending  = require("./pending");
const stats    = require("./stats");
const health   = require("./health");
const license  = require("./license");
const reseller = require("./reseller");
const system   = require("./system");

// All registered commands
const COMMANDS = [pending, stats, health, license, reseller, system];

// Map name -> handler for fast dispatch
const COMMAND_MAP = Object.fromEntries(COMMANDS.map((c) => [c.definition.name, c]));

// JSON definitions for REST registration
const definitions = COMMANDS.map((c) => c.definition.toJSON());

/**
 * Dispatch a slash command interaction to the correct handler.
 * Returns false if command not found.
 */
async function dispatch(interaction) {
  const handler = COMMAND_MAP[interaction.commandName];
  if (!handler) return false;
  await handler.execute(interaction);
  return true;
}

module.exports = { definitions, dispatch };
