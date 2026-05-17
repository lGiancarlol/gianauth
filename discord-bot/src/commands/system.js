const { SlashCommandBuilder } = require("discord.js");
const { getHealth, getSystemErrors, getBackups } = require("../api");
const { buildHealthEmbed, buildErrorsEmbed, buildBackupsEmbed, buildPaginationButtons } = require("../embeds");
const { buildEmbed } = require("../utils/buildEmbed");
const { makeLogger } = require("../logger");
const { isOnCooldown, denyCooldown } = require("../permissions");

const log = makeLogger("cmd:system");
const PAGE_SIZE = 8;

const definition = new SlashCommandBuilder()
  .setName("system")
  .setDescription("Estado del sistema")
  .addSubcommand((s) => s.setName("errors").setDescription("Ultimos errores sin resolver"))
  .addSubcommand((s) => s.setName("backups").setDescription("Historial de backups"))
  .addSubcommand((s) => s.setName("sockets").setDescription("Estado de conexiones Socket.IO"));

async function execute(interaction) {
  const sub = interaction.options.getSubcommand();
  log.info(`/${interaction.commandName} ${sub}`, { user: interaction.user.username });

  if (sub === "errors") {
    let page = 1;
    const data = await getSystemErrors(page);
    const errors = data.errors || [];
    const totalPages = data.pages || 1;

    const components = totalPages > 1 ? [buildPaginationButtons(page, totalPages, "syserr_page")] : [];
    const reply = await interaction.editReply({ embeds: [buildErrorsEmbed(errors, page, totalPages)], components });

    if (totalPages <= 1) return;

    const collector = reply.createMessageComponentCollector({ time: 120_000 });

    collector.on("collect", async (btn) => {
      if (btn.user.id !== interaction.user.id) {
        await btn.reply({ content: "Solo quien ejecuto el comando puede navegar.", ephemeral: true });
        return;
      }

      const cooldownKey = `btn:syserr_page:${btn.user.id}`;
      if (isOnCooldown(btn.user.id, cooldownKey)) {
        await denyCooldown(btn);
        return;
      }

      await btn.deferUpdate();

      const [, dir] = btn.customId.split(":");
      if (dir === "next") page = Math.min(page + 1, totalPages);
      if (dir === "prev") page = Math.max(page - 1, 1);

      const newData = await getSystemErrors(page).catch(() => null);
      if (!newData) return;

      await interaction.editReply({
        embeds:     [buildErrorsEmbed(newData.errors || [], page, totalPages)],
        components: [buildPaginationButtons(page, totalPages, "syserr_page")],
      });
    });

    collector.on("end", async () => {
      await interaction.editReply({ components: [] }).catch(() => {});
    });
  }

  else if (sub === "backups") {
    const backups = await getBackups();
    await interaction.editReply({ embeds: [buildBackupsEmbed(backups || [])] });
  }

  else if (sub === "sockets") {
    const h = await getHealth();
    const embed = buildEmbed({
      type:   "system",
      title:  "Conexiones Socket.IO",
      fields: [
        { name: "Clientes conectados", value: String(h.socket?.connected ?? "—"), inline: true },
        { name: "Estado backend",      value: h.status === "ok" ? "Operativo" : "Degradado",  inline: true },
        { name: "Uptime",              value: h.uptime ? `${Math.floor(h.uptime / 3600)}h ${Math.floor((h.uptime % 3600) / 60)}m` : "—", inline: true },
      ],
    });
    await interaction.editReply({ embeds: [embed] });
  }
}

module.exports = { definition, execute };
