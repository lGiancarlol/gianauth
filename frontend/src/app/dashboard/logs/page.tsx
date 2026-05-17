"use client";
import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import api from "@/lib/api";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { RefreshCw, Download, ChevronLeft, ChevronRight, Search, X } from "lucide-react";

interface AuditLog {
  id: number;
  action: string;
  actorRole: string | null;
  targetType: string | null;
  targetId: number | null;
  metadata: Record<string, any> | string | null;
  ip: string | null;
  createdAt: string;
  actor: { id: number; username: string } | null;
}

const ACTION_CATEGORY: Record<string, { label: string; variant: "default" | "success" | "warning" | "danger" | "info" }> = {
  LOGIN:               { label: "Login",            variant: "info" },
  CLAIM_KEY:           { label: "Claim",            variant: "success" },
  ASSIGN_KEYS:         { label: "Asignación",       variant: "success" },
  SOFT_DELETE_KEY:     { label: "Eliminación",      variant: "danger" },
  RESTORE_KEY:         { label: "Restauración",     variant: "info" },
  BLOCK_KEY:           { label: "Bloqueo key",      variant: "warning" },
  UNBLOCK_KEY:         { label: "Desbloqueo key",   variant: "info" },
  CREATE_USER:         { label: "Nuevo usuario",    variant: "success" },
  DELETE_USER:         { label: "Eliminar usuario", variant: "danger" },
  BLOCK_USER:          { label: "Bloqueo usuario",  variant: "warning" },
  UNBLOCK_USER:        { label: "Desbloqueo",       variant: "info" },
  UPDATE_LIMITS:       { label: "Límites",          variant: "warning" },
  UPDATE_BRANDING:     { label: "Branding",         variant: "info" },
  CREATE_REQUEST:      { label: "Solicitud",        variant: "default" },
  REQUEST_APPROVED:    { label: "Aprobado",         variant: "success" },
  REQUEST_REJECTED:    { label: "Rechazado",        variant: "danger" },
  REQUEST_COMPLETED:   { label: "Completado",       variant: "success" },
  CREATE_PRODUCT:      { label: "Producto",         variant: "success" },
  UPDATE_PRODUCT:      { label: "Producto edit.",   variant: "info" },
  UPDATE_LICENSE_META: { label: "Meta key",         variant: "default" },
};

const VARIANT_CLASSES = {
  default: "bg-secondary text-muted-foreground border-border",
  success: "bg-emerald-500/8 text-emerald-600 border-emerald-500/20 dark:text-emerald-400",
  warning: "bg-amber-500/8 text-amber-600 border-amber-500/20 dark:text-amber-400",
  danger:  "bg-red-500/8 text-red-600 border-red-500/20 dark:text-red-400",
  info:    "bg-blue-500/8 text-blue-600 border-blue-500/20 dark:text-blue-400",
};

