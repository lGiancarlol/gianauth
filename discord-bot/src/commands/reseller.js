const { SlashCommandBuilder } = require("discord.js");
const { getReseller, getResellerStock, getRenewalAlerts } = require("../api");
const { buildResellerEmbed, buildStockEmbed, buildRenewalsEmbed } = require("../embeds");
const { makeLogger } = require("../logger");

const log = makeLogger("cmd:reseller");

const definition = new SlashCommandBuilder()
  .setName("reseller")
  .setDescription("Informacion de revendedores")
  .addSubcommand((s) =>
    s.setName("info")
      .setDescription("Perfil de un revendedor")
      .addStringOption((o) => o.setName("username").setDescription("Nombre de usuario").setRequired(true))
  )
  .addSubcommand((s) =>
    s.setName("stock")
      .setDescription("Stock de un revendedor")
      .addStringOption((o) => o.setName("username").setDescription("Nombre de usuario").setRequired(true))
  )
  .addSubcommand((s) =>
    s.setName("renewals")
      .setDescription("Renovaciones proximas o vencidas")
  );

async function execute(interaction) {
  const sub = interaction.options.getSubcommand();
  log.info(`/${interaction.commandName} ${sub}`, { user: interaction.user.username });

  if (sub === "info") {
    const username = interaction.options.getString("username");
    const data     = await getReseller(username);
    if (!data) {
      await interaction.editReply({ content: `Revendedor \`${username}\` no encontrado.` });
      return;
    }
    await interaction.editReply({ embeds: [buildResellerEmbed(data)] });
  }

  else if (sub === "stock") {
    const username = interaction.options.getString("username");
    const reseller = await getReseller(username);
    if (!reseller) {
      await interaction.editReply({ content: `Revendedor \`${username}\` no encontrado.` });
      return;
    }

    const { stock } = await getResellerStock(reseller.id);
    const available = stock.filter((s) => s.status === "available");

    await interaction.editReply({
      embeds: [buildStockEmbed(available, `Stock de ${reseller.displayName || reseller.username}`)],
    });
  }

  else if (sub === "renewals") {
    const alerts = await getRenewalAlerts();
    await interaction.editReply({ embeds: [buildRenewalsEmbed(alerts)] });
  }
}

module.exports = { definition, execute };
