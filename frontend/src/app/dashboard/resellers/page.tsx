"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import api from "@/lib/api";
import { toast } from "sonner";
import { UserPlus, ShieldOff, Shield, Trash2, Package, ChevronDown, ChevronRight, Key, Settings, Palette, CalendarClock, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import Badge from "@/components/Badge";
import { daysUntil, isAccentSafe } from "@/lib/utils";

interface Reseller {
  id: number; username: string; isBlocked: boolean; createdAt: string;
  availableKeys: number; usedKeys: number; maxClaimsDay: number | null; maxResetsDay: number | null;
  _count: { licenses: number };
  displayName?: string; panelName?: string; accentColor?: string; avatarUrl?: string;
  renewalDate?: string | null; renewalStatus?: string | null; renewalNote?: string | null;
}
interface StockItem {
  productId: number; duration: number; status: string; _count: { id: number };
  product: { id: number; name: string };
}
interface Product { id: number; name: string; }

export default function ResellersPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [resellers, setResellers] = useState<Reseller[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ username: "", password: "" });

  const [expanded, setExpanded] = useState<number | null>(null);
  const [stockMap, setStockMap] = useState<Record<number, StockItem[]>>({});
  const [assignForm, setAssignForm] = useState({ keys: "", productId: "", duration: "30" });
  const [assigning, setAssigning] = useState(false);

  // Modal límites
  const [limitsModal, setLimitsModal] = useState<Reseller | null>(null);
  const [limitsForm, setLimitsForm] = useState({ maxClaimsDay: "", maxResetsDay: "" });

  // Modal branding
  const [brandingModal, setBrandingModal] = useState<Reseller | null>(null);
  const [brandingForm, setBrandingForm] = useState({ displayName: "", panelName: "", accentColor: "", avatarUrl: "" });

  // Modal renovación
  const [renewalModal, setRenewalModal] = useState<Reseller | null>(null);
  const [renewalForm, setRenewalForm] = useState({ renewalDate: "", renewalStatus: "active", renewalNote: "" });
  const [renewalSaving, setRenewalSaving] = useState(false);

  useEffect(() => {
    if (user && user.role !== "owner") router.push("/dashboard");
  }, [user]);

  async function load() {
    try {
      const { data } = await api.get("/users");
      setResellers(data);
    } catch { toast.error("Error al cargar revendedores"); }
    finally { setLoading(false); }
  }

  async function saveBranding() {
    if (!brandingModal) return;
    const color = brandingForm.accentColor.trim();
    if (color && !/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(color)) {
      return toast.error("Color inválido. Usa formato hex: #RGB o #RRGGBB");
    }
    try {
      await api.patch(`/users/${brandingModal.id}/branding`, {
        displayName: brandingForm.displayName || null,
        panelName:   brandingForm.panelName   || null,
        accentColor: color                    || null,
        avatarUrl:   brandingForm.avatarUrl   || null,
      });
      toast.success("Branding actualizado");
      setBrandingModal(null);
      load();
    } catch (err: any) { toast.error(err.response?.data?.error || "Error al actualizar branding"); }
  }

  useEffect(() => { load(); }, []);
  useEffect(() => { api.get("/products").then((r) => setProducts(r.data)).catch(() => {}); }, []);

  async function loadStock(id: number) {
    try {
      const { data } = await api.get(`/users/${id}/stock`);
      setStockMap((prev) => ({ ...prev, [id]: data.stock }));
    } catch { toast.error("Error al cargar stock"); }
  }

  function toggleExpand(id: number) {
    if (expanded === id) { setExpanded(null); return; }
    setExpanded(id);
    setAssignForm({ keys: "", productId: "", duration: "30" });
    loadStock(id);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api.post("/users", form);
      toast.success("Revendedor creado");
      setShowCreate(false);
      setForm({ username: "", password: "" });
      load();
    } catch (err: any) { toast.error(err.response?.data?.error || "Error al crear"); }
  }

  async function handleAssign(resellerId: number) {
    const keys = assignForm.keys.split("\n").map((k) => k.trim()).filter(Boolean);
    if (!keys.length) return toast.error("Ingresa al menos una key");
    if (!assignForm.productId) return toast.error("Selecciona un producto");
    setAssigning(true);
    try {
      const { data } = await api.post("/licenses/import", {
        keys, productId: parseInt(assignForm.productId),
        duration: parseInt(assignForm.duration), resellerId,
      });
      toast.success(`${data.imported} keys asignadas. ${data.skipped} duplicadas omitidas.`);
      setAssignForm({ keys: "", productId: "", duration: "30" });
      loadStock(resellerId);
      load();
    } catch (err: any) { toast.error(err.response?.data?.error || "Error al asignar"); }
    finally { setAssigning(false); }
  }

  async function toggleBlock(id: number) {
    try {
      const { data } = await api.patch(`/users/${id}/block`);
      toast.success(data.isBlocked ? "Revendedor bloqueado" : "Revendedor desbloqueado");
      load();
    } catch { toast.error("Error al actualizar"); }
  }

  async function saveLimits() {
    if (!limitsModal) return;
    try {
      await api.patch(`/users/${limitsModal.id}/limits`, {
        maxClaimsDay: limitsForm.maxClaimsDay === "" ? null : parseInt(limitsForm.maxClaimsDay),
        maxResetsDay: limitsForm.maxResetsDay === "" ? null : parseInt(limitsForm.maxResetsDay),
      });
      toast.success("Límites actualizados");
      setLimitsModal(null);
      load();
    } catch { toast.error("Error al actualizar límites"); }
  }

  async function saveRenewal() {
    if (!renewalModal) return;
    setRenewalSaving(true);
    try {
      await api.patch(`/users/${renewalModal.id}/renewal`, {
        renewalDate:   renewalForm.renewalDate   ? new Date(renewalForm.renewalDate).toISOString() : null,
        renewalStatus: renewalForm.renewalStatus || "active",
        renewalNote:   renewalForm.renewalNote   || null,
      });
      toast.success("Renovación actualizada");
      setRenewalModal(null);
      load();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Error al guardar renovación");
    } finally { setRenewalSaving(false); }
  }

  async function deleteReseller(id: number, username: string) {
    if (!confirm(`¿Eliminar al revendedor "${username}"? Se eliminarán todas sus keys.`)) return;
    try { await api.delete(`/users/${id}`); toast.success("Revendedor eliminado"); load(); }
    catch { toast.error("Error al eliminar"); }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold">Revendedores</h1>
          <p className="text-muted-foreground text-sm mt-1">{resellers.length} revendedores registrados</p>
        </div>
        <button onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-colors shrink-0 whitespace-nowrap">
          <UserPlus className="w-4 h-4" /> <span className="hidden xs:inline">Nuevo </span>Revendedor
        </button>
      </div>

      {showCreate && (
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="font-semibold mb-4">Crear Revendedor</h2>
          <form onSubmit={handleCreate} className="flex flex-col sm:flex-row gap-3 sm:items-end">
            <div className="flex-1">
              <label className="text-sm text-muted-foreground block mb-1.5">Usuario</label>
              <input type="text" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })}
                className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="nombre_revendedor" required />
            </div>
            <div className="flex-1">
              <label className="text-sm text-muted-foreground block mb-1.5">Contraseña</label>
              <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="••••••••" required />
            </div>
            <div className="flex gap-2">
              <button type="submit" className="flex-1 sm:flex-none bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium transition-colors">Crear</button>
              <button type="button" onClick={() => setShowCreate(false)} className="flex-1 sm:flex-none bg-secondary hover:bg-accent text-foreground px-4 py-2 rounded-lg text-sm transition-colors">Cancelar</button>
            </div>
          </form>
        </div>
      )}

      <div className="space-y-3">
        {loading ? (
          <p className="text-muted-foreground text-sm">Cargando...</p>
        ) : resellers.length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-8 text-center text-muted-foreground text-sm">No hay revendedores</div>
        ) : (
          resellers.map((r) => (
            <div key={r.id} className="bg-card border border-border rounded-xl overflow-hidden">
              {/* Fila principal: flex-col mobile, flex-row sm+ */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 px-4 sm:px-5 py-4">

                {/* Toggle + info */}
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <button onClick={() => toggleExpand(r.id)} className="text-muted-foreground hover:text-foreground transition-colors shrink-0 mt-0.5">
                    {expanded === r.id ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-medium text-foreground truncate">{r.username}</span>
                      {r.isBlocked && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border bg-red-400/10 text-red-400 border-red-400/20 whitespace-nowrap">Bloqueado</span>
                      )}
                      {(r.maxClaimsDay !== null || r.maxResetsDay !== null) && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border bg-blue-400/10 text-blue-400 border-blue-400/20 whitespace-nowrap">Límites</span>
                      )}
                      {r.renewalStatus && r.renewalStatus !== "active" && (
                        <Badge value={r.renewalStatus} />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      Creado {new Date(r.createdAt).toLocaleDateString("es")}
                      {r.renewalDate && (
                        <span className="ml-1">
                          · Renov: {new Date(r.renewalDate).toLocaleDateString("es")}
                          {(() => { const d = daysUntil(r.renewalDate); return d !== null ? (
                            <span className={`ml-1 ${d < 0 ? "text-red-400" : d <= 3 ? "text-amber-400" : ""}`}>
                              ({d < 0 ? `venc. ${Math.abs(d)}d` : d === 0 ? "hoy" : `${d}d`})
                            </span>
                          ) : null; })()}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                {/* Stats sm+ */}
                <div className="hidden sm:flex items-center gap-4 lg:gap-6 text-sm shrink-0">
                  <div className="text-center">
                    <p className="font-semibold text-emerald-600 dark:text-emerald-400">{r.availableKeys}</p>
                    <p className="text-xs text-muted-foreground">Disp.</p>
                  </div>
                  <div className="text-center">
                    <p className="font-semibold text-foreground">{r.usedKeys}</p>
                    <p className="text-xs text-muted-foreground">Usadas</p>
                  </div>
                  <div className="text-center">
                    <p className="font-semibold text-muted-foreground">{r._count.licenses}</p>
                    <p className="text-xs text-muted-foreground">Total</p>
                  </div>
                </div>

                {/* Stats mobile inline */}
                <div className="flex sm:hidden items-center gap-3 text-xs pl-7">
                  <span className="text-emerald-400 font-medium">{r.availableKeys} disp.</span>
                  <span className="text-muted-foreground">{r.usedKeys} usadas</span>
                  <span className="text-muted-foreground">{r._count.licenses} total</span>
                </div>
                {/* Acciones: flex-wrap para evitar overflow */}
                <div className="flex items-center flex-wrap gap-1 pl-7 sm:pl-0 shrink-0">
                  <button onClick={() => toggleExpand(r.id)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0">
                    <Package className="w-3.5 h-3.5" /> Asignar
                  </button>
                  <button
                    onClick={() => { setBrandingModal(r); setBrandingForm({ displayName: r.displayName || "", panelName: r.panelName || "", accentColor: r.accentColor || "", avatarUrl: r.avatarUrl || "" }); }}
                    className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors" title="Branding">
                    <Palette className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => { setLimitsModal(r); setLimitsForm({ maxClaimsDay: r.maxClaimsDay?.toString() ?? "", maxResetsDay: r.maxResetsDay?.toString() ?? "" }); }}
                    className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors" title="Límites">
                    <Settings className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => {
                      setRenewalModal(r);
                      setRenewalForm({
                        renewalDate:   r.renewalDate ? new Date(r.renewalDate).toISOString().split("T")[0] : "",
                        renewalStatus: r.renewalStatus || "active",
                        renewalNote:   r.renewalNote  || "",
                      });
                    }}
                    className={`p-1.5 rounded-md hover:bg-accent transition-colors ${
                      r.renewalStatus === "overdue" ? "text-red-400" :
                      r.renewalStatus === "pending" ? "text-amber-400" :
                      "text-muted-foreground hover:text-foreground"
                    }`}
                    title="Renovación">
                    <CalendarClock className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => toggleBlock(r.id)}
                    className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-amber-400 transition-colors" title={r.isBlocked ? "Desbloquear" : "Bloquear"}>
                    {r.isBlocked ? <Shield className="w-3.5 h-3.5" /> : <ShieldOff className="w-3.5 h-3.5" />}
                  </button>
                  <button onClick={() => deleteReseller(r.id, r.username)}
                    className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-red-400 transition-colors" title="Eliminar">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {expanded === r.id && (
                <div className="border-t border-border bg-secondary/10 p-3 sm:p-5 space-y-5">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                    {/* Stock actual */}
                    <div>
                      <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                        <Key className="w-3.5 h-3.5 text-muted-foreground" /> Inventario actual
                      </h3>
                      {!stockMap[r.id] ? (
                        <p className="text-xs text-muted-foreground">Cargando...</p>
                      ) : stockMap[r.id].length === 0 ? (
                        <p className="text-xs text-muted-foreground">Sin inventario asignado</p>
                      ) : (
                        <div className="space-y-1.5">
                          {Object.entries(
                            stockMap[r.id].reduce((acc: any, item) => {
                              const k = `${item.productId}__${item.duration}`;
                              if (!acc[k]) acc[k] = { name: item.product?.name || item.productId, duration: item.duration, available: 0, used: 0, blocked: 0 };
                              acc[k][item.status === "available" ? "available" : item.status === "used" ? "used" : "blocked"] += item._count.id;
                              return acc;
                            }, {})
                          ).map(([k, item]: any) => (
                            <div key={k} className="flex flex-col xs:flex-row xs:items-center justify-between bg-card border border-border rounded-lg px-3 py-2 text-xs gap-1">
                              <span className="font-medium truncate min-w-0">{item.name} · {item.duration}d</span>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="text-emerald-600 dark:text-emerald-400">{item.available} disp.</span>
                                <span className="text-muted-foreground">{item.used} usadas</span>
                                {item.blocked > 0 && <span className="text-red-500 dark:text-red-400">{item.blocked} bloq.</span>}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Formulario asignación */}
                    <div>
                      <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                        <Package className="w-3.5 h-3.5 text-muted-foreground" /> Asignar nuevo lote
                      </h3>
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-xs text-muted-foreground block mb-1">Producto</label>
                            <select value={assignForm.productId} onChange={(e) => setAssignForm({ ...assignForm, productId: e.target.value })}
                              className="w-full bg-input border border-border rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring">
                              <option value="">Seleccionar...</option>
                              {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground block mb-1">Duración</label>
                            <select value={assignForm.duration} onChange={(e) => setAssignForm({ ...assignForm, duration: e.target.value })}
                              className="w-full bg-input border border-border rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring">
                              <option value="1">1 día</option>
                              <option value="5">5 días</option>
                              <option value="15">15 días</option>
                              <option value="30">30 días</option>
                            </select>
                          </div>
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground block mb-1">Keys (una por línea)</label>
                          <textarea value={assignForm.keys} onChange={(e) => setAssignForm({ ...assignForm, keys: e.target.value })}
                            className="w-full bg-input border border-border rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-ring h-24 resize-none"
                            placeholder={"AAAA-BBBB-CCCC\nDDDD-EEEE-FFFF"} />
                        </div>
                        <button onClick={() => handleAssign(r.id)} disabled={assigning}
                          className="w-full bg-primary hover:bg-primary/90 text-primary-foreground py-2 rounded-lg text-xs font-medium transition-colors disabled:opacity-50">
                          {assigning ? "Asignando..." : "Asignar lote"}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Modal branding */}
      {brandingModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-xl p-6 w-full max-w-md space-y-5">
            <div>
              <h2 className="font-semibold">Configurar branding</h2>
              <p className="text-xs text-muted-foreground mt-0.5">{brandingModal.username}</p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-sm text-muted-foreground block mb-1.5">Nombre visible</label>
                <input type="text" value={brandingForm.displayName}
                  onChange={(e) => setBrandingForm({ ...brandingForm, displayName: e.target.value })}
                  className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder={brandingModal.username} />
              </div>
              <div>
                <label className="text-sm text-muted-foreground block mb-1.5">Nombre del panel</label>
                <input type="text" value={brandingForm.panelName}
                  onChange={(e) => setBrandingForm({ ...brandingForm, panelName: e.target.value })}
                  className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Mi Panel" />
              </div>
              <div>
                <label className="text-sm text-muted-foreground block mb-1.5">Color de acento</label>
                <div className="flex items-center gap-3">
                  <input type="color"
                    value={brandingForm.accentColor || "#6366f1"}
                    onChange={(e) => setBrandingForm({ ...brandingForm, accentColor: e.target.value })}
                    className="w-9 h-9 rounded-lg border border-border cursor-pointer bg-input p-0.5" />
                  <input type="text" value={brandingForm.accentColor}
                    onChange={(e) => setBrandingForm({ ...brandingForm, accentColor: e.target.value })}
                    className="flex-1 bg-input border border-border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="#6366f1" />
                  {brandingForm.accentColor && (
                    <button onClick={() => setBrandingForm({ ...brandingForm, accentColor: "" })}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors">Limpiar</button>
                  )}
                </div>
              </div>
              <div>
                <label className="text-sm text-muted-foreground block mb-1.5">URL de avatar</label>
                <input type="url" value={brandingForm.avatarUrl}
                  onChange={(e) => setBrandingForm({ ...brandingForm, avatarUrl: e.target.value })}
                  className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="https://..." />
              </div>
            </div>

            {/* Preview mejorado */}
            {(brandingForm.accentColor || brandingForm.panelName || brandingForm.displayName || brandingForm.avatarUrl) && (() => {
              const c = brandingForm.accentColor;
              const safe = c ? isAccentSafe(c) : false;
              return (
                <div className="rounded-lg border border-border bg-secondary/20 overflow-hidden">
                  <p className="text-xs text-muted-foreground px-3 pt-3 pb-2">Vista previa del panel</p>
                  {/* Mini sidebar */}
                  <div className="flex gap-0 border-t border-border">
                    <div className="w-32 bg-card border-r p-2 space-y-1"
                      style={safe ? { borderColor: `${c}30` } : undefined}>
                      <div className="flex items-center gap-1.5 px-2 py-1.5 mb-2">
                        {brandingForm.avatarUrl ? (
                          <img src={brandingForm.avatarUrl} alt="" className="w-5 h-5 rounded object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                        ) : (
                          <div className="w-5 h-5 rounded flex items-center justify-center text-[9px] font-bold border"
                            style={safe ? { background: `${c}18`, borderColor: `${c}35`, color: c } : undefined}>
                            {(brandingForm.displayName || brandingModal!.username).charAt(0).toUpperCase()}
                          </div>
                        )}
                        <span className="text-[10px] font-semibold truncate">
                          {brandingForm.panelName || brandingModal!.username}
                        </span>
                      </div>
                      {["Dashboard", "Mis Keys", "Solicitudes"].map((item, i) => (
                        <div
                          key={item}
                          className={`flex items-center gap-1.5 px-2 py-1 rounded text-[10px] ${i !== 0 ? "text-muted-foreground" : ""}`}
                          style={i === 0 && safe ? { background: `${c}15`, color: c } : undefined}
                        >
                          <div className="w-2.5 h-2.5 rounded-sm bg-current opacity-40" />
                          {item}
                        </div>
                      ))}
                    </div>
                    {/* Mini content */}
                    <div className="flex-1 p-3 space-y-2">
                      <div className="h-2 rounded bg-foreground/10 w-24" />
                      <div className="grid grid-cols-2 gap-1.5">
                        {[0,1].map((i) => (
                          <div key={i} className="rounded border p-2 space-y-1"
                            style={safe ? { borderColor: `${c}20` } : undefined}>
                            <div className="h-1.5 rounded bg-foreground/10 w-10" />
                            <div className="text-[11px] font-bold" style={safe ? { color: c } : undefined}>—</div>
                          </div>
                        ))}
                      </div>
                      <div className="h-6 rounded text-[10px] font-medium flex items-center justify-center"
                        style={safe ? { background: `${c}18`, color: c, border: `1px solid ${c}30` } : { background: "hsl(var(--primary)/0.1)", color: "hsl(var(--primary))" }}>
                        Botón principal
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

            <div className="flex gap-2">
              <button onClick={saveBranding} className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground py-2 rounded-lg text-sm font-medium transition-colors">Guardar</button>
              <button onClick={() => setBrandingModal(null)} className="flex-1 bg-secondary hover:bg-accent text-foreground py-2 rounded-lg text-sm transition-colors">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal límites */}
      {limitsModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-xl p-6 w-full max-w-sm space-y-4">
            <div>
              <h2 className="font-semibold">Límites diarios</h2>
              <p className="text-xs text-muted-foreground mt-0.5">{limitsModal.username} — dejar vacío = sin límite</p>
            </div>
            <div>
              <label className="text-sm text-muted-foreground block mb-1.5">Máx. claims por día</label>
              <input type="number" min="0" value={limitsForm.maxClaimsDay}
                onChange={(e) => setLimitsForm({ ...limitsForm, maxClaimsDay: e.target.value })}
                className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="Sin límite" />
            </div>
            <div>
              <label className="text-sm text-muted-foreground block mb-1.5">Máx. resets por día</label>
              <input type="number" min="0" value={limitsForm.maxResetsDay}
                onChange={(e) => setLimitsForm({ ...limitsForm, maxResetsDay: e.target.value })}
                className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="Sin límite" />
            </div>
            <div className="flex gap-2">
              <button onClick={saveLimits} className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground py-2 rounded-lg text-sm font-medium transition-colors">Guardar</button>
              <button onClick={() => setLimitsModal(null)} className="flex-1 bg-secondary hover:bg-accent text-foreground py-2 rounded-lg text-sm transition-colors">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal renovación */}
      {renewalModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-xl p-6 w-full max-w-sm space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="font-semibold">Renovación</h2>
                <p className="text-xs text-muted-foreground mt-0.5">{renewalModal.displayName || renewalModal.username}</p>
              </div>
              <CalendarClock className="w-4 h-4 text-muted-foreground mt-0.5" />
            </div>

            <div>
              <label className="text-sm text-muted-foreground block mb-1.5">Fecha de renovación</label>
              <input
                type="date"
                value={renewalForm.renewalDate}
                onChange={(e) => setRenewalForm({ ...renewalForm, renewalDate: e.target.value })}
                className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div>
              <label className="text-sm text-muted-foreground block mb-1.5">Estado</label>
              <div className="grid grid-cols-3 gap-2">
                {(["active", "pending", "overdue"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setRenewalForm({ ...renewalForm, renewalStatus: s })}
                    className={`py-2 rounded-lg text-xs font-medium border transition-colors ${
                      renewalForm.renewalStatus === s
                        ? s === "active"  ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                        : s === "pending" ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
                        :                  "bg-red-500/15 text-red-400 border-red-500/30"
                        : "bg-secondary/30 text-muted-foreground border-border hover:bg-accent"
                    }`}
                  >
                    {s === "active" ? "Activo" : s === "pending" ? "Pendiente" : "Vencido"}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm text-muted-foreground block mb-1.5">Nota interna (opcional)</label>
              <input
                type="text"
                value={renewalForm.renewalNote}
                onChange={(e) => setRenewalForm({ ...renewalForm, renewalNote: e.target.value })}
                className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="Ej: Pago recibido por transferencia"
              />
            </div>

            {/* Acción rápida: marcar renovado */}
            {renewalModal.renewalStatus !== "active" && (
              <button
                onClick={() => {
                  const nextMonth = new Date();
                  nextMonth.setMonth(nextMonth.getMonth() + 1);
                  setRenewalForm({
                    renewalDate:   nextMonth.toISOString().split("T")[0],
                    renewalStatus: "active",
                    renewalNote:   renewalForm.renewalNote,
                  });
                }}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium border border-emerald-500/20 bg-emerald-500/8 text-emerald-400 hover:bg-emerald-500/15 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Marcar como renovado (+1 mes)
              </button>
            )}

            <div className="flex gap-2">
              <button onClick={saveRenewal} disabled={renewalSaving}
                className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
                Guardar
              </button>
              <button onClick={() => setRenewalModal(null)}
                className="flex-1 bg-secondary hover:bg-accent text-foreground py-2 rounded-lg text-sm transition-colors">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
