"use client";
import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import StatCard from "@/components/StatCard";
import Badge from "@/components/Badge";
import api from "@/lib/api";
import { daysUntil } from "@/lib/utils";
import { useSocket } from "@/hooks/useSocket";
import {
  Key, Users, CheckCircle, XCircle, ShoppingBag, Clock,
  AlertCircle, AlertTriangle, TrendingDown, CalendarClock, MessageSquare, Activity,
} from "lucide-react";

function WarningBanner({ icon: Icon, color, text }: { icon: any; color: string; text: string }) {
  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-lg border text-sm ${color}`}>
      <Icon className="w-4 h-4 shrink-0 opacity-70" />
      <span>{text}</span>
    </div>
  );
}

interface RenewalAlert {
  id: number;
  username: string;
  displayName?: string;
  renewalDate: string;
  renewalStatus: string;
  renewalNote?: string;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<any>(null);

  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const { on } = useSocket(token);

  const loadStats = useCallback(() => {
    api.get("/stats").then((r) => setStats(r.data)).catch(() => {});
  }, []);

  // Initial load
  useEffect(() => { loadStats(); }, [loadStats]);

  // Reload stats on any event that changes the numbers
  useEffect(() => {
    const events = [
      "license:claimed",
      "license:imported",
      "license:deleted",
      "license:bulk_deleted",
      "license:state_changed",
      "licenses:expired",
      "request:new",
      "request:updated",
      "user:blocked",
      "user:branding_updated",
      "notification:new",
    ];
    const cleanups = events.map((event) => on(event, loadStats));
    return () => cleanups.forEach((off) => off());
  }, [on, loadStats]);

  if (!stats) return <div className="text-muted-foreground text-sm">Cargando estadísticas...</div>;

  if (user?.role === "owner") {
    const renewalAlerts: RenewalAlert[] = stats.renewalAlerts || [];

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">Resumen general del sistema</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <StatCard title="Total Keys"             value={stats.totalKeys}        icon={Key} />
          <StatCard title="Keys Disponibles"       value={stats.availableKeys}    icon={CheckCircle}  variant="success" />
          <StatCard title="Keys Usadas"            value={stats.usedKeys}         icon={ShoppingBag}  variant="warning" />
          <StatCard title="Keys Bloqueadas"        value={stats.blockedKeys}      icon={XCircle}      variant="danger" />
          <StatCard title="Revendedores"           value={stats.totalResellers}   icon={Users} />
          <StatCard title="Solicitudes Pendientes" value={stats.pendingRequests}  icon={AlertCircle}  variant="warning" />
        </div>

        {/* Health row */}
        {(stats.openTickets > 0 || stats.lowStockResellers?.length > 0) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {stats.openTickets > 0 && (
              <div className="flex items-center gap-3 px-4 py-3 rounded-lg border bg-blue-500/5 border-blue-500/15 text-blue-400 text-sm">
                <MessageSquare className="w-4 h-4 shrink-0 opacity-70" />
                <span>{stats.openTickets} ticket{stats.openTickets !== 1 ? "s" : ""} de soporte abierto{stats.openTickets !== 1 ? "s" : ""}</span>
              </div>
            )}
            {stats.lowStockResellers?.length > 0 && (
              <div className="flex items-center gap-3 px-4 py-3 rounded-lg border bg-amber-500/5 border-amber-500/15 text-amber-400 text-sm">
                <AlertTriangle className="w-4 h-4 shrink-0 opacity-70" />
                <span>{stats.lowStockResellers.length} revendedor{stats.lowStockResellers.length !== 1 ? "es" : ""} con stock bajo (&lt;5 keys)</span>
              </div>
            )}
          </div>
        )}

        {/* Renewal alerts */}
        {renewalAlerts.length > 0 && (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex items-center gap-2">
              <CalendarClock className="w-4 h-4 text-muted-foreground" />
              <h2 className="font-semibold text-sm">Renovaciones pendientes</h2>
              <span className="ml-auto text-xs text-muted-foreground">{renewalAlerts.length} revendedor{renewalAlerts.length !== 1 ? "es" : ""}</span>
            </div>
            <div className="divide-y divide-border">
              {renewalAlerts.map((r) => {
                const days = daysUntil(r.renewalDate);
                return (
                  <div key={r.id} className="flex items-center justify-between px-5 py-3 gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {r.displayName || r.username}
                        {r.displayName && (
                          <span className="text-muted-foreground font-normal ml-1.5 text-xs">@{r.username}</span>
                        )}
                      </p>
                      {r.renewalNote && (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">{r.renewalNote}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-xs text-muted-foreground">
                        {new Date(r.renewalDate).toLocaleDateString("es")}
                      </span>
                      {days !== null && (
                        <span className={`text-xs font-medium ${
                          days < 0 ? "text-red-400" : days <= 3 ? "text-amber-400" : "text-muted-foreground"
                        }`}>
                          {days < 0 ? `Vencido hace ${Math.abs(days)}d` : days === 0 ? "Hoy" : `${days}d restantes`}
                        </span>
                      )}
                      <Badge value={r.renewalStatus} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="font-semibold mb-4 text-sm flex items-center gap-2">
            <Activity className="w-4 h-4 text-muted-foreground" />
            Actividad reciente
          </h2>
          <div className="space-y-2">
            {stats.recentLogs?.length === 0 && (
              <p className="text-muted-foreground text-sm">Sin actividad reciente</p>
            )}
            {stats.recentLogs?.map((log: any) => (
              <div key={log.id} className="flex items-start gap-3 py-2 border-b border-border last:border-0">
                <Clock className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm text-foreground">{log.detail}</p>
                  <p className="text-xs text-muted-foreground">{new Date(log.createdAt).toLocaleString("es")}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── Reseller dashboard ──
  const name   = user?.displayName || user?.username || "";
  const hasAccent = !!user?.accentColor;
  const renewal = stats.renewal as { renewalDate: string | null; renewalStatus: string | null; renewalNote: string | null } | null;
  const renewalDays = daysUntil(renewal?.renewalDate);

  const warnings: { icon: any; color: string; text: string }[] = [];
  if (stats.availableKeys === 0) {
    warnings.push({ icon: TrendingDown, color: "bg-red-500/5 border-red-500/15 text-red-500 dark:text-red-400", text: "Sin stock disponible. Contacta al administrador para recargar inventario." });
  } else if (stats.availableKeys <= 5) {
    warnings.push({ icon: AlertTriangle, color: "bg-amber-500/5 border-amber-500/15 text-amber-600 dark:text-amber-400", text: `Stock bajo — ${stats.availableKeys} keys disponibles.` });
  }
  if (stats.pendingRequests > 0) {
    warnings.push({ icon: AlertCircle, color: "bg-blue-500/5 border-blue-500/15 text-blue-600 dark:text-blue-400", text: `${stats.pendingRequests} solicitud${stats.pendingRequests !== 1 ? "es" : ""} pendiente${stats.pendingRequests !== 1 ? "s" : ""} de respuesta.` });
  }
  const expiringSoon = stats.recentClaimed?.filter((l: any) => {
    if (!l.expiresAt) return false;
    const diff = new Date(l.expiresAt).getTime() - Date.now();
    return diff > 0 && diff < 3 * 24 * 60 * 60 * 1000;
  });
  if (expiringSoon?.length > 0) {
    warnings.push({ icon: Clock, color: "bg-orange-500/5 border-orange-500/15 text-orange-600 dark:text-orange-400", text: `${expiringSoon.length} key${expiringSoon.length !== 1 ? "s" : ""} próxima${expiringSoon.length !== 1 ? "s" : ""} a expirar en menos de 3 días.` });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">
          Bienvenido,{" "}
          <span style={hasAccent ? { color: "var(--accent-hex)" } : undefined} className={!hasAccent ? "text-primary" : ""}>
            {name}
          </span>
        </h1>
        <p className="text-muted-foreground text-sm mt-1">{user?.panelName || "Panel de revendedor"}</p>
      </div>

      {/* Renewal banner — overdue gets persistent hard warning */}
      {renewal?.renewalDate && renewal.renewalStatus !== "active" && (
        <div
          className={`flex items-start gap-3 px-4 py-3.5 rounded-lg border text-sm ${
            renewal.renewalStatus === "overdue"
              ? "bg-red-500/8 border-red-500/30 text-red-400"
              : "bg-amber-500/5 border-amber-500/20 text-amber-400"
          }`}
        >
          <CalendarClock className="w-4 h-4 shrink-0 mt-0.5 opacity-80" />
          <div className="flex-1 min-w-0">
            {renewal.renewalStatus === "overdue" ? (
              <>
                <p className="font-semibold">Renovación vencida</p>
                <p className="text-xs mt-0.5 opacity-80">Tu acceso puede ser restringido en cualquier momento. Contacta al administrador para regularizar tu cuenta.</p>
              </>
            ) : (
              <span>
                Tu renovación vence el{" "}
                <span className="font-medium">{new Date(renewal.renewalDate).toLocaleDateString("es")}</span>
                {renewalDays !== null && renewalDays >= 0 && (
                  <span className="ml-1 opacity-70">({renewalDays === 0 ? "hoy" : `en ${renewalDays} día${renewalDays !== 1 ? "s" : ""}`})</span>
                )}
                . Contacta al administrador para renovar.
              </span>
            )}
            {renewal.renewalNote && (
              <p className="text-xs opacity-70 mt-0.5 truncate">{renewal.renewalNote}</p>
            )}
          </div>
        </div>
      )}

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="space-y-2">
          {warnings.map((w, i) => <WarningBanner key={i} {...w} />)}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Stock disponible"      value={stats.availableKeys}   icon={CheckCircle} variant="success" />
        <StatCard title="Keys entregadas"       value={stats.usedKeys}        icon={ShoppingBag} variant="warning" />
        <StatCard title="Total asignadas"       value={stats.totalKeys}       icon={Key} />
        <StatCard title="Solicitudes pendientes" value={stats.pendingRequests} icon={AlertCircle} variant="warning" />
      </div>

      {/* First-use hint when no keys assigned yet */}
      {stats.totalKeys === 0 && (
        <div className="bg-card border border-dashed border-border rounded-xl p-8 text-center">
          <Key className="w-8 h-8 text-muted-foreground mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium text-foreground">Sin keys asignadas todavía</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
            El administrador te asignará un lote de keys. Una vez asignadas, podrás reclamarlas desde la sección <span className="text-foreground font-medium">Reclamar Key</span>.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Stock por producto */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="font-semibold mb-4 text-sm">Stock disponible</h2>
          {!stats.stockByProduct?.length ? (
            <div className="text-center py-6">
              <TrendingDown className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-40" />
              <p className="text-muted-foreground text-sm">Sin stock disponible</p>
            </div>
          ) : (
            <div className="space-y-2">
              {stats.stockByProduct.map((item: any, i: number) => (
                <div
                  key={i}
                  className="flex items-center justify-between py-2.5 px-3 rounded-lg transition-colors"
                  style={{ background: "var(--accent-soft, hsl(var(--secondary) / 0.2))" }}
                >
                  <div>
                    <span className="text-sm font-medium">{item.product?.name ?? item.productId}</span>
                    <span className="text-xs text-muted-foreground ml-2">{item.duration}d</span>
                  </div>
                  <span
                    className="text-sm font-bold px-2 py-0.5 rounded-md"
                    style={hasAccent ? {
                      color:      "var(--accent-hex)",
                      background: "var(--accent-soft)",
                    } : { color: "rgb(52 211 153)", background: "rgba(52,211,153,0.1)" }}
                  >
                    {item._count.id} keys
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Últimas keys entregadas */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="font-semibold mb-4 text-sm">Últimas keys entregadas</h2>
          {!stats.recentClaimed?.length ? (
            <div className="text-center py-6">
              <Key className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-40" />
              <p className="text-muted-foreground text-sm">Aún no has entregado keys</p>
            </div>
          ) : (
            <div className="space-y-2">
              {stats.recentClaimed.map((lic: any) => {
                const expiring = lic.expiresAt && new Date(lic.expiresAt).getTime() - Date.now() < 3 * 24 * 60 * 60 * 1000 && new Date(lic.expiresAt) > new Date();
                const expired  = lic.expiresAt && new Date(lic.expiresAt) < new Date();
                return (
                  <div key={lic.id} className={`flex items-center justify-between py-2.5 px-3 rounded-lg transition-colors ${
                    expired ? "bg-red-500/5" : expiring ? "bg-amber-500/5" : "bg-secondary/20 hover:bg-secondary/40"
                  }`}>
                    <div className="min-w-0">
                      <p className="text-xs font-mono text-foreground truncate">{lic.key}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {lic.product?.name} · {lic.duration}d
                        {lic.clientAlias && <span className="ml-1" style={hasAccent ? { color: "var(--accent-hex)", opacity: 0.8 } : { color: "hsl(var(--primary) / 0.7)" }}>· {lic.clientAlias}</span>}
                      </p>
                    </div>
                    <div className="text-right shrink-0 ml-3">
                      {expired ? (
                        <span className="text-xs text-red-400">Expirada</span>
                      ) : expiring ? (
                        <span className="text-xs text-amber-400">Expira pronto</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {lic.claimedAt ? new Date(lic.claimedAt).toLocaleDateString("es") : "—"}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
