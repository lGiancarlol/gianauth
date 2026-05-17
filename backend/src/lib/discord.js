// Pure label/color helpers shared with the bot.
// No webhook, no HTTP calls — notifications go through the bot via Socket.IO.

const ACTION_LABELS = {
  reset_hwid: "Reset HWID",
  ban:        "Suspender usuario",
  unban:      "Reactivar usuario",
  delete:     "Eliminar key",
  extend:     "Extension de tiempo",
};

const ACTION_COLORS = {
  reset_hwid: 0x3b82f6,
  ban:        0xdc2626,
  unban:      0x16a34a,
  delete:     0xdc2626,
  extend:     0xd97706,
};

module.exports = { ACTION_LABELS, ACTION_COLORS };
