"use client";
import { useEffect, useRef, useCallback, useState } from "react";
import { io, Socket } from "socket.io-client";
import {
  syncState,
  isNewEvent,
  useProductsStore,
  useLicensesStore,
  useRequestsStore,
  useNotificationsStore,
  useOwnerProfileStore,
} from "@/lib/store";

const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL?.replace("/api", "") || "http://localhost:4000";

export type SocketStatus = "connected" | "connecting" | "disconnected";

// Module-level singleton
let _socket: Socket | null = null;
let _token:  string | null = null;
let _statusListeners: Set<(s: SocketStatus) => void> = new Set();

function notifyStatus(s: SocketStatus) {
  _statusListeners.forEach((fn) => fn(s));
}

function getOrCreateSocket(token: string): Socket {
  if (_socket && _token === token) return _socket;

  if (_socket) {
    _socket.removeAllListeners();
    _socket.disconnect();
    _socket = null;
  }

  _token = token;
  notifyStatus("connecting");

  const socket = io(SOCKET_URL, {
    auth:                 { token },
    transports:           ["websocket", "polling"],
    reconnectionAttempts: 10,
    reconnectionDelay:    2000,
    reconnectionDelayMax: 30000,
    timeout:              10000,
  });

  socket.on("connect", () => {
    notifyStatus("connected");
    // Resync full state on every (re)connect
    syncState();
  });

  socket.on("disconnect",    () => notifyStatus("disconnected"));
  socket.on("connect_error", (err) => {
    notifyStatus("disconnected");
    // Stop reconnecting if the account is blocked
    if (err.message === "Token requerido" || err.message === "Token inv\u00e1lido") {
      socket.io.opts.reconnectionAttempts = 0;
    }
  });

  // ── Store bindings (idempotent via eventId) ──────────────────────────────

  socket.on("product:state_changed", (data) => {
    if (!isNewEvent(data._meta?.eventId)) return;
    useProductsStore.getState().setActive(data.id, data.active);
  });

  socket.on("license:state_changed", (data) => {
    if (!isNewEvent(data._meta?.eventId)) return;
    useLicensesStore.getState().setLicenseStatus(data.id, data.status);
  });

  socket.on("license:deleted", (data) => {
    if (!isNewEvent(data._meta?.eventId)) return;
    useLicensesStore.getState().removeLicense(data.id);
  });

  socket.on("license:bulk_deleted", (data) => {
    if (!isNewEvent(data._meta?.eventId)) return;
    const { removeLicense } = useLicensesStore.getState();
    (data.ids as number[]).forEach((id) => removeLicense(id));
  });

  socket.on("license:claimed", (data) => {
    if (!isNewEvent(data._meta?.eventId)) return;
    useLicensesStore.getState().setLicenseStatus(data.id, "used");
  });

  socket.on("request:new", (data) => {
    if (!isNewEvent(data._meta?.eventId)) return;
    useRequestsStore.getState().upsertRequest(data);
  });

  socket.on("request:updated", (data) => {
    if (!isNewEvent(data._meta?.eventId)) return;
    useRequestsStore.getState().setRequestStatus(data.id, data.status);
  });

  socket.on("notification:new", (data) => {
    if (!isNewEvent(data._meta?.eventId)) return;
    useNotificationsStore.getState().addNotification(data);
  });

  socket.on("owner:profile_updated", (data) => {
    if (!isNewEvent(data._meta?.eventId)) return;
    useOwnerProfileStore.getState().patchProfile(data);
  });

  _socket = socket;
  return socket;
}

export function useSocket(token: string | null) {
  const [status, setStatus] = useState<SocketStatus>("disconnected");
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!token) { setStatus("disconnected"); return; }

    const socket = getOrCreateSocket(token);
    setStatus(socket.connected ? "connected" : "connecting");

    _statusListeners.add(setStatus);
    return () => { _statusListeners.delete(setStatus); };
  }, [token]);

  // Fallback polling when socket is disconnected
  useEffect(() => {
    if (status === "connected") {
      if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
      return;
    }
    if (!token) return;
    pollingRef.current = setInterval(syncState, 30_000);
    return () => {
      if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
    };
  }, [status, token]);

  const on = useCallback(<T>(event: string, handler: (data: T) => void) => {
    const socket = _socket;
    if (!socket) return () => {};
    socket.on(event, handler as any);
    return () => { socket.off(event, handler as any); };
  }, []);

  return { on, status, socket: _socket };
}
