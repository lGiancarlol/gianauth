"use client";
import { useEffect, useState, useCallback } from "react";
import api from "@/lib/api";
import Badge from "@/components/Badge";
import { toast } from "sonner";
import EmptyState from "@/components/EmptyState";
import { CheckCircle, XCircle, Clock, Filter, RefreshCw, CheckCheck, ClipboardList } from "lucide-react";
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
  reseller: { id: number; username: string };
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

// Arquitectura preparada para Discord Bot:
// Cuando se integre el bot, este endpoint recibirá callbacks del bot
// y actualizará el estado automáticamente via PATCH /api/requests/:id
// Por ahora el owner gestiona manualmente desde este panel.
// El polling cada 15s simula actualizaciones en tiempo real.

export default function RequestsPage() {
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("pending");
  const [resolving, setResolving] = useState<number | null>(null);
  const [noteModal, setNoteModal] = useState<{ id: number; action: "approved" | "rejected" | "completed" } | null>(null);
  const [resolvedNote, setResolvedNote] = useState("");

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

  useEffect(() => {
    setLoading(true);
    load();
  }, [filterStatus]);

  // Realtime via Socket.IO
  useEffect(() => {
    const off  = on<{ id: number; status: string }>("request:new",     () => load(true));
    const off2 = on<{ id: number; status: string }>("request:updated", () => load(true));
    return () => { off(); off2(); };
  }, [on, load]);

  // Fallback polling ONLY when socket is disconnected
  useEffect(() => {
    if (socketStatus === "connected") return;
    const interval = setInterval(() => load(true), 30000);
    return () => clearInterval(interval);
  }, [socketStatus, load]);

  async function resolve(id: number, status: "approved" | "rejected" | "completed", note?: string) {
    setResolving(id);
    try {
      await api.patch(`/requests/${id}`, { status, resolvedNote: note });
      const labels = { approved: "Solicitud aprobada", rejected: "Solicitud rechazada", completed: "Marcada como completada" };
      toast.success(labels[status]);
      setNoteModal(null);
      setResolvedNote("");
      load();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Error al procesar");
    } finally {
      setResolving(null);
    }
  }

  const pending = requests.filter((r) => r.status === "pending").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Solicitudes</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {pending > 0 ? (
              <span className="text-amber-400 font-medium">{pending} pendiente{pending !== 1 ? "s" : ""}</span>
            ) : (
              "Sin solicitudes pendientes"
            )}
          </p>
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
          <div className="bg-card border border-border rounded-xl">
            <EmptyState
              icon={ClipboardList}
              title="Sin solicitudes"
              description={filterStatus ? `No hay solicitudes con estado "${filterStatus}".` : "No hay solicitudes registradas."}
            />
          </div>
        ) : (
          requests.map((req) => (
            <div key={req.id} className={`bg-card border rounded-xl p-5 transition-colors ${
              req.status === "pending" ? "border-amber-500/30" : "border-border"
            }`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 space-y-3">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className={`font-semibold text-sm ${TYPE_COLORS[req.type] || "text-foreground"}`}>
                      {TYPE_LABELS[req.type] || req.type}
                    </span>
                    <Badge value={req.status} />
                    <span className="text-xs text-muted-foreground">
                      {new Date(req.createdAt).toLocaleString("es")}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">Revendedor</p>
                      <p className="font-medium">{req.reseller.username}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">Key</p>
                      <p className="font-mono text-xs truncate max-w-[140px]">
                        {req.license?.key ?? "[deleted]"}
                        {req.licenseDeleted && <span className="ml-1.5 text-[10px] text-red-400 font-normal not-italic">(eliminada)</span>}
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
                    <div className="bg-secondary/20 border border-border rounded-lg px-3 py-2 text-sm text-muted-foreground">
                      {req.resolvedNote}
                    </div>
                  )}
                </div>

                {/* Acciones */}
                <div className="flex flex-col gap-2 shrink-0">
                  {req.status === "pending" && (
                    <>
                      <button
                        onClick={() => setNoteModal({ id: req.id, action: "approved" })}
                        disabled={resolving === req.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded-lg text-xs font-medium transition-colors"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        Aprobar
                      </button>
                      <button
                        onClick={() => setNoteModal({ id: req.id, action: "rejected" })}
                        disabled={resolving === req.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-lg text-xs font-medium transition-colors"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        Rechazar
                      </button>
                    </>
                  )}
                  {req.status === "approved" && (
                    <button
                      onClick={() => setNoteModal({ id: req.id, action: "completed" })}
                      disabled={resolving === req.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 rounded-lg text-xs font-medium transition-colors"
                    >
                      <CheckCheck className="w-3.5 h-3.5" />
                      Completar
                    </button>
                  )}
                  {(req.status === "rejected" || req.status === "completed") && (
                    <div className="text-xs text-muted-foreground text-right">
                      <Clock className="w-3.5 h-3.5 inline mr-1" />
                      {req.resolvedAt ? new Date(req.resolvedAt).toLocaleDateString("es") : "—"}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal resolución */}
      {noteModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-xl p-6 w-full max-w-md space-y-4">
            <h2 className="font-semibold">
              {noteModal.action === "approved" && "Aprobar solicitud"}
              {noteModal.action === "rejected" && "Rechazar solicitud"}
              {noteModal.action === "completed" && "Marcar como completada"}
            </h2>
            <div>
              <label className="text-sm text-muted-foreground block mb-1.5">Nota (opcional)</label>
              <textarea
                value={resolvedNote}
                onChange={(e) => setResolvedNote(e.target.value)}
                className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring h-24 resize-none"
                placeholder={
                  noteModal.action === "completed"
                    ? "Ej: Procesado en KeyAuth correctamente..."
                    : noteModal.action === "rejected"
                    ? "Ej: No cumple los requisitos..."
                    : "Ej: Se procesará en las próximas horas..."
                }
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => resolve(noteModal.id, noteModal.action, resolvedNote || undefined)}
                disabled={resolving === noteModal.id}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${
                  noteModal.action === "approved" ? "bg-emerald-500 hover:bg-emerald-600 text-white"
                  : noteModal.action === "completed" ? "bg-blue-500 hover:bg-blue-600 text-white"
                  : "bg-red-500 hover:bg-red-600 text-white"
                }`}
              >
                Confirmar
              </button>
              <button
                onClick={() => { setNoteModal(null); setResolvedNote(""); }}
                className="flex-1 bg-secondary hover:bg-accent text-foreground py-2 rounded-lg text-sm transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
