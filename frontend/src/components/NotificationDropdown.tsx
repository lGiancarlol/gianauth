"use client";
import { useState, useRef, useEffect } from "react";
import { Bell, CheckCheck, Info, CheckCircle, XCircle, Package, AlertTriangle } from "lucide-react";
import { useNotifications } from "@/hooks/useNotifications";
import { cn } from "@/lib/utils";

const TYPE_CONFIG: Record<string, { icon: any; color: string; bg: string }> = {
  request_approved:  { icon: CheckCircle,   color: "text-emerald-400", bg: "bg-emerald-500/10" },
  request_rejected:  { icon: XCircle,       color: "text-red-400",     bg: "bg-red-500/10"     },
  request_completed: { icon: CheckCheck,    color: "text-blue-400",    bg: "bg-blue-500/10"    },
  key_assigned:      { icon: Package,       color: "text-primary",     bg: "bg-primary/10"     },
  low_stock:         { icon: AlertTriangle, color: "text-amber-400",   bg: "bg-amber-500/10"   },
};

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "ahora";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export default function NotificationDropdown() {
  const { notifications, unreadCount, markAllRead, markRead, socketStatus } = useNotifications();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Close on Escape
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  return (
    <div className="relative" ref={ref}>
      {/* Trigger button */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Notificaciones"
        className="relative p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-all duration-150 active:scale-95"
      >
        <Bell className="w-4 h-4" />

        {/* Unread badge */}
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-primary text-primary-foreground text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}

        {/* Realtime dot */}
        <span
          title={
            socketStatus === "connected"  ? "Tiempo real activo" :
            socketStatus === "connecting" ? "Conectando..." :
            "Sin conexión en tiempo real"
          }
          className={cn(
            "absolute bottom-0.5 right-0.5 w-1.5 h-1.5 rounded-full",
            socketStatus === "connected"  ? "bg-emerald-400" :
            socketStatus === "connecting" ? "bg-amber-400 animate-pulse" :
            "bg-red-400"
          )}
        />
      </button>

      {/* Dropdown panel */}
      {open && (
        <>
          {/* Mobile backdrop */}
          <div
            className="fixed inset-0 z-[998] sm:hidden"
            onClick={() => setOpen(false)}
          />

          <div
            className={cn(
              // Base
              "z-[999] overflow-hidden",
              "bg-card border border-border shadow-2xl",
              // Animation
              "animate-in fade-in-0 zoom-in-95 duration-150",
              // ── Mobile: fixed, centered, full-width minus margin ──
              "fixed left-1/2 -translate-x-1/2",
              "w-[calc(100vw-24px)] max-w-[420px]",
              // Top: below topbar (56px) + small gap
              "top-[62px]",
              "rounded-xl",
              // ── Desktop: absolute, right-aligned ──
              "sm:fixed sm:left-auto sm:translate-x-0 sm:right-4 sm:top-[62px]",
              "sm:w-[380px] sm:max-w-[380px]",
              "sm:rounded-xl",
            )}
          >
            {/* ── Header (sticky) ── */}
            <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 border-b border-border bg-card/95 backdrop-blur-sm">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">Notificaciones</span>
                {unreadCount > 0 && (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-primary/15 text-primary border border-primary/20">
                    {unreadCount}
                  </span>
                )}
              </div>
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <CheckCheck className="w-3 h-3" />
                  Marcar todas
                </button>
              )}
            </div>

            {/* ── List ── */}
            <div
              className="overflow-y-auto overscroll-contain"
              style={{ maxHeight: "min(75vh, 420px)" }}
            >
              {notifications.length === 0 ? (
                /* Empty state */
                <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                  <div className="w-10 h-10 rounded-xl bg-secondary/60 border border-border/60 flex items-center justify-center mb-3">
                    <Bell className="w-4 h-4 text-muted-foreground/50" />
                  </div>
                  <p className="text-sm font-medium text-foreground">Sin notificaciones</p>
                  <p className="text-xs text-muted-foreground mt-1">Estás al día</p>
                </div>
              ) : (
                notifications.map((n) => {
                  const cfg = TYPE_CONFIG[n.type] || { icon: Info, color: "text-muted-foreground", bg: "bg-secondary/60" };
                  const Icon = cfg.icon;
                  return (
                    <button
                      key={n.id}
                      onClick={() => markRead(n.id)}
                      className={cn(
                        "w-full flex items-start gap-3 px-4 py-3 text-left",
                        "border-b border-border last:border-0",
                        "transition-colors duration-100",
                        "hover:bg-accent/40 active:bg-accent/60",
                        !n.isRead && "bg-primary/[0.04]"
                      )}
                    >
                      {/* Icon */}
                      <div className={cn(
                        "mt-0.5 shrink-0 w-7 h-7 rounded-lg flex items-center justify-center",
                        cfg.bg
                      )}>
                        <Icon className={cn("w-3.5 h-3.5", cfg.color)} />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className={cn(
                            "text-xs font-medium leading-snug",
                            !n.isRead ? "text-foreground" : "text-muted-foreground"
                          )}>
                            {n.title}
                          </p>
                          <span className="text-[10px] text-muted-foreground shrink-0 mt-0.5 tabular-nums">
                            {timeAgo(n.createdAt)}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">
                          {n.body}
                        </p>
                      </div>

                      {/* Unread dot */}
                      {!n.isRead && (
                        <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
