const { SlashCommandBuilder } = require("discord.js");
const { getPendingRequests } = require("../api");
const { buildPendingListEmbed, buildPaginationButtons } = require("../embeds");
const { makeLogger } = require("../logger");
const { isOnCooldown, denyCooldown } = require("../permissions");

const log = makeLogger("cmd:pending");

const PAGE_SIZE = 8;

const definition = new SlashCommandBuilder()
  .setName("pending")
  .setDescription("Lista las solicitudes pendientes de revision");

async function execute(interaction) {
  log.info("/pending", { user: interaction.user.username });

  let page = 1;
  const data = await getPendingRequests(page, PAGE_SIZE);
  const totalPages = data.pages || 1;

  const embed      = buildPendingListEmbed(data.requests || [], page, totalPages);
  const components = totalPages > 1 ? [buildPaginationButtons(page, totalPages, "pending_page")] : [];

  const reply = await interaction.editReply({ embeds: [embed], components });

  if (totalPages <= 1) return;

  // Paginated collector — 2 minute timeout
  const collector = reply.createMessageComponentCollector({ time: 120_000 });

  collector.on("collect", async (btn) => {
    if (btn.user.id !== interaction.user.id) {
      await btn.reply({ content: "Solo quien ejecuto el comando puede navegar.", ephemeral: true });
      return;
    }

    const cooldownKey = `btn:pending_page:${btn.user.id}`;
    if (isOnCooldown(btn.user.id, cooldownKey)) {
      await denyCooldown(btn);
      return;
    }

    await btn.deferUpdate();

    const [, dir] = btn.customId.split(":");
    if (dir === "next") page = Math.min(page + 1, totalPages);
    if (dir === "prev") page = Math.max(page - 1, 1);

    const newData = await getPendingRequests(page, PAGE_SIZE).catch(() => null);
    if (!newData) return;

    await interaction.editReply({
      embeds:     [buildPendingListEmbed(newData.requests || [], page, totalPages)],
      components: [buildPaginationButtons(page, totalPages, "pending_page")],
    });
  });

  collector.on("end", async () => {
    // Disable buttons on timeout
    await interaction.editReply({ components: [] }).catch(() => {});
  });
}

module.exports = { definition, execute };
