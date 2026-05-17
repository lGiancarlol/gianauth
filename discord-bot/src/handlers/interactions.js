const {
  buildResolvedEmbed,
  buildApprovedButtons,
} = require("../embeds");
const { resolveRequest } = require("../api");

/**
 * Maps button customId prefix to API status.
 */
const BUTTON_ACTION = {
  approve:  "approved",
  reject:   "rejected",
  complete: "completed",
};

/**
 * Main interaction dispatcher.
 */
async function handleInteraction(interaction) {
  if (!interaction.isButton()) return;

  const [action, requestIdStr] = interaction.customId.split(":");
  const requestId = parseInt(requestIdStr);
  const apiStatus = BUTTON_ACTION[action];

  if (!apiStatus || isNaN(requestId)) return;

  await interaction.deferUpdate();

  // Call backend API to resolve the request
  let resolved;
  try {
    resolved = await resolveRequest(requestId, apiStatus);
  } catch (err) {
    const msg = err.response?.data?.error || "Error al procesar la solicitud.";
    await interaction.followUp({ content: msg, ephemeral: true });
    return;
  }

  // Rebuild the embed to reflect the new status
  // We reconstruct from the original embed fields to avoid an extra API call
  const original = interaction.message.embeds[0];
  const fields   = original?.fields || [];

  const resellerField = fields.find((f) => f.name === "Revendedor");
  const keyField      = fields.find((f) => f.name === "Key");
  const productField  = fields.find((f) => f.name === "Producto");
  const durationField = fields.find((f) => f.name === "Duración");

  const reseller = { username: resellerField?.value?.replace(/`/g, "") || "—" };
  const license  = {
    key:      keyField?.value?.replace(/```/g, "").trim() || "—",
    product:  { name: productField?.value?.replace(/`/g, "") || "—" },
    duration: parseInt(durationField?.value?.replace(/`/g, "")) || 0,
    assignedUser: null,
  };

  const updatedEmbed = buildResolvedEmbed(
    { ...resolved, resolvedAt: new Date() },
    license,
    reseller,
    interaction.user.username,
  );

  // If approved, show Complete button; otherwise remove all buttons
  const components = apiStatus === "approved"
    ? [buildApprovedButtons(requestId)]
    : [];

  await interaction.editReply({ embeds: [updatedEmbed], components });
}

module.exports = { handleInteraction };
