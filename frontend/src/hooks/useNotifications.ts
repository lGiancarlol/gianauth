"use client";
import { useEffect, useCallback } from "react";
import api from "@/lib/api";
import { useSocket } from "./useSocket";
import { useNotificationsStore } from "@/lib/store";

export type { Notification } from "@/lib/store";

export function useNotifications() {
  const { notifications, unreadCount, setNotifications, markRead, markAllRead } =
    useNotificationsStore();

  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const { status: socketStatus } = useSocket(token);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/notifications");
      setNotifications(data.notifications, data.unreadCount);
    } catch {}
  }, [setNotifications]);

  // Initial load
  useEffect(() => { load(); }, [load]);

  async function handleMarkAllRead() {
    await api.patch("/notifications/read-all").catch(() => {});
    markAllRead();
  }

  async function handleMarkRead(id: number) {
    await api.patch(`/notifications/${id}/read`).catch(() => {});
    markRead(id);
  }

  return {
    notifications,
    unreadCount,
    markAllRead: handleMarkAllRead,
    markRead: handleMarkRead,
    reload: load,
    socketStatus,
  };
}
