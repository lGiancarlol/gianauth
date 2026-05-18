const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { panelUrl }  = require("../config");
const { safeTitle } = require("./safeTitle");

// ── Paleta premium ────────────────────────────────────────────────────────────
// Oscura, elegante, coherente con el panel GianAuth.
const COLORS = {
  // Acciones / estados
  approved:  0x1f8f5f,   // verde oscuro premium
  completed: 0x1f8f5f,
  unban:     0x1f8f5f,
  available: 0x1f8f5f,

  rejected:  0xc0392b,   // rojo oscuro premium
  blocked:   0xc0392b,
  ban:       0xc0392b,
  delete:    0xc0392b,
  danger:    0xc0392b,
  error:     0xc0392b,
  critical:  0xc0392b,

  pending:   0xd4a017,   // ámbar elegante
  waiting:   0xd4a017,
  warning:   0xd4a017,
  extend:    0xd4a017,
  renewal:   0xd4a017,

  reset_hwid: 0x7b8cde,  // azul apagado — acción neutral
  info:       0x7b8cde,
  neutral:    0x7b8cde,
  system:     0x7b8cde,
  health:     0x7b8cde,
  general:    0x7b8cde,

  default:   0xc0392b,   // fallback = rojo premium
};

function resolveColor(type) {
  if (!type) return COLORS.default;
  return COLORS[String(type).toLowerCase()] ?? COLORS.default;
}

// ── Helper principal ──────────────────────────────────────────────────────────

/**
 * Construye un embed premium consistente.
 *
 * @param {object}  opts
 * @param {string}  [opts.type]        - Clave de color (ver COLORS)
 * @param {string}  [opts.title]       - Título del embed
 * @param {string}  [opts.description] - Descripción
 * @param {Array}   [opts.fields]      - [{ name, value, inline? }]
 * @param {string}  [opts.footer]      - Texto extra en footer (se añade tras "GianAuth")
 * @param {Date}    [opts.timestamp]   - Timestamp personalizado (default: ahora)
 * @param {string}  [opts.thumbnail]   - URL de thumbnail
 * @returns {EmbedBuilder}
 */
function buildEmbed({ type, title, description, fields, footer, timestamp, thumbnail } = {}) {
  const embed = new EmbedBuilder().setColor(resolveColor(type));

  if (title)       embed.setTitle(safeTitle(String(title)));
  if (description) embed.setDescription(String(description));
  if (thumbnail)   { try { embed.setThumbnail(String(thumbnail)); } catch {} }

  if (Array.isArray(fields) && fields.length) {
    const safe = fields
      .filter((f) => f?.name && f.value != null)
      .map((f)   => ({ name: String(f.name), value: String(f.value), inline: Boolean(f.inline) }));
    if (safe.length) embed.addFields(safe);
  }

  const footerParts = ["GianAuth"];
  if (footer) footerParts.push(String(footer));
  embed.setFooter({ text: footerParts.join("  ·  ") });
  embed.setTimestamp(timestamp instanceof Date ? timestamp : new Date());

  return embed;
}

// ── Botón "Abrir panel" ───────────────────────────────────────────────────────

function buildPanelButton() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setLabel("Abrir panel")
      .setStyle(ButtonStyle.Link)
      .setURL(panelUrl),
  );
}

module.exports = { buildEmbed, buildPanelButton, resolveColor, COLORS };
