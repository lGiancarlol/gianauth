"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { useState, useEffect, useCallback, memo } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import { useOwnerProfileStore, type SocialLink } from "@/lib/store";
import {
  LayoutDashboard, Users, Key, ScrollText, LogOut, KeyRound,
  ShoppingBag, ClipboardList, Package, MessageSquare, Shield, Server,
  MessageCircle, Phone, Github, Send, Globe, Link2, Pencil, X,
  Plus, Trash2, ChevronLeft, ChevronRight,
} from "lucide-react";

// ── Constants ─────────────────────────────────────────────────────────────────

const W_EXPANDED  = "w-60";
const W_COLLAPSED = "w-[72px]";
// En mobile siempre colapsado (72px), en desktop respeta preferencia
const W_MOBILE    = "w-[52px] sm:w-[72px]";

const ownerNav = [
  { href: "/dashboard",           label: "Dashboard",    icon: LayoutDashboard },
  { href: "/dashboard/licenses",  label: "Licencias",    icon: Key },
  { href: "/dashboard/products",  label: "Productos",    icon: Package },
  { href: "/dashboard/resellers", label: "Revendedores", icon: Users },
  { href: "/dashboard/requests",  label: "Solicitudes",  icon: ClipboardList },
  { href: "/dashboard/support",   label: "Soporte",      icon: MessageSquare },
  { href: "/dashboard/logs",      label: "Registros",    icon: ScrollText },
  { href: "/dashboard/system",    label: "Sistema",      icon: Server },
];

const resellerNav = [
  { href: "/dashboard",             label: "Dashboard",    icon: LayoutDashboard },
  { href: "/dashboard/claim",       label: "Reclamar Key", icon: ShoppingBag },
  { href: "/dashboard/licenses",    label: "Mis Keys",     icon: Key },
  { href: "/dashboard/my-requests", label: "Solicitudes",  icon: ClipboardList },
  { href: "/dashboard/support",     label: "Soporte",      icon: MessageSquare },
];

// ── Social helpers ────────────────────────────────────────────────────────────

const LINK_TYPES: { value: SocialLink["type"]; label: string }[] = [
  { value: "discord",  label: "Discord personal" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "github",   label: "GitHub" },
  { value: "telegram", label: "Telegram" },
  { value: "website",  label: "Sitio web" },
  { value: "custom",   label: "Personalizado" },
];

const LINK_ICONS: Record<SocialLink["type"], React.ElementType> = {
  discord:  MessageCircle,
  whatsapp: Phone,
  github:   Github,
  telegram: Send,
  website:  Globe,
  custom:   Link2,
};

const LINK_COLORS: Record<SocialLink["type"], string> = {
  discord:  "hover:text-indigo-400 hover:bg-indigo-400/10",
  whatsapp: "hover:text-green-400  hover:bg-green-400/10",
  github:   "hover:text-foreground hover:bg-accent",
  telegram: "hover:text-sky-400    hover:bg-sky-400/10",
  website:  "hover:text-blue-400   hover:bg-blue-400/10",
  custom:   "hover:text-foreground hover:bg-accent",
};

function safeUrl(url: string): string | null {
  try {
    const p = new URL(url);
    return p.protocol === "https:" || p.protocol === "http:" ? url : null;
  } catch { return null; }
}

// ── Tooltip wrapper ───────────────────────────────────────────────────────────

function Tip({ label, show, children }: { label: string; show: boolean; children: React.ReactNode }) {
  if (!show) return <>{children}</>;
  return (
    <div className="relative group/tip">
      {children}
      <div className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3 z-50
        opacity-0 group-hover/tip:opacity-100 transition-opacity duration-150">
        <div className="bg-popover border border-border text-foreground text-xs rounded-md px-2.5 py-1.5 whitespace-nowrap shadow-md">
          {label}
        </div>
      </div>
    </div>
  );
}

// ── SocialLinksBar (memoized) ─────────────────────────────────────────────────

