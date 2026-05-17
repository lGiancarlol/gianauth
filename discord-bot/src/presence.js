const { ActivityType } = require("discord.js");
const { makeLogger }   = require("./logger");

const log = makeLogger("presence");

const ACTIVITIES = [
  { name: "Monitoring requests",    type: ActivityType.Watching },
  { name: "Managing licenses",      type: ActivityType.Playing  },
  { name: "Watching system health", type: ActivityType.Watching },
  { name: "GianAuth Admin",         type: ActivityType.Playing  },
];

let idx = 0;

function setPresence(client) {
  const activity = ACTIVITIES[idx % ACTIVITIES.length];
  client.user.setPresence({
    status:     "online",
    activities: [{ name: activity.name, type: activity.type }],
  });
  log.debug(`Presence set: ${activity.name}`);
  idx++;
}

function startPresenceRotation(client) {
  setPresence(client);
  setInterval(() => setPresence(client), 5 * 60 * 1000);
}

module.exports = { startPresenceRotation };
