const { resolveRequest } = require("../api");
const {
  buildResolvedEmbed, buildApprovedButtons, buildOpenPanelButton,
  ACTION_LABELS, STATUS_LABELS,
} = require("../embeds");
const { hasOwnerRole, isOnCooldown, denyPermission, denyCooldown } = require("../permissions");
const { makeLogger } = require("../logger");

const log = makeLogger("buttons");

const BUTTON_ACTION = { approve: "approved", reject: "rejected", complete: "completed" };

async function handleButton(interaction) {
  const [action, requestIdStr] = interaction.customId.split(":");
  const requestId = parseInt(requestIdStr);
  const apiStatus = BUTTON_ACTION[action];

  // Not a request button — ignore
  if (!apiStatus || isNaN(requestId)) return false;

  // Permission check
  if (!hasOwnerRole(interaction)) {
    await denyPermission(interaction);
    return true;
  }

  // Cooldown check (per user, per button)
  const cooldownKey = `btn:${action}:${requestId}`;
  if (isOnCooldown(interaction.user.id, cooldownKey)) {
    await denyCooldown(interaction);
    return true;
  }

  await interaction.deferUpdate();

  let resolved;
  try {
    resolved = await resolveRequest(requestId, apiStatus);
  } catch (err) {
    const msg = err.response?.data?.error || "Error al procesar la solicitud.";
    log.error(`Button ${action} failed for request #${requestId}`, { error: msg, user: interaction.user.username });
    await interaction.followUp({ content: msg, ephemeral: true });
    return true;
  }

  log.info(`Request #${requestId} -> ${apiStatus}`, { user: interaction.user.username });

  // Reconstruct embed data from original message fields
  const fields   = interaction.message.embeds[0]?.fields || [];
  const get      = (name) => fields.find((f) => f.name === name)?.value || "—";
  const reseller = { username: get("Revendedor").replace(/`/g, "") };
  const license  = {
    key:          get("Key").replace(/```/g, "").trim(),
    product:      { name: get("Producto").replace(/`/g, "") },
    duration:     parseInt(get("Duracion").replace(/`/g, "")) || 0,
    assignedUser: null,
  };

  const updatedEmbed = buildResolvedEmbed(
    { ...resolved, resolvedAt: new Date() },
    license, reseller,
    interaction.user.username,
  );

  const components = apiStatus === "approved"
    ? [buildApprovedButtons(requestId), buildOpenPanelButton()]
    : [buildOpenPanelButton()];

  await interaction.editReply({ embeds: [updatedEmbed], components });
  return true;
}

module.exports = { handleButton };
