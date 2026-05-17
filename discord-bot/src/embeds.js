const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { panelUrl } = require("./config");

// ── Constants ─────────────────────────────────────────────────────────────────
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

const STATUS_COLORS = { pending: 0xd97706, approved: 0x16a34a, rejected: 0xdc2626, completed: 0x3b82f6 };
const STATUS_LABELS = { pending: "Pendiente", approved: "Aprobada", rejected: "Rechazada", completed: "Completada" };

const FOOTER = "GianAuth";

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("es", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtDateTime(d) {
  if (!d) return "—";
  return new Date(d).toLocaleString("es", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function fmtUptime(s) {
  if (!s) return "—";
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  return [d && `${d}d`, h && `${h}h`, `${m}m`].filter(Boolean).join(" ");
}

function fmtBytes(b) {
  if (!b) return "—";
  if (b < 1024 ** 2) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1024 ** 3) return `${(b / 1024 ** 2).toFixed(1)} MB`;
  return `${(b / 1024 ** 3).toFixed(2)} GB`;
}

// ── Request embeds ────────────────────────────────────────────────────────────
function buildRequestEmbed(request, license, reseller) {
  const label = ACTION_LABELS[request.type] || request.type;
  return new EmbedBuilder()
    .setTitle(label)
    .setDescription("Solicitud pendiente de revision.")
    .setColor(ACTION_COLORS[request.type] || 0x6366f1)
    .addFields(
      { name: "Revendedor", value: `\`${reseller.username}\``,                     inline: true },
      { name: "Accion",     value: `\`${label}\``,                                 inline: true },
      { name: "\u200b",     value: "\u200b",                                       inline: false },
      { name: "Producto",   value: `\`${license.product?.name || "—"}\``,          inline: true },
      { name: "Duracion",   value: `\`${license.duration} dias\``,                 inline: true },
      { name: "\u200b",     value: "\u200b",                                       inline: false },
      { name: "Key",        value: `\`\`\`${license.key}\`\`\``,                   inline: false },
      { name: "Asignado a", value: `\`${license.assignedUser || "Sin asignar"}\``, inline: false },
      { name: "Comentario", value: request.comment || "_Sin comentario_",           inline: false },
    )
    .setFooter({ text: `${FOOTER}  |  Solicitud #${request.id}` })
    .setTimestamp();
}

function buildResolvedEmbed(request, license, reseller, resolvedBy) {
  const label = ACTION_LABELS[request.type] || request.type;
  return new EmbedBuilder()
    .setTitle(label)
    .setDescription(`Solicitud **${STATUS_LABELS[request.status] || request.status}**.`)
    .setColor(STATUS_COLORS[request.status] || 0x6366f1)
    .addFields(
      { name: "Revendedor",   value: `\`${reseller.username}\``,             inline: true },
      { name: "Estado",       value: `\`${STATUS_LABELS[request.status]}\``, inline: true },
      { name: "\u200b",       value: "\u200b",                               inline: false },
      { name: "Key",          value: `\`\`\`${license.key}\`\`\``,           inline: false },
      ...(request.resolvedNote ? [{ name: "Nota", value: request.resolvedNote, inline: false }] : []),
      { name: "Resuelto por", value: `\`${resolvedBy}\``,                    inline: true },
    )
    .setFooter({ text: `${FOOTER}  |  Solicitud #${request.id}` })
    .setTimestamp(request.resolvedAt ? new Date(request.resolvedAt) : undefined);
}

// ── License embeds ────────────────────────────────────────────────────────────
function buildLicenseEmbed(license) {
  const expired  = license.expiresAt && new Date(license.expiresAt) < new Date();
  const color    = license.status === "available" ? 0x16a34a
    : license.status === "blocked" ? 0xdc2626
    : expired ? 0xf97316
    : 0x3b82f6;

  return new EmbedBuilder()
    .setTitle("Licencia")
    .setColor(color)
    .addFields(
      { name: "Key",        value: `\`\`\`${license.key}\`\`\``,                                    inline: false },
      { name: "Estado",     value: `\`${license.status}\``,                                          inline: true },
      { name: "Producto",   value: `\`${license.product?.name || "—"}\``,                            inline: true },
      { name: "Duracion",   value: `\`${license.duration} dias\``,                                   inline: true },
      { name: "Revendedor", value: `\`${license.reseller?.username || "Sin asignar"}\``,             inline: true },
      { name: "Cliente",    value: `\`${license.clientAlias || license.assignedUser || "—"}\``,      inline: true },
      { name: "Expira",     value: expired ? `~~${fmtDate(license.expiresAt)}~~ (expirada)` : fmtDate(license.expiresAt), inline: true },
      { name: "Reclamada",  value: fmtDateTime(license.claimedAt),                                   inline: true },
      { name: "Creada",     value: fmtDate(license.createdAt),                                       inline: true },
      ...(license.notes ? [{ name: "Notas", value: license.notes.slice(0, 200), inline: false }] : []),
    )
    .setFooter({ text: `${FOOTER}  |  ID #${license.id}` })
    .setTimestamp();
}

function buildStockEmbed(stock, title) {
  if (!stock.length) {
    return new EmbedBuilder()
      .setTitle(title || "Stock global")
      .setColor(0xdc2626)
      .setDescription("Sin stock disponible.")
      .setFooter({ text: FOOTER })
      .setTimestamp();
  }

  const lines = stock.map((s) =>
    `\`${(s.product?.name || s.productId).padEnd(16)}\`  ${String(s.duration).padStart(3)}d  —  **${s._count?.id ?? s.count ?? 0}** keys`
  );

  return new EmbedBuilder()
    .setTitle(title || "Stock global")
    .setColor(0x6366f1)
    .setDescription(lines.join("\n"))
    .setFooter({ text: `${FOOTER}  |  ${stock.length} producto${stock.length !== 1 ? "s" : ""}` })
    .setTimestamp();
}

// ── Reseller embeds ───────────────────────────────────────────────────────────
function buildResellerEmbed(reseller) {
  return new EmbedBuilder()
    .setTitle(`Revendedor: ${reseller.displayName || reseller.username}`)
    .setColor(reseller.isBlocked ? 0xdc2626 : 0x16a34a)
    .addFields(
      { name: "Usuario",     value: `\`${reseller.username}\``,                                                   inline: true },
      { name: "Estado",      value: reseller.isBlocked ? "Bloqueado" : "Activo",                                  inline: true },
      { name: "Renovacion",  value: reseller.renewalStatus || "—",                                                inline: true },
      { name: "Disponibles", value: String(reseller.availableKeys ?? "—"),                                        inline: true },
      { name: "Usadas",      value: String(reseller.usedKeys      ?? "—"),                                        inline: true },
      { name: "Creado",      value: reseller.createdAt ? fmtDate(reseller.createdAt) : "—",                       inline: true },
    )
    .setFooter({ text: FOOTER })
    .setTimestamp();
}

function buildRenewalsEmbed(resellers) {
  if (!resellers.length) {
    return new EmbedBuilder()
      .setTitle("Renovaciones")
      .setColor(0x16a34a)
      .setDescription("Sin renovaciones pendientes o vencidas.")
      .setFooter({ text: FOOTER })
      .setTimestamp();
  }

  const lines = resellers.map((r) => {
    const days = r.renewalDate
      ? Math.ceil((new Date(r.renewalDate) - Date.now()) / 86400000)
      : null;
    const status = r.renewalStatus === "overdue" ? "VENCIDA"
      : days !== null && days <= 0 ? "HOY"
      : days !== null ? `${days}d`
      : "—";
    return `\`${r.username.padEnd(16)}\`  ${fmtDate(r.renewalDate)}  [${status}]`;
  });

  return new EmbedBuilder()
    .setTitle("Renovaciones pendientes / vencidas")
    .setColor(0xd97706)
    .setDescription(lines.join("\n"))
    .setFooter({ text: `${FOOTER}  |  ${resellers.length} revendedor${resellers.length !== 1 ? "es" : ""}` })
    .setTimestamp();
}

// ── System embeds ─────────────────────────────────────────────────────────────
function buildHealthEmbed(h) {
  return new EmbedBuilder()
    .setTitle("Estado del sistema")
    .setColor(h.status === "ok" ? 0x16a34a : 0xdc2626)
    .addFields(
      { name: "Estado",   value: h.status === "ok" ? "Operativo" : "Degradado",  inline: true },
      { name: "Version",  value: h.version || "—",                               inline: true },
      { name: "Uptime",   value: fmtUptime(h.uptime),                            inline: true },
      { name: "DB",       value: h.db?.ok ? "OK" : "Error",                      inline: true },
      { name: "Sockets",  value: String(h.socket?.connected ?? "—"),             inline: true },
      { name: "Errores",  value: String(h.alerts?.unresolvedErrors ?? "—"),      inline: true },
      { name: "RAM",      value: h.memory ? `${h.memory.systemUsedPct}%` : "—",  inline: true },
      { name: "CPU",      value: h.cpu    ? String(h.cpu.load1.toFixed(2)) : "—", inline: true },
      { name: "Disco",    value: h.disk   ? `${Math.round(h.disk.used / h.disk.total * 100)}%` : "—", inline: true },
    )
    .setFooter({ text: FOOTER })
    .setTimestamp();
}

function buildErrorsEmbed(errors, page, totalPages) {
  if (!errors.length) {
    return new EmbedBuilder()
      .setTitle("Errores del sistema")
      .setColor(0x16a34a)
      .setDescription("Sin errores sin resolver.")
      .setFooter({ text: FOOTER })
      .setTimestamp();
  }

  const lines = errors.slice(0, 8).map((e) =>
    `**[${e.severity.toUpperCase()}]** \`${(e.endpoint || "—").slice(0, 30)}\`\n${e.message.slice(0, 80)}`
  );

  const footerText = totalPages > 1
    ? `${FOOTER}  |  Pagina ${page}/${totalPages}`
    : `${FOOTER}  |  ${errors.length} error${errors.length !== 1 ? "es" : ""}`;

  return new EmbedBuilder()
    .setTitle("Errores recientes")
    .setColor(0xdc2626)
    .setDescription(lines.join("\n\n"))
    .setFooter({ text: footerText })
    .setTimestamp();
}

function buildBackupsEmbed(backups) {
  if (!backups.length) {
    return new EmbedBuilder()
      .setTitle("Backups")
      .setColor(0xd97706)
      .setDescription("Sin backups registrados.")
      .setFooter({ text: FOOTER })
      .setTimestamp();
  }

  const lines = backups.slice(0, 8).map((b, i) =>
    `${i === 0 ? "**[ultimo]**" : `[${i + 1}]`}  \`${b.filename.slice(0, 36)}\`  ${fmtBytes(b.sizeBytes)}  —  ${fmtDateTime(b.createdAt)}`
  );

  return new EmbedBuilder()
    .setTitle("Historial de backups")
    .setColor(0x6366f1)
    .setDescription(lines.join("\n"))
    .setFooter({ text: `${FOOTER}  |  ${backups.length} backup${backups.length !== 1 ? "s" : ""}` })
    .setTimestamp();
}

function buildPendingListEmbed(requests, page, totalPages) {
  const lines = requests.map((r) =>
    `**#${r.id}**  \`${ACTION_LABELS[r.type] || r.type}\`  —  ${r.reseller?.username || "—"}  —  \`${(r.license?.key || "").slice(0, 18)}...\``
  );

  return new EmbedBuilder()
    .setTitle("Solicitudes pendientes")
    .setColor(0xd97706)
    .setDescription(lines.length ? lines.join("\n") : "Sin solicitudes pendientes.")
    .setFooter({ text: totalPages > 1 ? `${FOOTER}  |  Pagina ${page}/${totalPages}` : FOOTER })
    .setTimestamp();
}

function buildStatsEmbed(s) {
  return new EmbedBuilder()
    .setTitle("Estadisticas del sistema")
    .setColor(0x6366f1)
    .addFields(
      { name: "Keys totales",     value: String(s.totalKeys      ?? "—"), inline: true },
      { name: "Disponibles",      value: String(s.availableKeys  ?? "—"), inline: true },
      { name: "Usadas",           value: String(s.usedKeys       ?? "—"), inline: true },
      { name: "Bloqueadas",       value: String(s.blockedKeys    ?? "—"), inline: true },
      { name: "Expiradas",        value: String(s.expiredKeys    ?? "—"), inline: true },
      { name: "Revendedores",     value: String(s.totalResellers ?? "—"), inline: true },
      { name: "Solicitudes",      value: String(s.pendingRequests ?? "—"), inline: true },
      { name: "Tickets abiertos", value: String(s.openTickets    ?? "—"), inline: true },
    )
    .setFooter({ text: FOOTER })
    .setTimestamp();
}

// ── Button rows ───────────────────────────────────────────────────────────────
function buildPendingButtons(requestId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`approve:${requestId}`).setLabel("Aprobar").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`reject:${requestId}`).setLabel("Rechazar").setStyle(ButtonStyle.Danger),
  );
}

function buildApprovedButtons(requestId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`complete:${requestId}`).setLabel("Marcar completada").setStyle(ButtonStyle.Primary),
  );
}

function buildOpenPanelButton() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setLabel("Abrir panel").setStyle(ButtonStyle.Link).setURL(panelUrl),
  );
}

function buildPaginationButtons(page, totalPages, prefix) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`${prefix}:prev:${page}`)
      .setLabel("Anterior")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page <= 1),
    new ButtonBuilder()
      .setCustomId(`${prefix}:next:${page}`)
      .setLabel("Siguiente")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page >= totalPages),
  );
}

module.exports = {
  ACTION_LABELS, ACTION_COLORS, STATUS_COLORS, STATUS_LABELS,
  buildRequestEmbed, buildResolvedEmbed,
  buildLicenseEmbed, buildStockEmbed,
  buildResellerEmbed, buildRenewalsEmbed,
  buildHealthEmbed, buildErrorsEmbed, buildBackupsEmbed,
  buildPendingListEmbed, buildStatsEmbed,
  buildPendingButtons, buildApprovedButtons, buildOpenPanelButton, buildPaginationButtons,
};
