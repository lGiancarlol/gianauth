const { SlashCommandBuilder } = require("discord.js");
const { getHealth } = require("../api");
const { buildHealthEmbed } = require("../embeds");
const { makeLogger } = require("../logger");

const log = makeLogger("cmd:health");

const definition = new SlashCommandBuilder()
  .setName("health")
  .setDescription("Estado del sistema backend");

async function execute(interaction) {
  log.info("/health", { user: interaction.user.username });
  const h = await getHealth();
  await interaction.editReply({ embeds: [buildHealthEmbed(h)] });
}

module.exports = { definition, execute };
