const config = {
  botToken:      process.env.DISCORD_BOT_TOKEN,
  clientId:      process.env.DISCORD_CLIENT_ID,
  channelId:     process.env.DISCORD_CHANNEL_ID,
  ownerRoleId:   process.env.DISCORD_OWNER_ROLE_ID || null,
  panelUrl:      process.env.PANEL_URL      || "http://localhost:3000/dashboard",
  apiUrl:        process.env.API_URL        || "http://localhost:4000/api",
  ownerApiToken: process.env.OWNER_API_TOKEN || null,
  serviceSecret: process.env.SERVICE_SECRET  || null,
  nodeEnv:       process.env.NODE_ENV        || "development",
};

module.exports = config;
