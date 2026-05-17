"use client";
import { useEffect, useState, useCallback } from "react";
import api from "@/lib/api";
import Badge from "@/components/Badge";
import { toast } from "sonner";
import EmptyState from "@/components/EmptyState";
import { Filter, RefreshCw, ClipboardList } from "lucide-react";
import { useSocket } from "@/hooks/useSocket";

interface Request {
  id: number;
  type: string;
  status: string;
  comment: string | null;
  createdAt: string;
  resolvedAt: string | null;
  resolvedNote: string | null;
  licenseDeleted?: boolean;
  license: { key: string; product: { name: string; slug: string }; duration: number; assignedUser: string | null } | null;
}

const TYPE_LABELS: Record<string, string> = {
  reset_hwid: "Reset HWID",
  ban:        "Suspender usuario",
  unban:      "Reactivar usuario",
  delete:     "Eliminar key",
  extend:     "Extensión de tiempo",
};

const TYPE_COLORS: Record<string, string> = {
  reset_hwid: "text-blue-500",
  ban:        "text-red-500",
  unban:      "text-emerald-600",
  delete:     "text-red-500",
  extend:     "text-amber-600",
};

export default function MyRequestsPage() {
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("");

  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const { on, status: socketStatus } = useSocket(token);

  const load = useCallback(async (silent = false) => {
    try {
      const params: any = {};
      if (filterStatus) params.status = filterStatus;
      const { data } = await api.get("/requests", { params });
      setRequests(data.requests ?? data);
    } catch {
      if (!silent) toast.error("Error al cargar solicitudes");
    } finally {
      setLoading(false);
    }
  }, [filterStatus]);

  useEffect(() => { setLoading(true); load(); }, [filterStatus]);

  // Realtime via Socket.IO
  useEffect(() => {
    const off = on<{ id: number; status: string }>("request:updated", () => load(true));
    return off;
  }, [on, load]);

  // Fallback polling ONLY when socket is disconnected
  useEffect(() => {
    if (socketStatus === "connected") return;
    const interval = setInterval(() => load(true), 30000);
    return () => clearInterval(interval);
  }, [socketStatus, load]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Mis Solicitudes</h1>
          <p className="text-muted-foreground text-sm mt-1">Historial de solicitudes enviadas</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => load()} className="p-2 rounded-lg hover:bg-accent text-muted-foreground transition-colors" title="Actualizar">
            <RefreshCw className="w-4 h-4" />
          </button>
          <Filter className="w-4 h-4 text-muted-foreground" />
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-card border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">Todas</option>
            <option value="pending">Pendientes</option>
            <option value="approved">Aprobadas</option>
            <option value="completed">Completadas</option>
            <option value="rejected">Rechazadas</option>
          </select>
        </div>
      </div>

      <div className="space-y-3">
        {loading ? (
          <p className="text-muted-foreground text-sm">Cargando...</p>
        ) : requests.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="Sin solicitudes"
            description="Aún no has enviado ninguna solicitud."
          />
        ) : (
          requests.map((req) => (
            <div key={req.id} className="bg-card border border-border rounded-xl p-5 space-y-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3">
                  <span className={`font-semibold text-sm ${TYPE_COLORS[req.type] || "text-foreground"}`}>
                    {TYPE_LABELS[req.type] || req.type}
                  </span>
                  <Badge value={req.status} />
                </div>
                <span className="text-xs text-muted-foreground">
                  {new Date(req.createdAt).toLocaleString("es")}
                </span>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Key</p>
                  <p className="font-mono text-xs truncate">
                    {req.license?.key ?? "[deleted]"}
                    {req.licenseDeleted && <span className="ml-1.5 text-[10px] text-red-400">(eliminada)</span>}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Producto</p>
                  <p>{req.license?.product?.name ?? "—"} · {req.license?.duration ?? "—"}d</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Usuario asignado</p>
                  <p>{req.license?.assignedUser || "—"}</p>
                </div>
              </div>

              {req.comment && (
                <div className="bg-secondary/20 border border-border rounded-lg px-3 py-2 text-sm text-muted-foreground">
                  {req.comment}
                </div>
              )}

              {req.resolvedNote && (
                <div className={`rounded-lg px-3 py-2 text-sm border ${
                  req.status === "approved" || req.status === "completed"
                    ? "bg-emerald-500/5 border-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                    : "bg-red-500/5 border-red-500/15 text-red-600 dark:text-red-400"
                }`}>
                  {req.resolvedNote}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
