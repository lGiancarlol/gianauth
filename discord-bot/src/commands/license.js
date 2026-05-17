const { SlashCommandBuilder } = require("discord.js");
const { searchLicense, getGlobalStock } = require("../api");
const { buildLicenseEmbed, buildStockEmbed } = require("../embeds");
const { buildEmbed } = require("../utils/buildEmbed");
const { makeLogger } = require("../logger");

const log = makeLogger("cmd:license");

const definition = new SlashCommandBuilder()
  .setName("license")
  .setDescription("Gestion de licencias")
  .addSubcommand((s) =>
    s.setName("search")
      .setDescription("Busca licencias por key o cliente")
      .addStringOption((o) => o.setName("query").setDescription("Key o alias del cliente").setRequired(true))
  )
  .addSubcommand((s) =>
    s.setName("info")
      .setDescription("Detalles completos de una licencia")
      .addStringOption((o) => o.setName("key").setDescription("Key exacta").setRequired(true))
  )
  .addSubcommand((s) =>
    s.setName("stock")
      .setDescription("Resumen de stock disponible global")
  );

async function execute(interaction) {
  const sub = interaction.options.getSubcommand();
  log.info(`/${interaction.commandName} ${sub}`, { user: interaction.user.username });

  if (sub === "search") {
    const query   = interaction.options.getString("query");
    const results = await searchLicense(query);

    if (!results.length) {
      await interaction.editReply({ content: `Sin resultados para \`${query}\`.` });
      return;
    }

    if (results.length === 1) {
      await interaction.editReply({ embeds: [buildLicenseEmbed(results[0])] });
      return;
    }

    // Multiple results — show list
    const embed = buildEmbed({
      type:        "neutral",
      title:       `Resultados para "${query}"`,
      description: results.map((l) =>
        `**#${l.id}**  \`${l.key.slice(0, 24)}...\`  [${l.status}]  ${l.reseller?.username || "—"}`
      ).join("\n"),
      footerExtra: `${results.length} resultado${results.length !== 1 ? "s" : ""}`,
    });
    await interaction.editReply({ embeds: [embed] });
  }

  else if (sub === "info") {
    const key     = interaction.options.getString("key");
    const results = await searchLicense(key);
    const license = results.find((l) => l.key === key) || results[0];

    if (!license) {
      await interaction.editReply({ content: `Licencia \`${key}\` no encontrada.` });
      return;
    }

    await interaction.editReply({ embeds: [buildLicenseEmbed(license)] });
  }

  else if (sub === "stock") {
    const stock = await getGlobalStock();
    await interaction.editReply({ embeds: [buildStockEmbed(stock, "Stock global disponible")] });
  }
}

module.exports = { definition, execute };
