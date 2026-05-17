"use client";
import { useEffect, useState } from "react";
import api from "@/lib/api";
import { Monitor, Smartphone, Globe, Trash2, ShieldCheck } from "lucide-react";

interface Session {
  id: number;
  ip: string | null;
  userAgent: string | null;
  lastSeenAt: string;
  createdAt: string;
  isCurrent: boolean;
}

function parseDevice(ua: string | null): { label: string; icon: React.ElementType } {
  if (!ua) return { label: "Dispositivo desconocido", icon: Globe };
  if (/mobile|android|iphone/i.test(ua)) return { label: "Móvil", icon: Smartphone };
  if (/windows|mac|linux/i.test(ua)) {
    const browser = ua.match(/(Chrome|Firefox|Safari|Edge|Opera)\/[\d.]+/)?.[1] || "Navegador";
    const os      = ua.match(/Windows NT|Mac OS X|Linux/)?.[0]?.replace(" NT", "").replace(" OS X", "") || "";
    return { label: `${browser}${os ? ` · ${os}` : ""}`, icon: Monitor };
  }
  return { label: "Navegador", icon: Monitor };
}

export default function SessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading]   = useState(true);
  const [revoking, setRevoking] = useState<number | "all" | null>(null);

  async function load() {
    try {
      const { data } = await api.get("/sessions");
      setSessions(data);
    } catch { /* noop */ }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function revoke(id: number) {
    setRevoking(id);
    try {
      await api.delete(`/sessions/${id}`);
      setSessions((prev) => prev.filter((s) => s.id !== id));
    } catch { /* noop */ }
    finally { setRevoking(null); }
  }

  async function revokeAll() {
    setRevoking("all");
    try {
      await api.delete("/sessions");
      setSessions((prev) => prev.filter((s) => s.isCurrent));
    } catch { /* noop */ }
    finally { setRevoking(null); }
  }

  const others = sessions.filter((s) => !s.isCurrent);

  if (loading) return <div className="text-muted-foreground text-sm">Cargando sesiones...</div>;

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Sesiones activas</h1>
          <p className="text-muted-foreground text-sm mt-1">{sessions.length} sesión{sessions.length !== 1 ? "es" : ""} activa{sessions.length !== 1 ? "s" : ""}</p>
        </div>
        {others.length > 0 && (
          <button
            onClick={revokeAll}
            disabled={revoking === "all"}
            className="px-3 py-2 text-sm rounded-lg border border-destructive/30 text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
          >
            Cerrar otras sesiones
          </button>
        )}
      </div>

      <div className="bg-card border border-border rounded-xl divide-y divide-border overflow-hidden">
        {sessions.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-muted-foreground">Sin sesiones activas</div>
        ) : (
          sessions.map((s) => {
            const { label, icon: Icon } = parseDevice(s.userAgent);
            return (
              <div key={s.id} className="flex items-center gap-4 px-5 py-4">
                <div className="w-9 h-9 rounded-lg bg-secondary/40 flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-foreground truncate">{label}</p>
                    {s.isCurrent && (
                      <span className="flex items-center gap-1 text-xs text-emerald-400 shrink-0">
                        <ShieldCheck className="w-3 h-3" />
                        Sesión actual
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {s.ip || "IP desconocida"} · Última actividad: {new Date(s.lastSeenAt).toLocaleString("es", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Iniciada: {new Date(s.createdAt).toLocaleString("es", { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                </div>
                {!s.isCurrent && (
                  <button
                    onClick={() => revoke(s.id)}
                    disabled={revoking === s.id}
                    className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