function Badge({ action }: { action: string }) {
  const cfg = ACTION_CATEGORY[action] || { label: action, variant: "default" as const };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${VARIANT_CLASSES[cfg.variant]}`}>
      {cfg.label}
    </span>
  );
}

function MetaCell({ metadata }: { metadata: any }) {
  if (!metadata) return <span className="text-muted-foreground">—</span>;
  if (typeof metadata === "string") return <span className="font-mono text-xs">{metadata}</span>;

  const entries = Object.entries(metadata).filter(([, v]) => v !== null && v !== undefined && v !== "");
  if (!entries.length) return <span className="text-muted-foreground">—</span>;

  return (
    <div className="flex flex-wrap gap-1.5">
      {entries.slice(0, 4).map(([k, v]) => (
        <span key={k} className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <span className="text-foreground/50">{k}:</span>
          <span className="font-mono text-foreground/80 truncate max-w-[120px]">{String(v)}</span>
        </span>
      ))}
      {entries.length > 4 && <span className="text-xs text-muted-foreground">+{entries.length - 4}</span>}
    </div>
  );
}

const LIMIT = 50;

export default function LogsPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [logs, setLogs]         = useState<AuditLog[]>([]);
  const [total, setTotal]       = useState(0);
  const [pages, setPages]       = useState(1);
  const [page, setPage]         = useState(1);
  const [loading, setLoading]   = useState(true);
  const [actions, setActions]   = useState<string[]>([]);

  const [filters, setFilters] = useState({
    search: "", action: "", targetType: "", from: "", to: "",
  });
  const [applied, setApplied] = useState(filters);

  useEffect(() => {
    if (user && user.role !== "owner") router.push("/dashboard");
  }, [user]);

  useEffect(() => {
    api.get("/logs/actions").then((r) => setActions(r.data)).catch(() => {});
  }, []);

  const load = useCallback(async (p = 1, f = applied) => {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: String(p), limit: String(LIMIT) };
      if (f.search)     params.search     = f.search;
      if (f.action)     params.action     = f.action;
      if (f.targetType) params.targetType = f.targetType;
      if (f.from)       params.from       = f.from;
      if (f.to)         params.to         = f.to;

      const { data } = await api.get("/logs", { params });
      setLogs(data.logs);
      setTotal(data.total);
      setPages(data.pages);
      setPage(p);
    } catch {
      toast.error("Error al cargar registros");
    } finally {
      setLoading(false);
    }
  }, [applied]);

  useEffect(() => { load(1); }, []);

  function applyFilters() {
    setApplied(filters);
    load(1, filters);
  }

  function clearFilters() {
    const empty = { search: "", action: "", targetType: "", from: "", to: "" };
    setFilters(empty);
    setApplied(empty);
    load(1, empty);
  }

  function exportCSV() {
    const header = ["ID", "Fecha", "Acción", "Actor", "Rol", "Target", "Target ID", "IP", "Metadata"];
    const rows = logs.map((l) => [
      l.id,
      new Date(l.createdAt).toISOString(),
      l.action,
      l.actor?.username || "sistema",
      l.actorRole || "",
      l.targetType || "",
      l.targetId || "",
      l.ip || "",
      l.metadata ? JSON.stringify(l.metadata) : "",
    ]);
    const csv = [header, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const hasFilters = Object.values(applied).some(Boolean);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Registro de auditoría</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {total.toLocaleString()} {total === 1 ? "entrada" : "entradas"}
            {hasFilters && " · filtrado"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => load(page)} className="flex items-center gap-2 bg-secondary hover:bg-accent text-foreground px-3 py-2 rounded-lg text-sm transition-colors">
            <RefreshCw className="w-3.5 h-3.5" /> Actualizar
          </button>
          <button onClick={exportCSV} className="flex items-center gap-2 bg-secondary hover:bg-accent text-foreground px-3 py-2 rounded-lg text-sm transition-colors">
            <Download className="w-3.5 h-3.5" /> CSV
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="relative lg:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar en acción, rol, metadata..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              onKeyDown={(e) => e.key === "Enter" && applyFilters()}
              className="w-full pl-9 pr-3 py-2 bg-input border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <select
            value={filters.action}
            onChange={(e) => setFilters({ ...filters, action: e.target.value })}
            className="bg-input border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">Todas las acciones</option>
            {actions.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          <select
            value={filters.targetType}
            onChange={(e) => setFilters({ ...filters, targetType: e.target.value })}
            className="bg-input border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">Todos los targets</option>
            <option value="user">Usuario</option>
            <option value="license">Licencia</option>
            <option value="request">Solicitud</option>
            <option value="product">Producto</option>
          </select>
          <div className="flex gap-2">
            <button onClick={applyFilters} className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground py-2 rounded-lg text-sm font-medium transition-colors">
              Filtrar
            </button>
            {hasFilters && (
              <button onClick={clearFilters} className="p-2 bg-secondary hover:bg-accent rounded-lg text-muted-foreground hover:text-foreground transition-colors">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 mt-3 max-w-sm">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Desde</label>
            <input type="datetime-local" value={filters.from}
              onChange={(e) => setFilters({ ...filters, from: e.target.value })}
              className="w-full bg-input border border-border rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Hasta</label>
            <input type="datetime-local" value={filters.to}
              onChange={(e) => setFilters({ ...filters, to: e.target.value })}
              className="w-full bg-input border border-border rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/20">
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide whitespace-nowrap">Fecha</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Acción</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Actor</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Target</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Detalle</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">IP</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="text-center py-12 text-muted-foreground text-sm">Cargando...</td></tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-12 text-muted-foreground text-sm">Sin registros</td></tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="border-b border-border last:border-0 hover:bg-secondary/20 transition-colors">
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap font-mono">
                      {new Date(log.createdAt).toLocaleString("es", { dateStyle: "short", timeStyle: "medium" })}
                    </td>
                    <td className="px-4 py-3">
                      <Badge action={log.action} />
                    </td>
                    <td className="px-4 py-3">
                      {log.actor ? (
                        <div>
                          <span className="text-foreground font-medium">{log.actor.username}</span>
                          {log.actorRole && (
                            <span className="ml-1.5 text-xs text-muted-foreground">{log.actorRole}</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-xs">sistema</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {log.targetType ? (
                        <span>{log.targetType}{log.targetId ? ` #${log.targetId}` : ""}</span>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3 max-w-xs">
                      <MetaCell metadata={log.metadata} />
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground font-mono whitespace-nowrap">
                      {log.ip || "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        {pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-secondary/10">
            <span className="text-xs text-muted-foreground">
              Página {page} de {pages} · {total.toLocaleString()} entradas
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => load(page - 1)}
                disabled={page <= 1}
                className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              {Array.from({ length: Math.min(pages, 7) }, (_, i) => {
                const p = page <= 4 ? i + 1 : page - 3 + i;
                if (p < 1 || p > pages) return null;
                return (
                  <button
                    key={p}
                    onClick={() => load(p)}
                    className={`w-7 h-7 rounded-md text-xs font-medium transition-colors ${p === page ? "bg-primary text-primary-foreground" : "hover:bg-accent text-muted-foreground hover:text-foreground"}`}
                  >
                    {p}
                  </button>
                );
              })}
              <button
                onClick={() => load(page + 1)}
                disabled={page >= pages}
                className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
