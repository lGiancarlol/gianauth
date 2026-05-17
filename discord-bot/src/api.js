const axios = require("axios");
const { makeLogger } = require("./logger");

const log = makeLogger("api");

const api = axios.create({
  baseURL: process.env.API_URL || "http://localhost:4000/api",
  timeout: 10000,
});

// Token is stored in memory — refreshed automatically
let _token = process.env.OWNER_API_TOKEN || null;

function setToken(t) { _token = t; }
function getToken()  { return _token; }

api.interceptors.request.use((config) => {
  if (_token) config.headers["Authorization"] = `Bearer ${_token}`;
  return config;
});

// -- Service token (non-expiring) ---------------------------------------------
async function fetchServiceToken() {
  const secret = process.env.SERVICE_SECRET;
  if (!secret) {
    log.warn("SERVICE_SECRET not set — falling back to OWNER_API_TOKEN");
    return null;
  }
  const { data } = await axios.post(
    `${process.env.API_URL || "http://localhost:4000/api"}/auth/service-token`,
    { secret },
    { timeout: 10000 }
  );
  return data.token;
}

// -- Requests -----------------------------------------------------------------
async function resolveRequest(requestId, status, resolvedNote) {
  const { data } = await api.patch(`/requests/${requestId}`, { status, resolvedNote });
  return data;
}

async function getRequest(requestId) {
  const { data } = await api.get(`/requests/${requestId}`);
  return data;
}

async function getPendingRequests(page = 1, limit = 8) {
  const { data } = await api.get("/requests", { params: { status: "pending", page, limit } });
  return data;
}

// -- Discord message persistence (replaces direct DB access) ------------------
async function saveDiscordMessage(requestId, messageId) {
  await api.patch(`/requests/${requestId}/discord-message`, { messageId });
}

async function clearDiscordMessage(requestId) {
  await api.delete(`/requests/${requestId}/discord-message`);
}

async function getDiscordMessageId(requestId) {
  const req = await getRequest(requestId);
  return req?.discordMessageId || null;
}

// -- Stats --------------------------------------------------------------------
async function getStats() {
  const { data } = await api.get("/stats");
  return data;
}

// -- Licenses -----------------------------------------------------------------
async function searchLicense(key) {
  const { data } = await api.get("/licenses", { params: { search: key, limit: 5 } });
  return data.licenses || [];
}

async function getGlobalStock() {
  const { data } = await api.get("/licenses/stock");
  return data;
}

// -- Resellers ----------------------------------------------------------------
async function getAllResellers() {
  const { data } = await api.get("/users");
  return data;
}

async function getReseller(username) {
  const list = await getAllResellers();
  return list.find((u) => u.username.toLowerCase() === username.toLowerCase()) || null;
}

async function getResellerStock(resellerId) {
  const { data } = await api.get(`/users/${resellerId}/stock`);
  return data;
}

async function getRenewalAlerts() {
  const { data } = await api.get("/stats");
  return data.renewalAlerts || [];
}

// -- System -------------------------------------------------------------------
async function getHealth() {
  const { data } = await api.get("/system/health");
  return data;
}

async function getSystemErrors(page = 1) {
  const { data } = await api.get("/system/errors", { params: { resolved: "false", page, limit: 8 } });
  return data;
}

async function getBackups() {
  const { data } = await api.get("/system/backups");
  return data;
}

module.exports = {
  setToken, getToken, fetchServiceToken,
  resolveRequest, getRequest, getPendingRequests,
  saveDiscordMessage, clearDiscordMessage, getDiscordMessageId,
  getStats,
  searchLicense, getGlobalStock,
  getAllResellers, getReseller, getResellerStock, getRenewalAlerts,
  getHealth, getSystemErrors, getBackups,
};
