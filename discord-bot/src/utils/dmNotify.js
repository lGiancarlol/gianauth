const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { makeLogger } = require("../logger");
const config         = require("../config");

const log = makeLogger("dm");

// ── Paleta compacta (misma que embeds.js) ─────────────────────────────────────
const DM_COLORS = {
  new:       0xd4a017,   // ámbar — nueva solicitud
  completed: 0x1f8f5f,   // verde — completada
  rejected:  0xc0392b,   // rojo  — rechazada
  approved:  0x1f8f5f,
  warning:   0xd4a017,
  error:     0xc0392b,
  info:      0x7b8cde,
};

function resolveColor(type) {
  return DM_COLORS[type] ?? DM_COLORS.info;
}

/**
 * Envía un DM compacto y premium al owner del bot.
 *
 * @param {import("discord.js").Client} client
 * @param {object} opts
 * @param {string}  opts.type        - Clave de color (new | completed | rejected | warning | error | info)
 * @param {string}  opts.title       - Título corto del DM
 * @param {string}  [opts.body]      - Descripción breve (markdown soportado)
 * @param {boolean} [opts.panelBtn]  - Si true, agrega botón "Abrir panel" (default: true)
 * @returns {Promise<void>}
 */
async function notifyOwnerDM(client, { type = "info", title, body, panelBtn = true } = {}) {
  const ownerId = config.ownerUserId;
  if (!ownerId) return;

  try {
    const user = await client.users.fetch(ownerId);
    if (!user) return;

    const embed = new EmbedBuilder()
      .setColor(resolveColor(type))
      .setTitle(String(title || "Notificación"))
      .setTimestamp();

    if (body) embed.setDescription(String(body));
    embed.setFooter({ text: "GianAuth" });

    const components = [];
    if (panelBtn) {
      components.push(
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setLabel("Abrir panel")
            .setStyle(ButtonStyle.Link)
            .setURL(config.getPanelUrl()),
        ),
      );
    }

    await user.send({ embeds: [embed], components });
  } catch (err) {
    // DMs cerrados, usuario no encontrado, etc. — silencioso
    log.warn("DM to owner failed (silenced)", { error: err.message });
  }
}

module.exports = { notifyOwnerDM };
