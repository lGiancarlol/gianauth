const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { panelUrl }              = require("./config");
const { buildEmbed, COLORS }    = require("./utils/buildEmbed");
const { makeLogger }            = require("./logger");

const log = makeLogger("embeds");

// ── Constantes ────────────────────────────────────────────────────────────────

const ACTION_LABELS = {
  reset_hwid: "Reset HWID",
  ban:        "Suspensión",
  unban:      "Reactivación",
  delete:     "Eliminación de key",
  extend:     "Extensión de tiempo",
};

// Mapeo acción → tipo de color
const ACTION_TYPE = {
  reset_hwid: "reset_hwid",
  ban:        "ban",
  unban:      "unban",
  delete:     "delete",
  extend:     "extend",
};

const STATUS_LABELS = {
  pending:   "Pendiente",
  approved:  "Aprobada",
  rejected:  "Rechazada",
  completed: "Completada",
};

const STATUS_TYPE = {
  pending:   "pending",
  approved:  "approved",
  rejected:  "rejected",
  completed: "completed",
};

// ── Formatters ────────────────────────────────────────────────────────────────

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("es", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtDateTime(d) {
  if (!d) return "—";
  return new Date(d).toLocaleString("es", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function fmtUptime(s) {
  if (!s) return "—";
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  return [d && `${d}d`, h && `${h}h`, `${m}m`].filter(Boolean).join(" ");
}

function fmtBytes(b) {
  if (!b) return "—";
  if (b < 1024 ** 2) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1024 ** 3) return `${(b / 1024 ** 2).toFixed(1)} MB`;
  return `${(b / 1024 ** 3).toFixed(2)} GB`;
}

function shortKey(key) {
  if (!key) return "—";
  return key.length > 32 ? `${key.slice(0, 32)}…` : key;
}

// ── Solicitudes ───────────────────────────────────────────────────────────────

function buildRequestEmbed(request, license, reseller) {
  const label = ACTION_LABELS[request.type] || request.type;
  log.info("[embed] buildRequestEmbed", { type: request.type, id: request.id });

  const fields = [
    { name: "Revendedor", value: `\`${reseller.username}\``,              inline: true },
    { name: "Acción",     value: `\`${label}\``,                          inline: true },
    { name: "Producto",   value: `\`${license.product?.name || "—"}\``,   inline: true },
    { name: "Key",        value: `\`${shortKey(license.key)}\``,          inline: false },
    ...(license.assignedUser
      ? [{ name: "Asignado a", value: `\`${license.assignedUser}\``, inline: true }]
      : []),
    ...(request.comment
      ? [{ name: "Comentario", value: request.comment.slice(0, 200), inline: false }]
      : []),
  ];

  return buildEmbed({
    type:        ACTION_TYPE[request.type] || "pending",
    title:       `Nueva solicitud — ${label}`,
    description: "Pendiente de revisión.",
    fields,
    footer:      `Solicitud #${request.id}`,
  });
}

function buildResolvedEmbed(request, license, reseller, resolvedBy) {
  const label      = ACTION_LABELS[request.type] || request.type;
  const statusLabel = STATUS_LABELS[request.status] || request.status;
  log.info("[embed] buildResolvedEmbed", { type: request.type, status: request.status, id: request.id });

  const fields = [
    { name: "Revendedor",  value: `\`${reseller.username}\``,  inline: true },
    { name: "Estado",      value: `\`${statusLabel}\``,        inline: true },
    { name: "Acción",      value: `\`${label}\``,              inline: true },
    { name: "Key",         value: `\`${shortKey(license.key)}\``, inline: false },
    { name: "Resuelto por", value: `\`${resolvedBy}\``,        inline: true },
    ...(request.resolvedNote
      ? [{ name: "Nota", value: request.resolvedNote.slice(0, 200), inline: false }]
      : []),
  ];

  return buildEmbed({
    type:        STATUS_TYPE[request.status] || "neutral",
    title:       `Solicitud ${statusLabel.toLowerCase()} — ${label}`,
    fields,
    footer:      `Solicitud #${request.id}`,
    timestamp:   request.resolvedAt ? new Date(request.resolvedAt) : undefined,
  });
}

// ── Licencias ─────────────────────────────────────────────────────────────────

function buildLicenseEmbed(license) {
  const expired = license.expiresAt && new Date(license.expiresAt) < new Date();
  const type    = license.status === "available" ? "available"
    : license.status === "blocked" ? "blocked"
    : expired ? "warning"
    : "neutral";

  const fields = [
    { name: "Key",        value: `\`${shortKey(license.key)}\``,                                  inline: false },
    { name: "Estado",     value: `\`${license.status}\``,                                          inline: true  },
    { name: "Producto",   value: `\`${license.product?.name || "—"}\``,                            inline: true  },
    { name: "Revendedor", value: `\`${license.reseller?.username || "—"}\``,                       inline: true  },
    { name: "Cliente",    value: `\`${license.clientAlias || license.assignedUser || "—"}\``,      inline: true  },
    { name: "Expira",     value: expired ? `~~${fmtDate(license.expiresAt)}~~ (expirada)` : fmtDate(license.expiresAt), inline: true },
    { name: "Reclamada",  value: fmtDate(license.claimedAt),                                       inline: true  },
    ...(license.notes
      ? [{ name: "Notas", value: license.notes.slice(0, 200), inline: false }]
      : []),
  ];

  return buildEmbed({
    type,
    title:  "Licencia",
    fields,
    footer: `ID #${license.id}`,
  });
}

function buildStockEmbed(stock, title = "Stock disponible") {
  if (!stock.length) {
    return buildEmbed({
      type:        "warning",
      title,
      description: "Sin stock disponible.",
    });
  }

  const lines = stock.map((s) => {
    const name  = (s.product?.name || String(s.productId)).slice(0, 18).padEnd(18);
    const dur   = String(s.duration || "—").padStart(3);
    const count = s._count?.id ?? s.count ?? 0;
    return `\`${name}\`  ${dur}d  —  **${count}** keys`;
  });

  return buildEmbed({
    type:        "available",
    title,
    description: lines.join("\n"),
    footer:      `${stock.length} producto${stock.length !== 1 ? "s" : ""}`,
  });
}

// ── Revendedores ──────────────────────────────────────────────────────────────

function buildResellerEmbed(reseller) {
  const name = reseller.displayName || reseller.username;
  log.info("[embed] buildResellerEmbed", { username: reseller.username });

  const fields = [
    { name: "Usuario",      value: `\`${reseller.username}\``,                    inline: true },
    { name: "Estado",       value: reseller.isBlocked ? "Bloqueado" : "Activo",   inline: true },
    { name: "Disponibles",  value: String(reseller.availableKeys ?? "—"),          inline: true },
    { name: "Usadas",       value: String(reseller.usedKeys      ?? "—"),          inline: true },
    { name: "Renovación",   value: reseller.renewalStatus || "—",                  inline: true },
    { name: "Creado",       value: fmtDate(reseller.createdAt),                    inline: true },
  ];

  return buildEmbed({
    type:   reseller.isBlocked ? "blocked" : "available",
    title:  name,
    fields,
  });
}

function buildRenewalsEmbed(resellers) {
  if (!resellers.length) {
    return buildEmbed({
      type:        "available",
      title:       "Renovaciones",
      description: "Sin renovaciones pendientes.",
    });
  }

  const lines = resellers.map((r) => {
    const days = r.renewalDate
      ? Math.ceil((new Date(r.renewalDate) - Date.now()) / 86400000)
      : null;
    const tag = r.renewalStatus === "overdue" ? "VENCIDA"
      : days !== null && days <= 0 ? "HOY"
      : days !== null ? `${days}d`
      : "—";
    return `\`${r.username.padEnd(16)}\`  ${fmtDate(r.renewalDate)}  \`${tag}\``;
  });

  return buildEmbed({
    type:        "renewal",
    title:       "Renovaciones próximas",
    description: lines.join("\n"),
    footer:      `${resellers.length} revendedor${resellers.length !== 1 ? "es" : ""}`,
  });
}

// ── Sistema ───────────────────────────────────────────────────────────────────

function buildHealthEmbed(h) {
  const ok = h.status === "ok";

  const fields = [
    { name: "Estado",   value: ok ? "Operativo" : "Degradado",                                    inline: true },
    { name: "Versión",  value: h.version || "—",                                                   inline: true },
    { name: "Uptime",   value: fmtUptime(h.uptime),                                                inline: true },
    { name: "Base de datos", value: h.db?.ok ? "OK" : "Error",                                    inline: true },
    { name: "Sockets",  value: String(h.socket?.connected ?? "—"),                                 inline: true },
    { name: "Errores",  value: String(h.alerts?.unresolvedErrors ?? "—"),                          inline: true },
    { name: "RAM",      value: h.memory ? `${h.memory.systemUsedPct}%` : "—",                     inline: true },
    { name: "CPU",      value: h.cpu    ? `${h.cpu.load1.toFixed(2)}` : "—",                      inline: true },
    { name: "Disco",    value: h.disk   ? `${Math.round(h.disk.used / h.disk.total * 100)}%` : "—", inline: true },
  ];

  return buildEmbed({
    type:   ok ? "health" : "error",
    title:  "Estado del sistema",
    fields,
  });
}

function buildErrorsEmbed(errors, page, totalPages) {
  if (!errors.length) {
    return buildEmbed({
      type:        "available",
      title:       "Errores del sistema",
      description: "Sin errores sin resolver.",
    });
  }

  const lines = errors.slice(0, 8).map((e) =>
    `**[${e.severity.toUpperCase()}]** \`${(e.endpoint || "—").slice(0, 30)}\`\n${e.message.slice(0, 80)}`
  );

  const footer = totalPages > 1
    ? `Página ${page}/${totalPages}`
    : `${errors.length} error${errors.length !== 1 ? "es" : ""}`;

  return buildEmbed({
    type:        "error",
    title:       "Errores recientes",
    description: lines.join("\n\n"),
    footer,
  });
}

function buildBackupsEmbed(backups) {
  if (!backups.length) {
    return buildEmbed({
      type:        "warning",
      title:       "Backups",
      description: "Sin backups registrados.",
    });
  }

  const lines = backups.slice(0, 8).map((b, i) => {
    const tag = i === 0 ? "último" : `#${i + 1}`;
    return `\`${tag}\`  \`${b.filename.slice(0, 32)}\`  ${fmtBytes(b.sizeBytes)}  —  ${fmtDateTime(b.createdAt)}`;
  });

  return buildEmbed({
    type:        "system",
    title:       "Historial de backups",
    description: lines.join("\n"),
    footer:      `${backups.length} backup${backups.length !== 1 ? "s" : ""}`,
  });
}

function buildPendingListEmbed(requests, page, totalPages) {
  const lines = requests.map((r) =>
    `**#${r.id}**  \`${ACTION_LABELS[r.type] || r.type}\`  —  ${r.reseller?.username || "—"}  —  \`${shortKey(r.license?.key || "")}\``
  );

  const footer = totalPages > 1 ? `Página ${page}/${totalPages}` : undefined;

  return buildEmbed({
    type:        "pending",
    title:       "Solicitudes pendientes",
    description: lines.length ? lines.join("\n") : "Sin solicitudes pendientes.",
    footer,
  });
}

function buildStatsEmbed(s) {
  const fields = [
    { name: "Keys totales",     value: String(s.totalKeys       ?? "—"), inline: true },
    { name: "Disponibles",      value: String(s.availableKeys   ?? "—"), inline: true },
    { name: "Usadas",           value: String(s.usedKeys        ?? "—"), inline: true },
    { name: "Bloqueadas",       value: String(s.blockedKeys     ?? "—"), inline: true },
    { name: "Expiradas",        value: String(s.expiredKeys     ?? "—"), inline: true },
    { name: "Revendedores",     value: String(s.totalResellers  ?? "—"), inline: true },
    { name: "Solicitudes",      value: String(s.pendingRequests ?? "—"), inline: true },
    { name: "Tickets abiertos", value: String(s.openTickets     ?? "—"), inline: true },
  ];

  return buildEmbed({
    type:   "system",
    title:  "Estadísticas",
    fields,
  });
}

// ── Botones ───────────────────────────────────────────────────────────────────

function buildPendingButtons(requestId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`approve:${requestId}`)
      .setLabel("Aprobar")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`reject:${requestId}`)
      .setLabel("Rechazar")
      .setStyle(ButtonStyle.Danger),
  );
}

function buildApprovedButtons(requestId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`complete:${requestId}`)
      .setLabel("Marcar completada")
      .setStyle(ButtonStyle.Primary),
  );
}

function buildOpenPanelButton() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setLabel("Abrir panel")
      .setStyle(ButtonStyle.Link)
      .setURL(panelUrl),
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
  ACTION_LABELS, ACTION_TYPE, STATUS_LABELS, STATUS_TYPE,
  buildRequestEmbed, buildResolvedEmbed,
  buildLicenseEmbed, buildStockEmbed,
  buildResellerEmbed, buildRenewalsEmbed,
  buildHealthEmbed, buildErrorsEmbed, buildBackupsEmbed,
  buildPendingListEmbed, buildStatsEmbed,
  buildPendingButtons, buildApprovedButtons, buildOpenPanelButton, buildPaginationButtons,
};
