"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import Sidebar from "@/components/Sidebar";
import NotificationDropdown from "@/components/NotificationDropdown";
import CommandPalette from "@/components/CommandPalette";
import { applyAccentTheme } from "@/lib/utils";
import { Loader2, Search } from "lucide-react";
import { useSocket } from "@/hooks/useSocket";
import api from "@/lib/api";
import {
  useProductsStore, useLicensesStore,
  useRequestsStore, useNotificationsStore,
  useOwnerProfileStore,
} from "@/lib/store";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [paletteOpen, setPaletteOpen] = useState(false);

  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const { on } = useSocket(token);

  // Fetch owner profile once on mount (visible to all users)
  useEffect(() => {
    if (!user) return;
    api.get("/users/owner/profile")
      .then((r) => useOwnerProfileStore.getState().setProfile(r.data))
      .catch(() => {});
  }, [user?.id]);

  // Global block listener — fires for the currently logged-in user
  useEffect(() => {
    if (!user) return;
    return on<{ userId: number }>("user:blocked", ({ userId }) => {
      if (userId !== user.id) return; // owner sees the event too, ignore it
      // Wipe all state immediately
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      useProductsStore.getState().setProducts([]);
      useLicensesStore.getState().setLicenses([]);
      useRequestsStore.getState().setRequests([]);
      useNotificationsStore.getState().setNotifications([], 0);
      router.replace("/blocked");
    });
  }, [on, user, router]);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
    if (!loading && user?.isBlocked) router.replace("/blocked");
  }, [user, loading, router]);

  // Inject accent CSS vars
  useEffect(() => {
    applyAccentTheme(user?.accentColor);
    return () => applyAccentTheme(null);
  }, [user?.accentColor]);

  // Global keyboard shortcuts
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const tag = (e.target as HTMLElement).tagName;
    const inInput = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";

    // Ctrl/Cmd + K → command palette
    if ((e.ctrlKey || e.metaKey) && e.key === "k") {
      e.preventDefault();
      setPaletteOpen((o) => !o);
      return;
    }

    // G + key navigation (only when not in input)
    if (!inInput && !e.ctrlKey && !e.metaKey && !e.altKey) {
      if (e.key === "Escape") { setPaletteOpen(false); return; }
    }
  }, []);

  // G+key two-stroke shortcut
  useEffect(() => {
    let gPressed = false;
    let timer: ReturnType<typeof setTimeout>;

    function handler(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName;
      const inInput = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
      if (inInput) return;

      if (e.key === "g" || e.key === "G") {
        gPressed = true;
        clearTimeout(timer);
        timer = setTimeout(() => { gPressed = false; }, 800);
        return;
      }

      if (gPressed) {
        gPressed = false;
        clearTimeout(timer);
        const map: Record<string, string> = {
          d: "/dashboard",
          l: "/dashboard/licenses",
          r: user?.role === "owner" ? "/dashboard/requests" : "/dashboard/my-requests",
          u: "/dashboard/resellers",
          p: "/dashboard/products",
          s: "/dashboard/support",
          y: "/dashboard/system",
        };
        const dest = map[e.key.toLowerCase()];
        if (dest) { e.preventDefault(); router.push(dest); }
      }
    }

    window.addEventListener("keydown", handler);
    return () => { window.removeEventListener("keydown", handler); clearTimeout(timer); };
  }, [router, user?.role]);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return null;

  const isReseller = user.role === "reseller";
  const greeting   = isReseller ? (user.displayName || user.username) : "";

  return (
    <div className="flex min-h-screen bg-background overflow-x-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Topbar */}
        <header className="h-14 border-b border-[var(--accent-border,hsl(var(--border)))] bg-card/50 backdrop-blur-sm flex items-center justify-between px-3 sm:px-6 gap-2 sm:gap-4 shrink-0">
          <span className="text-sm text-muted-foreground hidden sm:block truncate">
            {greeting}
          </span>

          {/* Search trigger */}
          <button
            onClick={() => setPaletteOpen(true)}
            className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-secondary/40 hover:bg-secondary/70 text-muted-foreground text-xs transition-colors ml-auto mr-2"
          >
            <Search className="w-3.5 h-3.5" />
            <span>Buscar...</span>
            <kbd className="ml-2">Ctrl K</kbd>
          </button>

          <div className="flex items-center gap-2">
            <NotificationDropdown />
          </div>
        </header>

        <main className="flex-1 overflow-auto overflow-x-hidden">
          <div className="p-3 sm:p-4 md:p-6 max-w-7xl mx-auto page-enter min-w-0">{children}</div>
        </main>
      </div>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}
