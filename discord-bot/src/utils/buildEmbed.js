const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { panelUrl } = require("../config");

// ── Color palette ─────────────────────────────────────────────────────────────
const COLORS = {
  // Status
  approved:  0x22c55e,
  completed: 0x22c55e,
  rejected:  0xef4444,
  blocked:   0xef4444,
  pending:   0xf59e0b,
  waiting:   0xf59e0b,
  info:      0x3b82f6,
  general:   0x3b82f6,
  neutral:   0x3b82f6,
  warning:   0xf97316,
  alert:     0xf97316,
  system:    0x7c3aed,
  health:    0x7c3aed,
  critical:  0x991b1b,
  error:     0x991b1b,
  // Fallback
  default:   0x6366f1,
};

function resolveColor(type) {
  if (!type) return COLORS.default;
  return COLORS[String(type).toLowerCase()] ?? COLORS.default;
}

/**
 * Build a visually consistent embed.
 *
 * @param {object} data
 * @param {string}  [data.type]        - Color key (see COLORS map above)
 * @param {string}  [data.title]       - Embed title
 * @param {string}  [data.description] - Embed description
 * @param {Array}   [data.fields]      - Array of { name, value, inline? }
 * @param {string}  [data.imageUrl]    - Optional thumbnail image URL
 * @param {number}  [data.requestId]   - If set, footer shows "Solicitud #N"
 * @param {string}  [data.footerExtra] - Extra text appended to footer
 * @param {Date}    [data.timestamp]   - Custom timestamp (defaults to now)
 * @returns {EmbedBuilder}
 */
function buildEmbed({ type, title, description, fields, imageUrl, requestId, footerExtra, timestamp } = {}) {
  const embed = new EmbedBuilder().setColor(resolveColor(type));

  if (title)       embed.setTitle(String(title));
  if (description) embed.setDescription(String(description));

  if (Array.isArray(fields) && fields.length) {
    const safe = fields
      .filter((f) => f && f.name && f.value !== undefined && f.value !== null)
      .map((f) => ({ name: String(f.name), value: String(f.value), inline: Boolean(f.inline) }));
    if (safe.length) embed.addFields(safe);
  }

  if (imageUrl) {
    try { embed.setThumbnail(String(imageUrl)); } catch {}
  }

  const footerParts = ["GianAuth"];
  if (requestId != null) footerParts.push(`Solicitud #${requestId}`);
  if (footerExtra)       footerParts.push(String(footerExtra));
  embed.setFooter({ text: footerParts.join("  ·  ") });

  embed.setTimestamp(timestamp instanceof Date ? timestamp : new Date());

  return embed;
}

/**
 * Build an "Abrir panel" Link button row.
 * @returns {ActionRowBuilder}
 */
function buildPanelButton() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setLabel("Abrir panel")
      .setStyle(ButtonStyle.Link)
      .setURL(panelUrl),
  );
}

module.exports = { buildEmbed, buildPanelButton, resolveColor, COLORS };
