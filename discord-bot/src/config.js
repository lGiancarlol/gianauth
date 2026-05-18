const PANEL_BASE = (process.env.PANEL_URL || "http://localhost:3000").replace(/\/+$/, "");

/**
 * Returns a full panel URL for a given path.
 * @param {string} [path="/dashboard"]
 * @returns {string}
 */
function getPanelUrl(path = "/dashboard") {
  return `${PANEL_BASE}${path}`;
}

const config = {
  botToken:      process.env.DISCORD_BOT_TOKEN,
  clientId:      process.env.DISCORD_CLIENT_ID,
  channelId:     process.env.DISCORD_CHANNEL_ID,
  ownerRoleId:   process.env.DISCORD_OWNER_ROLE_ID || null,
  ownerUserId:   process.env.OWNER_USER_ID         || "446349128650326021",
  panelUrl:      getPanelUrl(),
  apiUrl:        process.env.API_URL        || "http://localhost:4000/api",
  ownerApiToken: process.env.OWNER_API_TOKEN || null,
  serviceSecret: process.env.SERVICE_SECRET  || null,
  nodeEnv:       process.env.NODE_ENV        || "development",
  getPanelUrl,
};

module.exports = config;