const EMPTY_LINK = (): SocialLink =>
  ({ id: crypto.randomUUID(), type: "discord", label: "", url: "" });

const SocialLinksBar = memo(function SocialLinksBar({ collapsed }: { collapsed: boolean }) {
  const { user }   = useAuth();
  const profile    = useOwnerProfileStore((s) => s.profile);
  const setProfile = useOwnerProfileStore((s) => s.setProfile);
  const isOwner    = user?.role === "owner";

  const [editing, setEditing] = useState(false);
  const [links, setLinks]     = useState<SocialLink[]>([]);
  const [saving, setSaving]   = useState(false);

  const socialLinks = profile?.socialLinks ?? [];

  function openEdit() {
    // Deep-copy to avoid mutating the store
    setLinks(socialLinks.length ? socialLinks.map((l) => ({ ...l })) : [EMPTY_LINK()]);
    setEditing(true);
  }

  function addLink() {
    if (links.length < 10) setLinks((prev) => [...prev, EMPTY_LINK()]);
  }

  function removeLink(id: string) {
    setLinks((prev) => prev.filter((l) => l.id !== id));
  }

  function updateLink(id: string, field: keyof SocialLink, value: string) {
    setLinks((prev) => prev.map((l) => l.id === id ? { ...l, [field]: value } : l));
  }

  async function save() {
    if (!user) return;
    const valid = links.filter((l) => l.label.trim() && l.url.trim());
    setSaving(true);
    try {
      const { data } = await api.patch(`/users/${user.id}/profile`, { socialLinks: valid });
      setProfile({ ...profile!, socialLinks: data.socialLinks ?? [] });
      toast.success("Enlaces actualizados");
      setEditing(false);
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Error al guardar");
    } finally { setSaving(false); }
  }

  if (!socialLinks.length && !isOwner) return null;

  return (
    <>
      <div className={cn(
        "flex items-center gap-1 flex-wrap py-2",
        collapsed ? "justify-center px-2" : "px-4"
      )}>
        {socialLinks.map((link) => {
          const href = safeUrl(link.url);
          if (!href) return null;
          const Icon = LINK_ICONS[link.type] ?? Link2;
          return (
            <Tip key={link.id} label={link.label} show={collapsed}>
              <a href={href} target="_blank" rel="noopener noreferrer"
                title={collapsed ? undefined : link.label}
                className={cn(
                  "p-1.5 rounded-md text-muted-foreground transition-colors",
                  LINK_COLORS[link.type] ?? "hover:text-foreground hover:bg-accent"
                )}>
                <Icon className="w-3.5 h-3.5" />
              </a>
            </Tip>
          );
        })}

        {isOwner && !collapsed && (
          <button onClick={openEdit}
            className="ml-auto p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            title="Editar enlaces">
            <Pencil className="w-3 h-3" />
          </button>
        )}
        {isOwner && collapsed && (
          <Tip label="Editar enlaces" show>
            <button onClick={openEdit}
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
              <Pencil className="w-3 h-3" />
            </button>
          </Tip>
        )}
      </div>

      {editing && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-xl p-6 w-full max-w-md space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-sm">Enlaces sociales</h2>
              <button onClick={() => setEditing(false)}
                className="p-1 rounded-md hover:bg-accent text-muted-foreground transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              {links.map((link) => (
                <div key={link.id} className="bg-secondary/30 rounded-lg p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <select value={link.type}
                      onChange={(e) => updateLink(link.id, "type", e.target.value)}
                      className="flex-1 bg-input border border-border rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-ring">
                      {LINK_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                    <button onClick={() => removeLink(link.id)}
                      className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-red-400 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <input type="text" value={link.label}
                    onChange={(e) => updateLink(link.id, "label", e.target.value)}
                    placeholder="Etiqueta (ej: Mi Discord)"
                    className="w-full bg-input border border-border rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-ring" />
                  <input type="url" value={link.url}
                    onChange={(e) => updateLink(link.id, "url", e.target.value)}
                    placeholder="https://..."
                    className="w-full bg-input border border-border rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-ring" />
                </div>
              ))}
            </div>

            {links.length < 10 && (
              <button onClick={addLink}
                className="flex items-center gap-2 w-full px-3 py-2 rounded-lg border border-dashed border-border text-xs text-muted-foreground hover:text-foreground transition-colors">
                <Plus className="w-3.5 h-3.5" /> Agregar enlace
              </button>
            )}

            <div className="flex gap-2 pt-1">
              <button onClick={save} disabled={saving}
                className="flex-1 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50"
                style={{ background: "var(--theme-primary)", color: "var(--theme-fg)" }}>
                {saving ? "Guardando..." : "Guardar"}
              </button>
              <button onClick={() => setEditing(false)}
                className="flex-1 bg-secondary hover:bg-accent text-foreground py-2 rounded-lg text-sm transition-colors">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
});

