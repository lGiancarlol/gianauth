// -- Environment loader -------------------------------------------------------
const path = require("path");
const fs   = require("fs");

(function loadEnv() {
  const env      = process.env.NODE_ENV || "development";
  const envFile  = path.resolve(__dirname, `.env.${env}`);
  const fallback = path.resolve(__dirname, ".env");
  const target   = fs.existsSync(envFile) ? envFile : fallback;
  require("dotenv").config({ path: target });
  process.env.NODE_ENV = process.env.NODE_ENV || env;
})();

// -- Startup validation -------------------------------------------------------
const REQUIRED = ["DISCORD_BOT_TOKEN", "DISCORD_CLIENT_ID", "DISCORD_CHANNEL_ID", "API_URL"];
const missing  = REQUIRED.filter((k) => !process.env[k]);
if (missing.length) {
  console.error("[bot] Missing required environment variables:");
  missing.forEach((k) => console.error(`  - ${k}`));
  process.exit(1);
}

if (!process.env.SERVICE_SECRET && !process.env.OWNER_API_TOKEN) {
  console.error("[bot] Either SERVICE_SECRET or OWNER_API_TOKEN must be set.");
  process.exit(1);
}

// -- Production safety warnings -----------------------------------------------
const ENV_LABEL = process.env.NODE_ENV === "production" ? "[PROD]" : "[DEV]";

if (process.env.NODE_ENV === "production") {
  const warnings = [];
  if ((process.env.API_URL   || "").includes("localhost")) warnings.push("API_URL contains localhost");
  if ((process.env.PANEL_URL || "").includes("localhost")) warnings.push("PANEL_URL contains localhost");
  if (!process.env.DISCORD_OWNER_ROLE_ID)                  warnings.push("DISCORD_OWNER_ROLE_ID not set — all users can run commands");
  if (warnings.length) {
    console.warn(`[bot] ${ENV_LABEL} Production safety warnings:`);
    warnings.forEach((w) => console.warn(`  ${ENV_LABEL} WARNING: ${w}`));
  }
}

const { Client, GatewayIntentBits, Events, REST, Routes } = require("discord.js");

const config                    = require("./src/config");
const { makeLogger }            = require("./src/logger");
const { startPresenceRotation } = require("./src/presence");
const { definitions, dispatch } = require("./src/commands/index");
const { handleButton }          = require("./src/handlers/buttons");
const { hasOwnerRole, isOnCooldown, denyPermission, denyCooldown } = require("./src/permissions");
const botSocket = require("./src/socket");
const store     = require("./src/store");
const botApi    = require("./src/api");
const {
  buildRequestEmbed, buildPendingButtons, buildOpenPanelButton,
  buildResolvedEmbed, buildApprovedButtons,
} = require("./src/embeds");

const log = makeLogger("bot");

// -- Token bootstrap ----------------------------------------------------------
async function bootstrapToken() {
  if (process.env.SERVICE_SECRET) {
    try {
      const token = await botApi.fetchServiceToken();
      if (token) {
        botApi.setToken(token);
        log.info("Service token obtained from backend");
        return token;
      }
    } catch (err) {
      log.warn("Failed to fetch service token, falling back to OWNER_API_TOKEN", { error: err.message });
    }
  }
  const fallback = process.env.OWNER_API_TOKEN;
  if (fallback) {
    botApi.setToken(fallback);
    log.warn("Using OWNER_API_TOKEN — this token expires in 8h. Set SERVICE_SECRET for permanent auth.");
    return fallback;
  }
  log.error("No valid token available — bot cannot authenticate to backend");
  process.exit(1);
}

// -- Register slash commands --------------------------------------------------
async function registerCommands() {
  try {
    const rest = new REST({ version: "10" }).setToken(config.botToken);
    await rest.put(Routes.applicationCommands(config.clientId), { body: definitions });
    log.info(`${definitions.length} slash commands registered globally`);
  } catch (err) {
    log.error("Failed to register slash commands", { error: err.message });
  }
}

// -- Resolve license data from event payload ----------------------------------
// Prefers live license data; falls back to licenseSnapshot if license is null.
function resolveLicense(data) {
  if (data.license) return data.license;
  if (data.licenseSnapshot) {
    try {
      const snap = JSON.parse(data.licenseSnapshot);
      return {
        key:          snap.key          ?? "[deleted]",
        duration:     snap.duration     ?? 0,
        assignedUser: snap.assignedUser ?? null,
        product:      { name: snap.productName ?? "-", slug: snap.productSlug ?? "-" },
      };
    } catch {}
  }
  return { key: "[deleted]", duration: 0, assignedUser: null, product: { name: "-", slug: "-" } };
}

