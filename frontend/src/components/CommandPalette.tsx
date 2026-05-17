"use client";
import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import api from "@/lib/api";
import {
  LayoutDashboard, Key, Users, ClipboardList, Package,
  ScrollText, ShoppingBag, Search, ArrowRight, Hash, MessageSquare, Server,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface PaletteItem {
  id: string;
  label: string;
  sublabel?: string;
  icon: React.ReactNode;
  action: () => void;
  category: string;
}

export default function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router   = useRouter();
  const { user } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);

  const [query,   setQuery]   = useState("");
  const [results, setResults] = useState<PaletteItem[]>([]);
  const [active,  setActive]  = useState(0);
  const [loading, setLoading] = useState(false);

  // Memoized — only recreates when role changes, not on every render
  const navItems = useMemo<PaletteItem[]>(() => {
    const go = (path: string) => () => router.push(path);
    if (user?.role === "owner") return [
      { id: "nav-dashboard",  label: "Dashboard",     icon: <LayoutDashboard className="w-4 h-4" />, action: go("/dashboard"),           category: "Navegación" },
      { id: "nav-licenses",   label: "Licencias",     icon: <Key className="w-4 h-4" />,             action: go("/dashboard/licenses"),  category: "Navegación" },
      { id: "nav-products",   label: "Productos",     icon: <Package className="w-4 h-4" />,         action: go("/dashboard/products"),  category: "Navegación" },
      { id: "nav-resellers",  label: "Revendedores",  icon: <Users className="w-4 h-4" />,           action: go("/dashboard/resellers"), category: "Navegación" },
      { id: "nav-requests",   label: "Solicitudes",   icon: <ClipboardList className="w-4 h-4" />,   action: go("/dashboard/requests"),  category: "Navegación" },
      { id: "nav-support",    label: "Soporte",       icon: <MessageSquare className="w-4 h-4" />,   action: go("/dashboard/support"),   category: "Navegación" },
      { id: "nav-logs",       label: "Registros",     icon: <ScrollText className="w-4 h-4" />,      action: go("/dashboard/logs"),      category: "Navegación" },
      { id: "nav-system",     label: "Sistema",       icon: <Server className="w-4 h-4" />,          action: go("/dashboard/system"),    category: "Navegación" },
    ];
    return [
      { id: "nav-dashboard",  label: "Dashboard",     icon: <LayoutDashboard className="w-4 h-4" />, action: go("/dashboard"),              category: "Navegación" },
      { id: "nav-claim",      label: "Reclamar Key",  icon: <ShoppingBag className="w-4 h-4" />,     action: go("/dashboard/claim"),        category: "Navegación" },
      { id: "nav-licenses",   label: "Mis Keys",      icon: <Key className="w-4 h-4" />,             action: go("/dashboard/licenses"),     category: "Navegación" },
      { id: "nav-myrequests", label: "Solicitudes",   icon: <ClipboardList className="w-4 h-4" />,   action: go("/dashboard/my-requests"),  category: "Navegación" },
      { id: "nav-support",    label: "Soporte",       icon: <MessageSquare className="w-4 h-4" />,   action: go("/dashboard/support"),      category: "Navegación" },
    ];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.role]);

  // Focus + reset on open
  useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
      setResults(navItems);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]); // intentionally omit navItems — reset is only needed on open

  // Debounced search
  const search = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults(navItems);
      return;
    }
    const lower = q.toLowerCase();
    const nav   = navItems.filter((i) =>
      i.label.toLowerCase().includes(lower) || i.category.toLowerCase().includes(lower)
    );
    setResults(nav);
    setLoading(true);
    try {
      const licRes = await api.get("/licenses", { params: { search: q, limit: 5 } }).catch(() => null);
      const licItems: PaletteItem[] = (licRes?.data?.licenses || []).map((l: any) => ({
        id:       `lic-${l.id}`,
        label:    l.key,
        sublabel: `${l.product?.name || "—"} · ${l.status}`,
        icon:     <Key className="w-4 h-4" />,
        action:   () => router.push("/dashboard/licenses"),
        category: "Keys",
      }));
      setResults([...nav, ...licItems]);
    } catch {
      setResults(nav);
    } finally {
      setLoading(false);
    }
  }, [navItems, router]);

  useEffect(() => {
    const t = setTimeout(() => search(query), 150);
    return () => clearTimeout(t);
  }, [query, search]);

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;
    function handler(e: KeyboardEvent) {
      if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)); }
      if (e.key === "ArrowUp")   { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
      if (e.key === "Enter")     { e.preventDefault(); results[active]?.action(); onClose(); }
      if (e.key === "Escape")    { onClose(); }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, results, active, onClose]);

  useEffect(() => { setActive(0); }, [results]);

  if (!open) return null;

  const grouped = results.reduce<Record<string, PaletteItem[]>>((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {});

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] px-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div className="relative w-full max-w-lg bg-card border border-border rounded-xl shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar páginas, keys, acciones..."
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
          {loading && <div className="w-3.5 h-3.5 border-2 border-border border-t-primary rounded-full animate-spin shrink-0" />}
          <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono text-muted-foreground border border-border bg-secondary/50">ESC</kbd>
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto py-2">
          {results.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              Sin resultados para &ldquo;{query}&rdquo;
            </div>
          ) : (
            Object.entries(grouped).map(([category, items]) => (
              <div key={category}>
                <div className="px-4 py-1.5 flex items-center gap-2">
                  <Hash className="w-3 h-3 text-muted-foreground/50" />
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{category}</span>
                </div>
                {items.map((item) => {
                  const globalIdx = results.indexOf(item);
                  return (
                    <button
                      key={item.id}
                      onClick={() => { item.action(); onClose(); }}
                      onMouseEnter={() => setActive(globalIdx)}
                      className={cn(
                        "w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors",
                        globalIdx === active
                          ? "bg-[var(--accent-soft,hsl(var(--accent)))] text-[var(--accent-hex,hsl(var(--primary)))]"
                          : "text-foreground hover:bg-secondary/40"
                      )}
                    >
                      <span className={cn("shrink-0", globalIdx === active ? "text-[var(--accent-hex,hsl(var(--primary)))]" : "text-muted-foreground")}>
                        {item.icon}
                      </span>
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium truncate block">{item.label}</span>
                        {item.sublabel && <span className="text-xs text-muted-foreground truncate block">{item.sublabel}</span>}
                      </div>
                      {globalIdx === active && <ArrowRight className="w-3.5 h-3.5 shrink-0 opacity-60" />}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-border flex items-center gap-4 text-[10px] text-muted-foreground">
          <span><kbd className="font-mono">↑↓</kbd> navegar</span>
          <span><kbd className="font-mono">↵</kbd> abrir</span>
          <span><kbd className="font-mono">ESC</kbd> cerrar</span>
        </div>
      </div>
    </div>
  );
}
