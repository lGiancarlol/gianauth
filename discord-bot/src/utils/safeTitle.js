function safeTitle(value, fallback = "Solicitud actualizada") {
  if (value === undefined || value === null) return fallback;
  const parsed = String(value).trim();
  if (!parsed.length) return fallback;
  return parsed.slice(0, 256);
}

module.exports = { safeTitle };
