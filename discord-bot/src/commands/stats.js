const { SlashCommandBuilder } = require("discord.js");
const { getStats }  = require("../api");
const { buildStatsEmbed } = require("../embeds");
const { makeLogger } = require("../logger");

const log = makeLogger("cmd:stats");

const definition = new SlashCommandBuilder()
  .setName("stats")
  .setDescription("Estadisticas globales del sistema");

async function execute(interaction) {
  log.info("/stats", { user: interaction.user.username });
  const s = await getStats();
  await interaction.editReply({ embeds: [buildStatsEmbed(s)] });
}

module.exports = { definition, execute };