// ── useSidebarState ───────────────────────────────────────────────────────────

function useSidebarState() {
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    const saved = localStorage.getItem("sidebar_collapsed");
    if (saved !== null) return saved === "true";
    return window.innerWidth < 1280;
  });

  useEffect(() => {
    localStorage.setItem("sidebar_collapsed", String(collapsed));
  }, [collapsed]);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    // Force collapse on mobile always
    if (mq.matches) setCollapsed(true);
    const handler = (e: MediaQueryListEvent) => { if (e.matches) setCollapsed(true); };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px) and (max-width: 1279px)");
    if (mq.matches) setCollapsed(true);
    const handler = (e: MediaQueryListEvent) => { if (e.matches) setCollapsed(true); };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const toggle = useCallback(() => setCollapsed((c) => !c), []);

  return { collapsed, toggle };
}

// ── Sidebar ───────────────────────────────────────────────────────────────────

export default function Sidebar() {
  const pathname         = usePathname();
  const { user, logout } = useAuth();
  const { collapsed, toggle } = useSidebarState();

  const nav        = user?.role === "owner" ? ownerNav : resellerNav;
  const isReseller = user?.role === "reseller";
  const hasAccent  = !!user?.accentColor;

  const brandName   = isReseller
    ? (user?.panelName || user?.displayName || user?.username || "Panel")
    : "GianAuth";
  const displayName = user?.displayName || user?.username || "";
  const initial     = displayName.charAt(0).toUpperCase();

  return (
    <aside className={cn(
      "relative min-h-screen bg-card border-r border-[var(--accent-border,hsl(var(--border)))] flex flex-col shrink-0",
      "transition-[width] duration-200 ease-in-out",
      collapsed ? W_MOBILE : W_EXPANDED,
    )}>

      {/* Toggle button — sits on the right edge */}
      <button
        onClick={toggle}
        className="absolute -right-3 top-6 z-10 w-6 h-6 rounded-full bg-card border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors shadow-sm"
        title={collapsed ? "Expandir sidebar" : "Colapsar sidebar"}
      >
        {collapsed
          ? <ChevronRight className="w-3 h-3" />
          : <ChevronLeft  className="w-3 h-3" />}
      </button>

      {/* ── ZONE 1: Header (fixed) ── */}
      <div className={cn(
        "shrink-0 border-b border-[var(--accent-border,hsl(var(--border)))] flex items-center",
        collapsed ? "justify-center px-0 py-5" : "px-5 py-5 gap-2.5"
      )}>
        {user?.avatarUrl ? (
          <img src={user.avatarUrl} alt=""
            className="w-8 h-8 rounded-lg object-cover border border-[var(--accent-border,hsl(var(--border)))] shrink-0" />
        ) : (
          <div className="w-8 h-8 rounded-lg flex items-center justify-center border shrink-0"
            style={hasAccent ? { background: "var(--accent-soft)", borderColor: "var(--accent-border)" } : undefined}>
            <KeyRound className="w-4 h-4"
              style={hasAccent ? { color: "var(--accent-hex)" } : undefined} />
          </div>
        )}
        {!collapsed && (
          <span className="font-semibold text-sm text-foreground truncate">{brandName}</span>
        )}
      </div>

      {/* ── ZONE 2: Nav (scrollable) ── */}
      <nav className={cn(
        "flex-1 overflow-y-auto py-4 space-y-0.5 min-h-0",
        collapsed ? "px-2" : "px-3"
      )}>
        {nav.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Tip key={href} label={label} show={collapsed}>
              <Link href={href}
                className={cn(
                  "flex items-center rounded-md text-sm transition-colors",
                  collapsed ? "justify-center p-2.5" : "gap-3 px-3 py-2",
                  active ? "font-medium" : "text-muted-foreground hover:text-foreground"
                )}
                style={active && hasAccent
                  ? { color: "var(--accent-hex)", background: "var(--accent-soft)" }
                  : active
                  ? { color: "var(--theme-primary)", background: "var(--theme-soft)" }
                  : undefined}
                {...(!active && hasAccent && {
                  onMouseEnter: (e) => {
                    (e.currentTarget as HTMLElement).style.background = "var(--accent-soft)";
                    (e.currentTarget as HTMLElement).style.color      = "var(--accent-hex)";
                  },
                  onMouseLeave: (e) => {
                    (e.currentTarget as HTMLElement).style.background = "";
                    (e.currentTarget as HTMLElement).style.color      = "";
                  },
                })}
              >
                <Icon
                  className={cn("shrink-0", collapsed ? "w-5 h-5" : "w-4 h-4")}
                  style={active
                    ? { color: hasAccent ? "var(--accent-hex)" : "var(--theme-primary)" }
                    : undefined}
                />
                {!collapsed && (
                  <span style={active
                    ? { color: hasAccent ? "var(--accent-hex)" : "var(--theme-primary)" }
                    : undefined}>
                    {label}
                  </span>
                )}
              </Link>
            </Tip>
          );
        })}
      </nav>

      {/* ── ZONE 3: Footer (fixed) ── */}
      <div className="shrink-0 border-t border-[var(--accent-border,hsl(var(--border)))]">
        <SocialLinksBar collapsed={collapsed} />

        <div className={cn("py-2", collapsed ? "px-2 space-y-1" : "px-3 space-y-0.5")}>
          {/* User chip */}
          <Tip label={`${displayName} · ${isReseller ? "Revendedor" : "Admin"}`} show={collapsed}>
            <div className={cn(
              "flex items-center rounded-md py-2",
              collapsed ? "justify-center px-0" : "gap-2.5 px-3 mb-1"
            )}>
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 border"
                style={hasAccent ? {
                  background:  "var(--accent-soft)",
                  borderColor: "var(--accent-border)",
                  color:       "var(--accent-hex)",
                } : undefined}>
                {initial}
              </div>
              {!collapsed && (
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{displayName}</p>
                  <p className="text-xs text-muted-foreground">{isReseller ? "Revendedor" : "Administrador"}</p>
                </div>
              )}
            </div>
          </Tip>

          {/* Sessions */}
          <Tip label="Sesiones" show={collapsed}>
            <Link href="/dashboard/sessions"
              className={cn(
                "flex items-center rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/40 transition-colors",
                collapsed ? "justify-center p-2.5" : "gap-3 px-3 py-2"
              )}>
              <Shield className={cn("shrink-0", collapsed ? "w-5 h-5" : "w-4 h-4")} />
              {!collapsed && "Sesiones"}
            </Link>
          </Tip>

          {/* Logout */}
          <Tip label="Cerrar sesión" show={collapsed}>
            <button onClick={logout}
              className={cn(
                "flex items-center rounded-md text-sm text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors w-full",
                collapsed ? "justify-center p-2.5" : "gap-3 px-3 py-2"
              )}>
              <LogOut className={cn("shrink-0", collapsed ? "w-5 h-5" : "w-4 h-4")} />
              {!collapsed && "Cerrar sesión"}
            </button>
          </Tip>
        </div>
      </div>

    </aside>
  );
}
