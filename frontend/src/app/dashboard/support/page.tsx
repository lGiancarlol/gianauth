"use client";
import { useEffect, useState, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import api from "@/lib/api";
import Badge from "@/components/Badge";
import EmptyState from "@/components/EmptyState";
import { MessageSquare, Plus, Send, ChevronLeft, AlertCircle, Clock, CheckCircle2 } from "lucide-react";

interface TicketMessage {
  id: number;
  body: string;
  isOwner: boolean;
  createdAt: string;
  author: { id: number; username: string; role: string; displayName?: string };
}

interface Ticket {
  id: number;
  subject: string;
  status: string;
  priority: string;
  createdAt: string;
  updatedAt: string;
  reseller: { id: number; username: string; displayName?: string };
  messages: TicketMessage[];
  _count?: { messages: number };
}

const PRIORITY_COLORS: Record<string, string> = {
  low:    "text-muted-foreground",
  medium: "text-amber-400",
  high:   "text-red-400",
};

const STATUS_ICON: Record<string, React.ElementType> = {
  open:        AlertCircle,
  in_progress: Clock,
  closed:      CheckCircle2,
};

export default function SupportPage() {
  const { user } = useAuth();
  const [tickets, setTickets]         = useState<Ticket[]>([]);
  const [selected, setSelected]       = useState<Ticket | null>(null);
  const [loading, setLoading]         = useState(true);
  const [replyBody, setReplyBody]     = useState("");
  const [sending, setSending]         = useState(false);
  const [showNew, setShowNew]         = useState(false);
  const [newForm, setNewForm]         = useState({ subject: "", message: "", priority: "medium" });
  const [creating, setCreating]       = useState(false);
  const [filterStatus, setFilterStatus] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isOwner = user?.role === "owner";

  async function loadTickets() {
    try {
      const params = new URLSearchParams({ limit: "50" });
      if (filterStatus) params.set("status", filterStatus);
      const { data } = await api.get(`/tickets?${params}`);
      setTickets(data.tickets);
    } catch { /* noop */ }
    finally { setLoading(false); }
  }

  async function loadTicket(id: number) {
    const { data } = await api.get(`/tickets/${id}`);
    setSelected(data);
    setTickets((prev) => prev.map((t) => t.id === id ? { ...t, ...data } : t));
  }

  useEffect(() => { loadTickets(); }, [filterStatus]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [selected?.messages]);

  async function sendReply() {
    if (!selected || !replyBody.trim()) return;
    setSending(true);
    try {
      await api.post(`/tickets/${selected.id}/messages`, { body: replyBody.trim() });
      setReplyBody("");
      await loadTicket(selected.id);
    } catch { /* noop */ }
    finally { setSending(false); }
  }

  async function createTicket() {
    if (!newForm.subject.trim() || !newForm.message.trim()) return;
    setCreating(true);
    try {
      const { data } = await api.post("/tickets", newForm);
      setTickets((prev) => [data, ...prev]);
      setShowNew(false);
      setNewForm({ subject: "", message: "", priority: "medium" });
      await loadTicket(data.id);
      setSelected(data);
    } catch { /* noop */ }
    finally { setCreating(false); }
  }

  async function updateStatus(status: string) {
    if (!selected) return;
    await api.patch(`/tickets/${selected.id}`, { status });
    await loadTicket(selected.id);
    loadTickets();
  }

  if (loading) return <div className="text-muted-foreground text-sm">Cargando...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Soporte</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {isOwner ? "Tickets de soporte de revendedores" : "Contacta al administrador"}
          </p>
        </div>
        {!isOwner && (
          <button
            onClick={() => setShowNew(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nuevo ticket
          </button>
        )}
      </div>

      {/* New ticket modal */}
      {showNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-xl w-full max-w-lg p-6 modal-enter space-y-4">
            <h2 className="font-semibold">Nuevo ticket</h2>
            <div className="space-y-3">
              <input
                className="w-full px-3 py-2 rounded-lg bg-secondary/40 border border-border text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                placeholder="Asunto"
                value={newForm.subject}
                onChange={(e) => setNewForm((f) => ({ ...f, subject: e.target.value }))}
              />
              <select
                className="w-full px-3 py-2 rounded-lg bg-secondary/40 border border-border text-sm focus:outline-none"
                value={newForm.priority}
                onChange={(e) => setNewForm((f) => ({ ...f, priority: e.target.value }))}
              >
                <option value="low">Prioridad baja</option>
                <option value="medium">Prioridad media</option>
                <option value="high">Prioridad alta</option>
              </select>
              <textarea
                className="w-full px-3 py-2 rounded-lg bg-secondary/40 border border-border text-sm focus:outline-none focus:ring-1 focus:ring-ring resize-none"
                placeholder="Describe tu problema o consulta..."
                rows={5}
                value={newForm.message}
                onChange={(e) => setNewForm((f) => ({ ...f, message: e.target.value }))}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowNew(false)} className="px-4 py-2 text-sm rounded-lg border border-border hover:bg-secondary/40 transition-colors">
                Cancelar
              </button>
              <button
                onClick={createTicket}
                disabled={creating || !newForm.subject.trim() || !newForm.message.trim()}
                className="px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {creating ? "Enviando..." : "Enviar"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-4 h-[calc(100vh-220px)] min-h-[500px]">
        {/* Ticket list */}
        <div className={`flex flex-col bg-card border border-border rounded-xl overflow-hidden ${selected ? "hidden lg:flex w-80 shrink-0" : "flex-1"}`}>
          {/* Filter bar */}
          <div className="px-4 py-3 border-b border-border flex gap-2">
            {["", "open", "in_progress", "closed"].map((s) => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={`px-2.5 py-1 rounded-md text-xs transition-colors ${filterStatus === s ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:text-foreground"}`}
              >
                {s === "" ? "Todos" : s === "open" ? "Abiertos" : s === "in_progress" ? "En progreso" : "Cerrados"}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-border">
            {tickets.length === 0 ? (
              <EmptyState icon={MessageSquare} title="Sin tickets" description={isOwner ? "No hay tickets de soporte" : "No has abierto ningún ticket"} />
            ) : (
              tickets.map((t) => {
                const StatusIcon = STATUS_ICON[t.status] || AlertCircle;
                const lastMsg    = t.messages?.[0];
                return (
                  <button
                    key={t.id}
                    onClick={() => loadTicket(t.id)}
                    className={`w-full text-left px-4 py-3.5 hover:bg-secondary/30 transition-colors ${selected?.id === t.id ? "bg-secondary/40" : ""}`}
                  >
                    <div className="flex items-start gap-2.5">
                      <StatusIcon className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${t.status === "closed" ? "text-muted-foreground" : t.status === "in_progress" ? "text-blue-400" : "text-amber-400"}`} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-foreground truncate">{t.subject}</p>
                          <span className={`text-xs shrink-0 ${PRIORITY_COLORS[t.priority]}`}>
                            {t.priority === "high" ? "Alta" : t.priority === "low" ? "Baja" : ""}
                          </span>
                        </div>
                        {isOwner && (
                          <p className="text-xs text-muted-foreground mt-0.5">{t.reseller.displayName || t.reseller.username}</p>
                        )}
                        {lastMsg && (
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">{lastMsg.body}</p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">{new Date(t.updatedAt).toLocaleDateString("es")}</p>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Conversation panel */}
        {selected ? (
          <div className="flex-1 flex flex-col bg-card border border-border rounded-xl overflow-hidden">
            {/* Header */}
            <div className="px-5 py-3.5 border-b border-border flex items-center gap-3">
              <button onClick={() => setSelected(null)} className="lg:hidden p-1 rounded hover:bg-secondary/40 transition-colors">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate">{selected.subject}</p>
                <p className="text-xs text-muted-foreground">
                  {isOwner ? (selected.reseller.displayName || selected.reseller.username) : ""}
                  {isOwner && " · "}
                  #{selected.id}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge value={selected.priority === "high" ? "high_priority" : selected.priority === "low" ? "low_priority" : "medium_priority"} />
                <Badge value={selected.status} />
                {isOwner && selected.status !== "closed" && (
                  <button
                    onClick={() => updateStatus("closed")}
                    className="px-2.5 py-1 text-xs rounded-md border border-border hover:bg-secondary/40 transition-colors text-muted-foreground"
                  >
                    Cerrar
                  </button>
                )}
                {isOwner && selected.status === "open" && (
                  <button
                    onClick={() => updateStatus("in_progress")}
                    className="px-2.5 py-1 text-xs rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 transition-colors"
                  >
                    En progreso
                  </button>
                )}
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {selected.messages?.map((msg) => {
                const isMine = msg.author.id === user?.id;
                return (
                  <div key={msg.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[75%] rounded-xl px-4 py-2.5 ${isMine ? "bg-primary/10 text-foreground" : "bg-secondary/40 text-foreground"}`}>
                      <p className="text-xs text-muted-foreground mb-1">
                        {msg.author.displayName || msg.author.username}
                        {msg.isOwner && <span className="ml-1 text-primary">· Admin</span>}
                        <span className="ml-2">{new Date(msg.createdAt).toLocaleString("es", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" })}</span>
                      </p>
                      <p className="text-sm whitespace-pre-wrap">{msg.body}</p>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Reply box */}
            {selected.status !== "closed" ? (
              <div className="px-5 py-3 border-t border-border flex gap-2">
                <textarea
                  className="flex-1 px-3 py-2 rounded-lg bg-secondary/40 border border-border text-sm focus:outline-none focus:ring-1 focus:ring-ring resize-none"
                  placeholder="Escribe una respuesta..."
                  rows={2}
                  value={replyBody}
                  onChange={(e) => setReplyBody(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) sendReply(); }}
                />
                <button
                  onClick={sendReply}
                  disabled={sending || !replyBody.trim()}
                  className="px-3 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 self-end"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="px-5 py-3 border-t border-border text-center text-xs text-muted-foreground">
                Ticket cerrado
              </div>
            )}
          </div>
        ) : (
          <div className="hidden lg:flex flex-1 items-center justify-center bg-card border border-border rounded-xl">
            <div className="text-center">
              <MessageSquare className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-30" />
              <p className="text-sm text-muted-foreground">Selecciona un ticket</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