// -- Send request notification to channel ------------------------------------
async function sendRequestToChannel(data) {
  const lic = resolveLicense(data);
  try {
    const channel = await client.channels.fetch(config.channelId);
    if (!channel?.isTextBased()) {
      log.warn(`Channel ${config.channelId} not found or not text-based`);
      return null;
    }
    const embed   = buildRequestEmbed(data, lic, data.reseller);
    const buttons = buildPendingButtons(data.id);
    const msg     = await channel.send({ embeds: [embed], components: [buttons, buildOpenPanelButton()] });
    await store.saveMapping(data.id, msg.id);
    log.info(`Request #${data.id} sent to channel`, { msgId: msg.id, env: ENV_LABEL });
    return msg.id;
  } catch (err) {
    log.error(`Failed to send request #${data.id} to channel`, { error: err.message });
    return null;
  }
}

// -- Live request update handler ----------------------------------------------
async function handleLiveRequestUpdate(requestId, status) {
  const msgId = await store.getMapping(requestId);
  if (!msgId) return;

  try {
    const channel = await client.channels.fetch(config.channelId);
    if (!channel?.isTextBased()) return;

    const msg = await channel.messages.fetch(msgId).catch(() => null);
    if (!msg) {
      await store.clearMapping(requestId);
      log.warn("Message not found, mapping cleared", { requestId });
      return;
    }

    const fields   = msg.embeds[0]?.fields || [];
    const get      = (name) => fields.find((f) => f.name === name)?.value || "-";
    const reseller = { username: get("Revendedor").replace(/`/g, "") };
    const license  = {
      key:          get("Key").replace(/```/g, "").trim() || "[deleted]",
      product:      { name: get("Producto").replace(/`/g, "") || "-" },
      duration:     parseInt(get("Duracion").replace(/`/g, "")) || 0,
      assignedUser: null,
    };

    const updatedEmbed = buildResolvedEmbed(
      { id: requestId, status, resolvedAt: new Date(), resolvedNote: null },
      license, reseller, "Sistema",
    );

    const components = status === "approved"
      ? [buildApprovedButtons(requestId), buildOpenPanelButton()]
      : [buildOpenPanelButton()];

    await msg.edit({ embeds: [updatedEmbed], components });
    log.info(`Live update: request #${requestId} -> ${status}`);

    if (status === "completed" || status === "rejected") await store.clearMapping(requestId);
  } catch (err) {
    log.error(`Failed to live-update request #${requestId}`, { error: err.message });
  }
}

// -- Client -------------------------------------------------------------------
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once(Events.ClientReady, async (c) => {
  log.info(`${ENV_LABEL} Logged in as ${c.user.tag} (${c.user.id})`);
  log.info(`Notifications channel: ${config.channelId}`);
  log.info(`API URL: ${config.apiUrl}`);
  log.info(`Owner role restriction: ${config.ownerRoleId || "none (all users)"}`);
  startPresenceRotation(c);
  await registerCommands();
  store.cleanupTerminalMappings();

  const token = await bootstrapToken();
  botSocket.onNew(sendRequestToChannel);
  botSocket.onUpdate(handleLiveRequestUpdate);
  botSocket.connect(token);
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isButton()) {
      if (interaction.customId.startsWith("pending_page:")) return;
      if (interaction.customId.startsWith("syserr_page:"))  return;
      await handleButton(interaction);
      return;
    }

    if (interaction.isChatInputCommand()) {
      if (!hasOwnerRole(interaction)) {
        await denyPermission(interaction);
        return;
      }

      const cooldownKey = `cmd:${interaction.commandName}`;
      if (isOnCooldown(interaction.user.id, cooldownKey)) {
        await denyCooldown(interaction);
        return;
      }

      await interaction.deferReply({ ephemeral: true });

      const handled = await dispatch(interaction);
      if (!handled) {
        await interaction.editReply({ content: "Comando no reconocido." });
      }
    }
  } catch (err) {
    log.error("Unhandled interaction error", { error: err.message, stack: err.stack?.split("\n")[1] });

    const isExpired = err.code === 10062;
    const msg = isExpired
      ? "Esta interaccion ha expirado. Ejecuta el comando de nuevo."
      : "Error al procesar la accion.";

    const reply = { content: msg, ephemeral: true };
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(reply).catch(() => {});
    } else {
      await interaction.reply(reply).catch(() => {});
    }
  }
});

// -- Client events ------------------------------------------------------------
client.on("error",             (err) => log.error("Client error",     { error: err.message }));
client.on("warn",              (msg) => log.warn("Client warning",    { msg }));
client.on("shardDisconnect",   (_, id) => log.warn(`Shard ${id} disconnected`));
client.on("shardReconnecting", (id)   => log.info(`Shard ${id} reconnecting`));

client.on("invalidated", () => {
  log.error("Session invalidated - exiting for restart");
  setTimeout(() => process.exit(1), 5000);
});

// -- Login --------------------------------------------------------------------
log.info(`${ENV_LABEL} Connecting to Discord...`);
client.login(config.botToken).catch((err) => {
  log.error("Login failed", { error: err.message });
  process.exit(1);
});

module.exports = { client, sendRequestToChannel };
