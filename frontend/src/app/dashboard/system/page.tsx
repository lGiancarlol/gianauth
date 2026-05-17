"use client";
import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { toast } from "sonner";
import Badge from "@/components/Badge";
import {
  Activity, Database, Cpu, HardDrive, Wifi, Clock, AlertTriangle,
  CheckCircle2, XCircle, RefreshCw, Download, Trash2, Play,
  ChevronDown, ChevronUp, Shield, Server, Archive, AlertCircle,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Health {
  status: string; version: string; env: string; uptime: number;
  db: { ok: boolean };
  memory: { heapUsed: number; heapTotal: number; rss: number; systemTotal: number; systemFree: number; systemUsedPct: number };
  cpu: { cores: number; model: string; load1: number; load5: number; load15: number };
  disk: { total: number; used: number; available: number } | null;
  socket: { connected: number };
  lastBackup: { filename: string; sizeBytes: number; createdAt: string } | null;
  alerts: { pendingRequests: number; openTickets: number; unresolvedErrors: number };
}

interface ErrorLog {
  id: number; severity: string; message: string; endpoint: string | null;
  username: string | null; ip: string | null; resolved: boolean; createdAt: string;
  stack?: string | null;
}

interface BackupRecord {
  id: number; filename: string; sizeBytes: number; createdAt: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

function fmtUptime(s: number) {
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  return [d && `${d}d`, h && `${h}h`, `${m}m`].filter(Boolean).join(" ");
}

function StatusDot({ ok }: { ok: boolean }) {
  return <span className={`inline-block w-2 h-2 rounded-full ${ok ? "bg-emerald-400" : "bg-red-400"}`} />;
}

function MetricCard({ icon: Icon, label, value, sub, warn }: { icon: any; label: string; value: string; sub?: string; warn?: boolean }) {
  return (
    <div className={`bg-card border rounded-xl p-4 ${warn ? "border-amber-500/20" : "border-border"}`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-4 h-4 ${warn ? "text-amber-400" : "text-muted-foreground"}`} />
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <p className={`text-xl font-bold ${warn ? "text-amber-400" : "text-foreground"}`}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

const ADMIN_ACTIONS = [
  { key: "force_expiration_job",      label: "Forzar expiración de keys",       icon: Clock,         confirm: true },
  { key: "force_stock_warning_job",   label: "Forzar alertas de stock",          icon: AlertTriangle, confirm: false },
  { key: "clear_old_notifications",   label: "Limpiar notificaciones leídas",    icon: Trash2,        confirm: true, days: 30 },
  { key: "clear_old_audit_logs",      label: "Limpiar logs de auditoría >90d",   icon: Trash2,        confirm: true, days: 90 },
  { key: "clear_inactive_sessions",   label: "Limpiar sesiones inactivas",       icon: Shield,        confirm: true },
];

// ── Page ──────────────────────────────────────────────────────────────────────
export default function SystemPage() {
  const { user } = useAuth();
  const router   = useRouter();

  const [health,   setHealth]   = useState<Health | null>(null);
  const [errors,   setErrors]   = useState<ErrorLog[]>([]);
  const [errTotal, setErrTotal] = useState(0);
  const [errPage,  setErrPage]  = useState(1);
  const [errFilter, setErrFilter] = useState({ severity: "", resolved: "false", search: "" });
  const [backups,  setBackups]  = useState<BackupRecord[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [running,  setRunning]  = useState<string | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [confirm,  setConfirm]  = useState<string | null>(null);

  useEffect(() => {
    if (user && user.role !== "owner") router.push("/dashboard");
  }, [user]);

  const loadHealth = useCallback(async () => {
    try { const { data } = await api.get("/system/health"); setHealth(data); }
    catch { toast.error("Error al cargar estado del sistema"); }
    finally { setLoading(false); }
  }, []);

  const loadErrors = useCallback(async (page = 1) => {
    try {
      const params: any = { page, limit: 20, ...errFilter };
      if (!params.severity) delete params.severity;
      if (!params.search)   delete params.search;
      const { data } = await api.get("/system/errors", { params });
      setErrors(data.errors);
      setErrTotal(data.total);
      setErrPage(page);
    } catch {}
  }, [errFilter]);

  const loadBackups = useCallback(async () => {
    try { const { data } = await api.get("/system/backups"); setBackups(data); }
    catch {}
  }, []);

  useEffect(() => { loadHealth(); loadErrors(); loadBackups(); }, []);
  useEffect(() => { loadErrors(1); }, [errFilter]);

  async function resolveError(id: number) {
    await api.patch(`/system/errors/${id}/resolve`).catch(() => {});
    loadErrors(errPage);
  }

  async function clearResolved() {
    const { data } = await api.delete("/system/errors");
    toast.success(`${data.deleted} errores resueltos eliminados`);
    loadErrors(1);
  }

  async function runAdminAction(key: string, days?: number) {
    setRunning(key);
    setConfirm(null);
    try {
      const { data } = await api.post(`/system/admin/${key}`, days ? { days } : {});
      const r = data.result;
      const msg = r.deleted !== undefined ? `${r.deleted} registros eliminados`
        : r.expired !== undefined ? `${r.expired} keys expiradas`
        : r.triggered ? "Job ejecutado"
        : "Completado";
      toast.success(msg);
      loadHealth();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Error al ejecutar acción");
    } finally { setRunning(null); }
  }

  async function createBackup() {
    setRunning("backup");
    try {
      const { data } = await api.post("/system/backups");
      toast.success(`Backup creado: ${data.filename} (${fmt(data.sizeBytes)})`);
      loadBackups();
      loadHealth();
    } catch { toast.error("Error al crear backup"); }
    finally { setRunning(null); }
  }

  async function downloadBackup(filename: string) {
    const token = localStorage.getItem("token");
    const url   = `${process.env.NEXT_PUBLIC_API_URL}/system/backups/${filename}`;
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.blob())
      .then((blob) => {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        a.click();
        URL.revokeObjectURL(a.href);
      })
      .catch(() => toast.error("Error al descargar backup"));
  }

  if (loading) return <div className="text-muted-foreground text-sm">Cargando sistema...</div>;
  if (!health) return null;

  const memPct  = health.memory.systemUsedPct;
  const heapPct = Math.round((health.memory.heapUsed / health.memory.heapTotal) * 100);
  const diskPct = health.disk ? Math.round((health.disk.used / health.disk.total) * 100) : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Sistema</h1>
          <p className="text-muted-foreground text-sm mt-1">
            v{health.version} · {health.env} · uptime {fmtUptime(health.uptime)}
          </p>
        </div>
        <button onClick={() => { loadHealth(); loadErrors(); loadBackups(); }}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/40 transition-colors">
          <RefreshCw className="w-4 h-4" /> Actualizar
        </button>
      </div>

      {/* Status row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className={`bg-card border rounded-xl px-4 py-3 flex items-center gap-3 ${health.db.ok ? "border-border" : "border-red-500/30"}`}>
          <StatusDot ok={health.db.ok} />
          <div>
            <p className="text-xs text-muted-foreground">Base de datos</p>
            <p className="text-sm font-medium">{health.db.ok ? "Operativa" : "Error"}</p>
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl px-4 py-3 flex items-center gap-3">
          <StatusDot ok={health.socket.connected >= 0} />
          <div>
            <p className="text-xs text-muted-foreground">Socket.IO</p>
            <p className="text-sm font-medium">{health.socket.connected} cliente{health.socket.connected !== 1 ? "s" : ""}</p>
          </div>
        </div>
        <div className={`bg-card border rounded-xl px-4 py-3 flex items-center gap-3 ${health.alerts.unresolvedErrors > 0 ? "border-red-500/20" : "border-border"}`}>
          <StatusDot ok={health.alerts.unresolvedErrors === 0} />
          <div>
            <p className="text-xs text-muted-foreground">Errores</p>
            <p className={`text-sm font-medium ${health.alerts.unresolvedErrors > 0 ? "text-red-400" : ""}`}>
              {health.alerts.unresolvedErrors} sin resolver
            </p>
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl px-4 py-3 flex items-center gap-3">
          <StatusDot ok={!!health.lastBackup} />
          <div>
            <p className="text-xs text-muted-foreground">Último backup</p>
            <p className="text-sm font-medium">
              {health.lastBackup
                ? new Date(health.lastBackup.createdAt).toLocaleDateString("es")
                : "Nunca"}
            </p>
          </div>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        <MetricCard icon={Cpu}       label="CPU (load 1m)"  value={health.cpu.load1.toFixed(2)}  sub={`${health.cpu.cores} cores`} warn={health.cpu.load1 > health.cpu.cores * 0.8} />
        <MetricCard icon={Server}    label="RAM sistema"    value={`${memPct}%`}                  sub={`${fmt(health.memory.systemFree)} libre`} warn={memPct > 85} />
        <MetricCard icon={Activity}  label="Heap Node.js"   value={`${heapPct}%`}                 sub={`${fmt(health.memory.heapUsed)} / ${fmt(health.memory.heapTotal)}`} warn={heapPct > 80} />
        {diskPct !== null && health.disk && (
          <MetricCard icon={HardDrive} label="Disco"        value={`${diskPct}%`}                 sub={`${fmt(health.disk.available)} libre`} warn={diskPct > 85} />
        )}
        <MetricCard icon={Clock}     label="Uptime"         value={fmtUptime(health.uptime)}      sub={health.env} />
        <MetricCard icon={AlertCircle} label="Solicitudes pendientes" value={String(health.alerts.pendingRequests)} warn={health.alerts.pendingRequests > 0} />
        <MetricCard icon={Wifi}      label="Tickets abiertos" value={String(health.alerts.openTickets)} warn={health.alerts.openTickets > 0} />
        {health.lastBackup && (
          <MetricCard icon={Archive} label="Tamaño backup"  value={fmt(health.lastBackup.sizeBytes)} />
        )}
      </div>

      {/* Two-column: errors + admin tools */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Error viewer */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center gap-2">
            <XCircle className="w-4 h-4 text-muted-foreground" />
            <h2 className="font-semibold text-sm flex-1">Errores del sistema</h2>
            <span className="text-xs text-muted-foreground">{errTotal} total</span>
            {errors.some((e) => e.resolved) && (
              <button onClick={clearResolved} className="text-xs text-muted-foreground hover:text-destructive transition-colors">
                Limpiar resueltos
              </button>
            )}
          </div>

          {/* Filters */}
          <div className="px-4 py-2.5 border-b border-border flex gap-2 flex-wrap">
            {["", "error", "warn", "critical"].map((s) => (
              <button key={s} onClick={() => setErrFilter((f) => ({ ...f, severity: s }))}
                className={`px-2.5 py-1 rounded-md text-xs transition-colors ${errFilter.severity === s ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:text-foreground"}`}>
                {s === "" ? "Todos" : s}
              </button>
            ))}
            <button onClick={() => setErrFilter((f) => ({ ...f, resolved: f.resolved === "false" ? "" : "false" }))}
              className={`px-2.5 py-1 rounded-md text-xs transition-colors ml-auto ${errFilter.resolved === "false" ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:text-foreground"}`}>
              Sin resolver
            </button>
          </div>

          <div className="divide-y divide-border max-h-80 overflow-y-auto">
            {errors.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2 opacity-60" />
                <p className="text-sm text-muted-foreground">Sin errores</p>
              </div>
            ) : errors.map((err) => (
              <div key={err.id} className="px-4 py-3">
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                        err.severity === "critical" ? "bg-red-500/10 text-red-400" :
                        err.severity === "warn"     ? "bg-amber-500/10 text-amber-400" :
                        "bg-secondary text-muted-foreground"
                      }`}>{err.severity}</span>
                      {err.endpoint && <span className="text-xs text-muted-foreground font-mono truncate">{err.endpoint}</span>}
                    </div>
                    <p className="text-sm text-foreground truncate">{err.message}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {err.username && <span className="mr-2">{err.username}</span>}
                      {new Date(err.createdAt).toLocaleString("es", { dateStyle: "short", timeStyle: "short" })}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {err.stack && (
                      <button onClick={() => setExpanded(expanded === err.id ? null : err.id)}
                        className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors">
                        {expanded === err.id ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>
                    )}
                    {!err.resolved && (
                      <button onClick={() => resolveError(err.id)}
                        className="p-1 rounded text-muted-foreground hover:text-emerald-400 transition-colors" title="Marcar resuelto">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
                {expanded === err.id && err.stack && (
                  <pre className="mt-2 text-xs text-muted-foreground bg-secondary/30 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap max-h-32">
                    {err.stack}
                  </pre>
                )}
              </div>
            ))}
          </div>

          {errTotal > 20 && (
            <div className="px-4 py-2.5 border-t border-border flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Página {errPage}</span>
              <div className="flex gap-1">
                <button onClick={() => loadErrors(errPage - 1)} disabled={errPage <= 1}
                  className="px-2 py-1 text-xs rounded border border-border disabled:opacity-40 hover:bg-secondary/40 transition-colors">Ant.</button>
                <button onClick={() => loadErrors(errPage + 1)} disabled={errPage * 20 >= errTotal}
                  className="px-2 py-1 text-xs rounded border border-border disabled:opacity-40 hover:bg-secondary/40 transition-colors">Sig.</button>
              </div>
            </div>
          )}
        </div>

        {/* Admin tools */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center gap-2">
            <Shield className="w-4 h-4 text-muted-foreground" />
            <h2 className="font-semibold text-sm">Herramientas administrativas</h2>
          </div>
          <div className="divide-y divide-border">
            {ADMIN_ACTIONS.map(({ key, label, icon: Icon, confirm: needsConfirm, days }) => (
              <div key={key} className="px-5 py-3.5 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
                  <p className="text-sm text-foreground">{label}</p>
                </div>
                {confirm === key ? (
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-muted-foreground">¿Confirmar?</span>
                    <button onClick={() => runAdminAction(key, days)}
                      className="px-2.5 py-1 text-xs rounded-md bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive/20 transition-colors">
                      Sí
                    </button>
                    <button onClick={() => setConfirm(null)}
                      className="px-2.5 py-1 text-xs rounded-md border border-border hover:bg-secondary/40 transition-colors">
                      No
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => needsConfirm ? setConfirm(key) : runAdminAction(key, days)}
                    disabled={running === key}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-secondary/40 transition-colors disabled:opacity-50 shrink-0"
                  >
                    {running === key ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                    Ejecutar
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Backups */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center gap-2">
          <Archive className="w-4 h-4 text-muted-foreground" />
          <h2 className="font-semibold text-sm flex-1">Backups automáticos</h2>
          <button onClick={createBackup} disabled={running === "backup"}
            className="flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50">
            {running === "backup" ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Archive className="w-3.5 h-3.5" />}
            Crear backup
          </button>
        </div>
        {backups.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-muted-foreground">Sin backups registrados</div>
        ) : (
          <div className="divide-y divide-border">
            {backups.map((b) => (
              <div key={b.id} className="flex items-center justify-between px-5 py-3 gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-mono text-foreground truncate">{b.filename}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {fmt(b.sizeBytes)} · {new Date(b.createdAt).toLocaleString("es", { dateStyle: "medium", timeStyle: "short" })}
                  </p>
                </div>
                <button onClick={() => downloadBackup(b.filename)}
                  className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/40 transition-colors shrink-0">
                  <Download className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
