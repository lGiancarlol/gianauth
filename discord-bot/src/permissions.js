const { ownerRoleId } = require("./config");
const { makeLogger }  = require("./logger");

const log = makeLogger("perms");

// Per-user cooldown map: userId -> { command -> lastUsedMs }
const cooldowns = new Map();
const COOLDOWN_MS = 3000; // 3s between same command per user

/**
 * Returns true if the member has the owner role (or no role restriction is set).
 */
function hasOwnerRole(interaction) {
  if (!ownerRoleId) return true; // no restriction configured
  const member = interaction.member;
  if (!member) return false;
  const has = member.roles?.cache?.has(ownerRoleId) ?? false;
  if (!has) log.warn(`Permission denied`, { user: interaction.user.username, command: interaction.commandName || interaction.customId });
  return has;
}

/**
 * Returns true if the user is on cooldown for this command.
 * Updates the cooldown map if not on cooldown.
 */
function isOnCooldown(userId, key) {
  const now  = Date.now();
  const user = cooldowns.get(userId) || {};
  if (user[key] && now - user[key] < COOLDOWN_MS) return true;
  user[key] = now;
  cooldowns.set(userId, user);
  return false;
}

/**
 * Deny reply helper — ephemeral, clean.
 */
async function denyPermission(interaction) {
  const reply = { content: "No tienes permisos para usar este comando.", ephemeral: true };
  if (interaction.replied || interaction.deferred) {
    await interaction.followUp(reply).catch(() => {});
  } else {
    await interaction.reply(reply).catch(() => {});
  }
}

async function denyCooldown(interaction) {
  const reply = { content: "Espera un momento antes de usar este comando de nuevo.", ephemeral: true };
  if (interaction.replied || interaction.deferred) {
    await interaction.followUp(reply).catch(() => {});
  } else {
    await interaction.reply(reply).catch(() => {});
  }
}

module.exports = { hasOwnerRole, isOnCooldown, denyPermission, denyCooldown };
