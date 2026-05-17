"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import Badge from "@/components/Badge";
import { TableSkeleton } from "@/components/Skeleton";
import api from "@/lib/api";
import { toast } from "sonner";
import EmptyState from "@/components/EmptyState";
import { useSocket } from "@/hooks/useSocket";
import {
  Copy, Upload, Ban, Trash2, ChevronDown, User, MessageSquare,
  RefreshCw, ShieldOff, ShieldCheck, Clock, Send, Search,
  ChevronLeft, ChevronRight, Star, LayoutGrid, List, Key, Download,
  CheckSquare, Square, Loader2,
} from "lucide-react";

interface Product { id: number; name: string; slug: string; }
interface License {
  id: number; key: string; duration: number; status: string;
  createdAt: string; claimedAt: string | null; expiresAt: string | null;
  assignedUser: string | null; notes: string | null; isDeleted: boolean;
  reseller: { id: number; username: string } | null;
  product: { id: number; name: string; slug: string };
  // Campos privados del revendedor
  resellerPrivateStatus: string | null;
  clientAlias: string | null;
  favorite: boolean;
}

const PRIVATE_STATUSES = [
  { value: "nueva",          label: "Nueva" },
  { value: "entregada",      label: "Entregada" },
  { value: "asignada",       label: "Asignada" },
  { value: "pendiente_pago", label: "Pend. Pago" },
  { value: "vip",            label: "VIP" },
  { value: "archivada",      label: "Archivada" },
];

const REQUEST_TYPES = [
  { value: "reset_hwid", label: "Reset HWID",         icon: RefreshCw },
  { value: "ban",        label: "Suspender usuario",   icon: ShieldOff },
  { value: "unban",      label: "Reactivar usuario",   icon: ShieldCheck },
  { value: "delete",     label: "Eliminar key",        icon: Trash2 },
  { value: "extend",     label: "Extensión de tiempo", icon: Clock },
];

export default function LicensesPage() {
  const { user } = useAuth();
  const isReseller = user?.role === "reseller";
  const accent = user?.accentColor;

  const [licenses, setLicenses]     = useState<License[]>([]);
  const [products, setProducts]     = useState<Product[]>([]);
  const [resellers, setResellers]   = useState<{ id: number; username: string }[]>([]);
  const [loading, setLoading]       = useState(true);
  const [total, setTotal]           = useState(0);
  const [page, setPage]             = useState(1);
  const [pages, setPages]           = useState(1);
  const LIMIT = 20;

  const [filterStatus, setFilterStatus]   = useState(() =>
    typeof window !== "undefined" ? localStorage.getItem("lic_filterStatus") || "" : ""
  );
  const [filterProduct, setFilterProduct] = useState(() =>
    typeof window !== "undefined" ? localStorage.getItem("lic_filterProduct") || "" : ""
  );
  const [filterPrivate, setFilterPrivate] = useState("");
  const [searchInput, setSearchInput]     = useState("");
  const [search, setSearch]               = useState("");
  const [showFavOnly, setShowFavOnly]     = useState(false);
  const [viewMode, setViewMode]           = useState<"table" | "grid">(() =>
    typeof window !== "undefined" ? (localStorage.getItem("lic_viewMode") as "table" | "grid") || "table" : "table"
  );

  const [showImport, setShowImport] = useState(false);
  const [importForm, setImportForm] = useState({ keys: "", productId: "", duration: "30", resellerId: "" });

  const [metaModal, setMetaModal]       = useState<License | null>(null);
  const [metaForm, setMetaForm]         = useState({ assignedUser: "", notes: "", clientAlias: "", resellerPrivateStatus: "" });
  const [requestModal, setRequestModal] = useState<License | null>(null);
  const [requestForm, setRequestForm]   = useState({ type: "reset_hwid", comment: "" });
  const [submitting, setSubmitting]     = useState(false);
  const [selected, setSelected]             = useState<Set<number>>(new Set());
  const [selectMode, setSelectMode]         = useState(false);
  const [selectingIds, setSelectingIds]     = useState(false); // loading state for remote ID fetch
  const [selectDropdown, setSelectDropdown] = useState(false);
  const [bulkDeleteModal, setBulkDeleteModal] = useState(false);

  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const { on } = useSocket(token);

  // Tracks the last query string sent to the backend — prevents duplicate fetches
  const lastQueryRef = useRef<string>("");
  // Holds the active AbortController so manual reloads can cancel in-flight search requests
  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    if (!user) return;

    // Build a stable query key from all active filters
    const queryKey = JSON.stringify({ page, filterStatus, filterProduct, search, showFavOnly, filterPrivate });
    if (signal === undefined && queryKey === lastQueryRef.current) return; // deduplicate manual reloads
    lastQueryRef.current = queryKey;

    setLoading(true);
    try {
      const params: any = { page, limit: LIMIT };
      if (isReseller) params.status = filterStatus || "used";
      else if (filterStatus) params.status = filterStatus;
      if (filterProduct) params.product = filterProduct;
      if (search) params.search = search;
      const { data } = await api.get("/licenses", { params, signal });
      let list: License[] = data.licenses;
      if (showFavOnly) list = list.filter((l) => l.favorite);
      if (filterPrivate) list = list.filter((l) => l.resellerPrivateStatus === filterPrivate);
      setLicenses(list);
      setTotal(data.total);
      setPages(data.pages);
    } catch (err: any) {
      if (err?.code === "ERR_CANCELED" || err?.name === "CanceledError") return;
      toast.error("Error al cargar licencias");
    } finally {
      setLoading(false);
    }
  }, [user, page, filterStatus, filterProduct, search, showFavOnly, filterPrivate]);

  // Sole trigger for automatic fetches — creates and tracks the AbortController
  useEffect(() => {
    const controller = new AbortController();
    abortRef.current = controller;
    load(controller.signal);
    return () => { controller.abort(); abortRef.current = null; };
  }, [load]);

  // Debounce search — 300ms, cancels previous timeout on each keystroke
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Realtime: remove deleted license from state immediately
  useEffect(() => {
    const off = on<{ id: number }>("license:deleted", ({ id }) => {
      setLicenses((prev) => prev.filter((l) => l.id !== id));
      setTotal((prev) => Math.max(0, prev - 1));
    });
    return off;
  }, [on]);

  // Realtime: bulk delete
  useEffect(() => {
    const off = on<{ ids: number[] }>("license:bulk_deleted", ({ ids }) => {
      const removed = new Set(ids);
      setLicenses((prev) => prev.filter((l) => !removed.has(l.id)));
      setTotal((prev) => Math.max(0, prev - ids.length));
      setSelected(new Set());
    });
    return off;
  }, [on]);

  useEffect(() => {
    api.get("/products").then((r) => setProducts(r.data)).catch(() => {});
    if (user?.role === "owner") api.get("/users").then((r) => setResellers(r.data)).catch(() => {});
  }, [user]);
  useEffect(() => { setPage(1); }, [filterStatus, filterProduct, search, showFavOnly, filterPrivate]);

  // Persist filters
  useEffect(() => { localStorage.setItem("lic_filterStatus",  filterStatus);  }, [filterStatus]);
  useEffect(() => { localStorage.setItem("lic_filterProduct", filterProduct); }, [filterProduct]);
  useEffect(() => { localStorage.setItem("lic_viewMode",      viewMode);      }, [viewMode]);

  // Manual reload: cancels any in-flight request first, then resets dedup key so it always runs
  function reload() {
    abortRef.current?.abort();
    lastQueryRef.current = "";
    const controller = new AbortController();
    abortRef.current = controller;
    load(controller.signal);
  }

  // ── Bulk selection helpers ────────────────────────────────────────────────

  function selectPage() {
    setSelected(new Set(licenses.map((l) => l.id)));
    setSelectDropdown(false);
  }

  async function fetchIds(extraParams?: Record<string, string>) {
    setSelectingIds(true);
    try {
      const params: any = {};
      if (filterProduct) params.product = filterProduct;
      if (search)        params.search  = search;
      if (extraParams)   Object.assign(params, extraParams);
      // reseller ownership is enforced server-side
      const { data } = await api.get("/licenses/ids", { params });
      return data.ids as number[];
    } catch {
      toast.error("Error al obtener selección");
      return [];
    } finally {
      setSelectingIds(false);
    }
  }

  async function selectAllFiltered() {
    setSelectDropdown(false);
    const params: any = {};
    if (isReseller) params.status = filterStatus || "used";
    else if (filterStatus) params.status = filterStatus;
    const ids = await fetchIds(params);
    if (ids.length) setSelected(new Set(ids));
  }

  // Owner only — selects everything in the system (no filter)
  async function selectAllSystem() {
    setSelectDropdown(false);
    const ids = await fetchIds();
    if (ids.length) setSelected(new Set(ids));
  }

  async function selectByStatus(status: string) {
    setSelectDropdown(false);
    const ids = await fetchIds({ status });
    if (ids.length) setSelected(new Set(ids));
  }

  function clearSelection() {
    setSelected(new Set());
    setSelectMode(false);
    setSelectDropdown(false);
  }

  // ── Bulk delete ──────────────────────────────────────────────────────────

  async function handleBulkDelete() {
    const ids = Array.from(selected);
    // Optimistic update
    const removed = new Set(ids);
    setLicenses((prev) => prev.filter((l) => !removed.has(l.id)));
    setTotal((prev) => Math.max(0, prev - ids.length));
    setSelected(new Set());
    setSelectMode(false);
    setBulkDeleteModal(false);
    try {
      await api.post("/licenses/bulk-delete", { ids });
      toast.success(`${ids.length} key${ids.length !== 1 ? "s" : ""} eliminada${ids.length !== 1 ? "s" : ""}`);
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Error al eliminar");
      reload(); // Revert optimistic update on failure
    }
  }

  async function handleImport(e: React.FormEvent) {
    e.preventDefault();
    const keys = importForm.keys.split("\n").map((k) => k.trim()).filter(Boolean);
    if (!keys.length) return toast.error("Ingresa al menos una key");
    try {
      const { data } = await api.post("/licenses/import", {
        keys, productId: parseInt(importForm.productId),
        duration: parseInt(importForm.duration),
        resellerId: parseInt(importForm.resellerId),
      });
      toast.success(`${data.imported} keys asignadas. ${data.skipped} duplicadas omitidas.`);
      setShowImport(false);
      setImportForm({ keys: "", productId: "", duration: "30", resellerId: "" });
      reload();
    } catch (err: any) { toast.error(err.response?.data?.error || "Error al importar"); }
  }

  async function toggleBlock(id: number) {
    try { await api.patch(`/licenses/${id}/block`); toast.success("Estado actualizado"); reload(); }
    catch { toast.error("Error al actualizar"); }
  }

  async function softDelete(id: number) {
    if (!confirm("¿Eliminar esta key?")) return;
    try { await api.delete(`/licenses/${id}`); toast.success("Key eliminada"); reload(); }
    catch { toast.error("Error al eliminar"); }
  }

  async function toggleFavorite(lic: License) {
    try {
      await api.patch(`/licenses/${lic.id}/private`, { favorite: !lic.favorite });
      reload();
    } catch { toast.error("Error al actualizar favorito"); }
  }

  async function savePrivateStatus(id: number, resellerPrivateStatus: string) {
    try {
      await api.patch(`/licenses/${id}/private`, { resellerPrivateStatus: resellerPrivateStatus || null });
      reload();
    } catch { toast.error("Error al actualizar estado"); }
  }

  function copyKey(key: string) { navigator.clipboard.writeText(key); toast.success("Key copiada"); }

  function toggleSelect(id: number) {
    setSelected((prev) => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  }

  function copySelected() {
    const keys = licenses.filter((l) => selected.has(l.id)).map((l) => l.key).join("\n");
    navigator.clipboard.writeText(keys);
    toast.success(`${selected.size} key${selected.size !== 1 ? "s" : ""} copiada${selected.size !== 1 ? "s" : ""}`);
    setSelected(new Set());
    setSelectMode(false);
  }

  function exportMyCSV() {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    const url   = `${process.env.NEXT_PUBLIC_API_URL}/backup/my-licenses.csv`;
    const a     = document.createElement("a");
    a.href      = url;
    // Pass token via fetch + blob to respect auth header
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.blob())
      .then((blob) => {
        a.href     = URL.createObjectURL(blob);
        a.download = `mis-keys-${new Date().toISOString().slice(0,10)}.csv`;
        a.click();
        URL.revokeObjectURL(a.href);
      })
      .catch(() => toast.error("Error al exportar"));
  }

  function openMetaModal(lic: License) {
    setMetaModal(lic);
    setMetaForm({
      assignedUser: lic.assignedUser || "",
      notes: lic.notes || "",
      clientAlias: lic.clientAlias || "",
      resellerPrivateStatus: lic.resellerPrivateStatus || "",
    });
  }

  async function saveMeta() {
    if (!metaModal) return;
    setSubmitting(true);
    try {
      await api.patch(`/requests/license/${metaModal.id}/meta`, {
        assignedUser: metaForm.assignedUser,
        notes: metaForm.notes,
      });
      await api.patch(`/licenses/${metaModal.id}/private`, {
        clientAlias: metaForm.clientAlias || null,
        resellerPrivateStatus: metaForm.resellerPrivateStatus || null,
      });
      toast.success("Información actualizada");
      setMetaModal(null);
      reload();
    } catch { toast.error("Error al guardar"); }
    finally { setSubmitting(false); }
  }

  async function submitRequest() {
    if (!requestModal) return;
    setSubmitting(true);
    try {
      await api.post("/requests", { licenseId: requestModal.id, type: requestForm.type, comment: requestForm.comment || undefined });
      toast.success("Solicitud enviada.");
      setRequestModal(null);
      setRequestForm({ type: "reset_hwid", comment: "" });
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Error al enviar solicitud");
    } finally { setSubmitting(false); }
  }

  const isExpired = (lic: License) => lic.expiresAt && new Date(lic.expiresAt) < new Date();
  const isExpiringSoon = (lic: License) => {
    if (!lic.expiresAt) return false;
    const diff = new Date(lic.expiresAt).getTime() - Date.now();
    return diff > 0 && diff < 3 * 24 * 60 * 60 * 1000;
  };

  return (
    <div className="space-y-4 page-content">
      <div className="page-header">
        <div className="min-w-0">
          <h1 className="page-title">{isReseller ? "Mis Keys" : "Licencias"}</h1>
          <p className="page-subtitle">{total} {isReseller ? "keys entregadas" : "licencias"}</p>
        </div>
        <div className="action-row">
          {isReseller && (
            <>
              <button onClick={() => setViewMode("table")}
                className={`p-2 rounded-lg transition-colors ${viewMode === "table" ? "bg-primary/10 text-primary" : "hover:bg-accent text-muted-foreground"}`}>
                <List className="w-4 h-4" />
              </button>
              <button onClick={() => setViewMode("grid")}
                className={`p-2 rounded-lg transition-colors ${viewMode === "grid" ? "bg-primary/10 text-primary" : "hover:bg-accent text-muted-foreground"}`}>
                <LayoutGrid className="w-4 h-4" />
              </button>
            </>
          )}
          {isReseller && (
            <>
              {selectMode ? (
                <>
                  <button onClick={copySelected} disabled={selected.size === 0}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50">
                    <Copy className="w-4 h-4" /> Copiar ({selected.size})
                  </button>
                  <button onClick={() => { setSelectMode(false); setSelected(new Set()); }}
                    className="px-3 py-2 rounded-lg border border-border text-sm hover:bg-secondary/40 transition-colors">
                    Cancelar
                  </button>
                </>
              ) : (
                <>
                  <button onClick={() => setSelectMode(true)}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/40 transition-colors">
                    <CheckSquare className="w-4 h-4" /> Seleccionar
                  </button>
                  <button onClick={exportMyCSV}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/40 transition-colors">
                    <Download className="w-4 h-4" /> Exportar CSV
                  </button>
                </>
              )}
            </>
          )}
          {user?.role === "owner" && (
            <>
              {selectMode ? (
                <div className="flex items-center gap-2">
                  {/* Selection counter */}
                  <span className="text-xs text-muted-foreground px-2">
                    {selectingIds
                      ? <span className="flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Seleccionando...</span>
                      : <>{selected.size} seleccionada{selected.size !== 1 ? "s" : ""}</>}
                  </span>

                  {/* Dropdown de selección masiva */}
                  <div className="relative">
                    <button
                      onClick={() => setSelectDropdown((o) => !o)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/40 transition-colors">
                      <CheckSquare className="w-4 h-4" />
                      Seleccionar
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                    {selectDropdown && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setSelectDropdown(false)} />
                        <div className="absolute right-0 top-full mt-1 w-56 bg-card border border-border rounded-xl shadow-lg z-20 py-1 text-sm">
                        <button onClick={selectPage}
                          className="w-full text-left px-4 py-2 hover:bg-accent transition-colors">
                          Página actual
                          <span className="ml-1 text-xs text-muted-foreground">({licenses.length})</span>
                        </button>
                        <button onClick={selectAllFiltered}
                          className="w-full text-left px-4 py-2 hover:bg-accent transition-colors">
                          Todos los filtrados
                          <span className="ml-1 text-xs text-muted-foreground">({total})</span>
                        </button>
                        {!isReseller && (
                          <button onClick={selectAllSystem}
                            className="w-full text-left px-4 py-2 hover:bg-accent transition-colors">
                            Todo el sistema
                          </button>
                        )}
                        <div className="border-t border-border my-1" />
                        <p className="px-4 py-1 text-xs text-muted-foreground">Por estado</p>
                        {["available","used","blocked","expired"].map((s) => (
                          <button key={s} onClick={() => selectByStatus(s)}
                            className="w-full text-left px-4 py-2 hover:bg-accent transition-colors capitalize">
                            {s === "available" ? "Disponibles" : s === "used" ? "Usadas" : s === "blocked" ? "Bloqueadas" : "Expiradas"}
                          </button>
                        ))}
                        <div className="border-t border-border my-1" />
                        <button onClick={clearSelection}
                          className="w-full text-left px-4 py-2 hover:bg-accent text-muted-foreground transition-colors">
                          Deseleccionar todo
                        </button>
                        </div>
                      </>
                    )}
                  </div>

                  <button
                    onClick={() => setBulkDeleteModal(true)}
                    disabled={selected.size === 0 || selectingIds}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-destructive/90 hover:bg-destructive text-white text-sm font-medium transition-colors disabled:opacity-50">
                    <Trash2 className="w-4 h-4" /> Eliminar ({selected.size})
                  </button>
                  <button onClick={clearSelection}
                    className="px-3 py-2 rounded-lg border border-border text-sm hover:bg-secondary/40 transition-colors">
                    Cancelar
                  </button>
                </div>
              ) : (
                <button onClick={() => setSelectMode(true)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/40 transition-colors">
                  <CheckSquare className="w-4 h-4" /> Seleccionar
                </button>
              )}
              <button onClick={() => setShowImport(!showImport)}
                className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                <Upload className="w-4 h-4" /> Asignar Keys
              </button>
            </>
          )}
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground pointer-events-none" />
          <input type="text" value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={isReseller ? "Buscar key, cliente..." : "Buscar key, cliente o usuario asignado"}
            className="w-full bg-card border border-border rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>

        <div className="relative">
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
            className="appearance-none bg-card border border-border rounded-lg px-3 py-2 text-sm pr-8 focus:outline-none focus:ring-2 focus:ring-ring">
            {isReseller ? (
              <><option value="">Usadas</option><option value="blocked">Bloqueadas</option><option value="expired">Expiradas</option></>
            ) : (
              <><option value="">Todos los estados</option><option value="available">Disponibles</option><option value="used">Usadas</option><option value="blocked">Bloqueadas</option><option value="expired">Expiradas</option></>
            )}
          </select>
          <ChevronDown className="absolute right-2 top-2.5 w-4 h-4 text-muted-foreground pointer-events-none" />
        </div>

        <div className="relative">
          <select value={filterProduct} onChange={(e) => setFilterProduct(e.target.value)}
            className="appearance-none bg-card border border-border rounded-lg px-3 py-2 text-sm pr-8 focus:outline-none focus:ring-2 focus:ring-ring">
            <option value="">Todos los productos</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <ChevronDown className="absolute right-2 top-2.5 w-4 h-4 text-muted-foreground pointer-events-none" />
        </div>

        {isReseller && (
          <>
            <div className="relative">
              <select value={filterPrivate} onChange={(e) => setFilterPrivate(e.target.value)}
                className="appearance-none bg-card border border-border rounded-lg px-3 py-2 text-sm pr-8 focus:outline-none focus:ring-2 focus:ring-ring">
                <option value="">Todos los estados</option>
                {PRIVATE_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
              <ChevronDown className="absolute right-2 top-2.5 w-4 h-4 text-muted-foreground pointer-events-none" />
            </div>
            <button onClick={() => setShowFavOnly(!showFavOnly)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm transition-colors border ${showFavOnly ? "bg-yellow-400/10 text-yellow-400 border-yellow-400/20" : "bg-card border-border text-muted-foreground hover:text-foreground"}`}>
              <Star className="w-3.5 h-3.5" /> Favoritos
            </button>
          </>
        )}

        <button onClick={reload} className="p-2 rounded-lg hover:bg-accent text-muted-foreground transition-colors">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Import form */}
      {showImport && user?.role === "owner" && (
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="font-semibold mb-4">Asignar Keys a Revendedor</h2>
          <form onSubmit={handleImport} className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="text-xs text-muted-foreground block mb-1.5">Revendedor</label>
                <select value={importForm.resellerId} onChange={(e) => setImportForm({ ...importForm, resellerId: e.target.value })}
                  className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" required>
                  <option value="">Seleccionar...</option>
                  {resellers.map((r) => <option key={r.id} value={r.id}>{r.username}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1.5">Producto</label>
                <select value={importForm.productId} onChange={(e) => setImportForm({ ...importForm, productId: e.target.value })}
                  className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" required>
                  <option value="">Seleccionar...</option>
                  {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1.5">Duración</label>
                <select value={importForm.duration} onChange={(e) => setImportForm({ ...importForm, duration: e.target.value })}
                  className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                  <option value="1">1 día</option><option value="5">5 días</option>
                  <option value="15">15 días</option><option value="30">30 días</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1.5">Keys (una por línea)</label>
              <textarea value={importForm.keys} onChange={(e) => setImportForm({ ...importForm, keys: e.target.value })}
                className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring h-28 resize-none"
                placeholder={"AAAA-BBBB-CCCC\nDDDD-EEEE-FFFF"} required />
            </div>
            <div className="flex gap-2">
              <button type="submit" className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium transition-colors">Asignar</button>
              <button type="button" onClick={() => setShowImport(false)} className="bg-secondary hover:bg-accent text-foreground px-4 py-2 rounded-lg text-sm transition-colors">Cancelar</button>
            </div>
          </form>
        </div>
      )}

      {/* Vista GRID (solo reseller) */}
      {isReseller && viewMode === "grid" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {loading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-card border border-border rounded-xl p-4 space-y-3 animate-pulse">
                <div className="h-3 bg-secondary rounded w-3/4" />
                <div className="h-3 bg-secondary rounded w-1/2" />
                <div className="h-3 bg-secondary rounded w-1/3" />
              </div>
            ))
          ) : licenses.length === 0 ? (
            <div className="col-span-full"><EmptyState icon={Key} title="Sin keys" description="No hay keys que coincidan con los filtros." /></div>
          ) : licenses.map((lic) => (
            <div key={lic.id} className={`bg-card border rounded-xl p-4 space-y-3 transition-colors hover:border-border/80 ${
              isExpired(lic) ? "border-red-500/20 bg-red-500/5" : isExpiringSoon(lic) ? "border-amber-500/20" : "border-border"
            } ${selectMode && selected.has(lic.id) ? "ring-1 ring-primary" : ""}`}>
              <div className="flex items-start justify-between gap-2">
                {selectMode && (
                  <button onClick={() => toggleSelect(lic.id)} className="shrink-0 text-muted-foreground hover:text-primary transition-colors">
                    {selected.has(lic.id) ? <CheckSquare className="w-4 h-4 text-primary" /> : <Square className="w-4 h-4" />}
                  </button>
                )}
                <p className="font-mono text-xs text-foreground truncate flex-1">{lic.key}</p>
                <button onClick={() => toggleFavorite(lic)} className={`shrink-0 transition-colors ${lic.favorite ? "text-yellow-400" : "text-muted-foreground hover:text-yellow-400"}`}>
                  <Star className="w-3.5 h-3.5" fill={lic.favorite ? "currentColor" : "none"} />
                </button>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge value={lic.status} />
                {lic.resellerPrivateStatus && <Badge value={lic.resellerPrivateStatus} />}
              </div>
              <div className="text-xs text-muted-foreground space-y-1">
                <p>{lic.product?.name} · {lic.duration}d</p>
                {lic.clientAlias && <p className="text-foreground font-medium">{lic.clientAlias}</p>}
                {lic.expiresAt && (
                  <p className={isExpired(lic) ? "text-red-400" : isExpiringSoon(lic) ? "text-amber-400" : ""}>
                    Expira: {new Date(lic.expiresAt).toLocaleDateString("es")}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1 pt-1 border-t border-border">
                <button onClick={() => copyKey(lic.key)} className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors" title="Copiar"><Copy className="w-3.5 h-3.5" /></button>
                <button onClick={() => openMetaModal(lic)} className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-blue-400 transition-colors" title="Editar"><User className="w-3.5 h-3.5" /></button>
                {lic.status === "used" && (
                  <button onClick={() => { setRequestModal(lic); setRequestForm({ type: "reset_hwid", comment: "" }); }}
                    className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-purple-400 transition-colors" title="Solicitar acción"><Send className="w-3.5 h-3.5" /></button>
                )}
                <div className="ml-auto">
                  <select value={lic.resellerPrivateStatus || ""} onChange={(e) => savePrivateStatus(lic.id, e.target.value)}
                    className="text-xs bg-secondary border border-border rounded-md px-2 py-1 focus:outline-none">
                    <option value="">Sin estado</option>
                    {PRIVATE_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Vista TABLA */}
      {(!isReseller || viewMode === "table") && (
        <div className="card">
          <div className="table-wrap">
            <table className="table-base">
              <thead>
                <tr className="border-b border-border bg-secondary/30">
                  {isReseller && <th className="px-3 py-3 w-8" />}
                  {selectMode && <th className="px-3 py-3 w-8" />}
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium">Key</th>
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium">Producto</th>
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium">Dur.</th>
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium">Estado</th>
                  {isReseller && <th className="text-left px-4 py-3 text-muted-foreground font-medium">Privado</th>}
                  {user?.role === "owner" && <th className="text-left px-4 py-3 text-muted-foreground font-medium">Revendedor</th>}
                  <th className="text-left px-4 py-3 text-muted-foreground font-medium">Expira</th>
                  {isReseller && <th className="text-left px-4 py-3 text-muted-foreground font-medium">Cliente</th>}
                  <th className="text-right px-4 py-3 text-muted-foreground font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={9}><TableSkeleton rows={8} cols={7} /></td></tr>
                ) : licenses.length === 0 ? (
                  <tr><td colSpan={9}><EmptyState icon={Key} title="Sin licencias" description="No hay licencias que coincidan con los filtros aplicados." className="py-10" /></td></tr>
                ) : licenses.map((lic) => (
                  <tr key={lic.id} className={`border-b border-border last:border-0 transition-colors ${
                    isExpired(lic) ? "bg-red-500/5 hover:bg-red-500/10" : isExpiringSoon(lic) ? "bg-amber-500/5 hover:bg-amber-500/10" : "hover:bg-accent/30"
                  }`}>
                    {isReseller && (
                      <td className="px-3 py-3">
                        <button onClick={() => toggleFavorite(lic)} className={`transition-colors ${lic.favorite ? "text-yellow-400" : "text-muted-foreground hover:text-yellow-400"}`}>
                          <Star className="w-3.5 h-3.5" fill={lic.favorite ? "currentColor" : "none"} />
                        </button>
                      </td>
                    )}
                    {selectMode && (
                      <td className="px-3 py-3">
                        <button onClick={() => toggleSelect(lic.id)} className="text-muted-foreground hover:text-primary transition-colors">
                          {selected.has(lic.id)
                            ? <CheckSquare className="w-4 h-4 text-primary" />
                            : <Square className="w-4 h-4" />}
                        </button>
                      </td>
                    )}
                    <td className="px-4 py-3 font-mono text-xs">{lic.key}</td>
                    <td className="px-4 py-3 text-xs">{lic.product?.name}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{lic.duration}d</td>
                    <td className="px-4 py-3"><Badge value={lic.status} /></td>
                    {isReseller && (
                      <td className="px-4 py-3">
                        <select value={lic.resellerPrivateStatus || ""} onChange={(e) => savePrivateStatus(lic.id, e.target.value)}
                          className="text-xs bg-secondary border border-border rounded-md px-2 py-1 focus:outline-none max-w-[110px]">
                          <option value="">—</option>
                          {PRIVATE_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                        </select>
                      </td>
                    )}
                    {user?.role === "owner" && <td className="px-4 py-3 text-muted-foreground text-xs">{lic.reseller?.username || "—"}</td>}
                    <td className="px-4 py-3 text-xs">
                      {lic.expiresAt ? (
                        <span className={isExpired(lic) ? "text-red-400" : isExpiringSoon(lic) ? "text-amber-400" : "text-muted-foreground"}>
                          {new Date(lic.expiresAt).toLocaleDateString("es")}
                        </span>
                      ) : "—"}
                    </td>
                    {isReseller && (
                      <td className="px-4 py-3 text-xs text-muted-foreground">{lic.clientAlias || lic.assignedUser || "—"}</td>
                    )}
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => copyKey(lic.key)} className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors" title="Copiar"><Copy className="w-3.5 h-3.5" /></button>
                        {isReseller && (
                          <>
                            <button onClick={() => openMetaModal(lic)} className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors" title="Editar"><User className="w-3.5 h-3.5" /></button>
                            {lic.status === "used" && (
                              <button onClick={() => { setRequestModal(lic); setRequestForm({ type: "reset_hwid", comment: "" }); }}
                                className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors" title="Solicitar acción"><Send className="w-3.5 h-3.5" /></button>
                            )}
                          </>
                        )}
                        {user?.role === "owner" && (
                          <>
                            <button onClick={() => toggleBlock(lic.id)} className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-amber-400 transition-colors" title="Bloquear"><Ban className="w-3.5 h-3.5" /></button>
                            <button onClick={() => softDelete(lic.id)} className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-red-400 transition-colors" title="Eliminar"><Trash2 className="w-3.5 h-3.5" /></button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {pages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-secondary/10">
              <p className="text-xs text-muted-foreground">Mostrando {(page - 1) * LIMIT + 1}–{Math.min(page * LIMIT, total)} de {total}</p>
              <div className="flex items-center gap-1">
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="p-1.5 rounded-md hover:bg-accent text-muted-foreground disabled:opacity-40 transition-colors"><ChevronLeft className="w-4 h-4" /></button>
                <span className="text-xs text-muted-foreground px-2">{page} / {pages}</span>
                <button onClick={() => setPage((p) => Math.min(pages, p + 1))} disabled={page === pages} className="p-1.5 rounded-md hover:bg-accent text-muted-foreground disabled:opacity-40 transition-colors"><ChevronRight className="w-4 h-4" /></button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal: editar meta */}
      {metaModal && (
        <div className="modal-overlay modal-enter">
          <div className="modal-box space-y-4">
            <div>
              <h2 className="font-semibold">Editar información</h2>
              <p className="text-xs text-muted-foreground mt-0.5 font-mono truncate">{metaModal.key}</p>
            </div>
            <div>
              <label className="text-sm text-muted-foreground block mb-1.5">Alias del cliente</label>
              <input type="text" value={metaForm.clientAlias} onChange={(e) => setMetaForm({ ...metaForm, clientAlias: e.target.value })}
                className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="Ej: Juan Discord" />
            </div>
            <div>
              <label className="text-sm text-muted-foreground block mb-1.5"><User className="w-3.5 h-3.5 inline mr-1" />Usuario asignado</label>
              <input type="text" value={metaForm.assignedUser} onChange={(e) => setMetaForm({ ...metaForm, assignedUser: e.target.value })}
                className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="Nombre de usuario del cliente" />
            </div>
            <div>
              <label className="text-sm text-muted-foreground block mb-1.5">Estado privado</label>
              <select value={metaForm.resellerPrivateStatus} onChange={(e) => setMetaForm({ ...metaForm, resellerPrivateStatus: e.target.value })}
                className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                <option value="">Sin estado</option>
                {PRIVATE_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm text-muted-foreground block mb-1.5"><MessageSquare className="w-3.5 h-3.5 inline mr-1" />Nota interna</label>
              <textarea value={metaForm.notes} onChange={(e) => setMetaForm({ ...metaForm, notes: e.target.value })}
                className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring h-20 resize-none"
                placeholder="Notas privadas..." />
            </div>
            <div className="flex gap-2">
              <button onClick={saveMeta} disabled={submitting} className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50">Guardar</button>
              <button onClick={() => setMetaModal(null)} className="flex-1 bg-secondary hover:bg-accent text-foreground py-2 rounded-lg text-sm transition-colors">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: confirmar borrado masivo */}
      {bulkDeleteModal && user?.role === "owner" && (
        <div className="modal-overlay modal-enter">
          <div className="modal-box-sm space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-destructive/10 shrink-0">
                <Trash2 className="w-4 h-4 text-red-400" />
              </div>
              <div>
                <h2 className="font-semibold">Eliminar {selected.size} key{selected.size !== 1 ? "s" : ""}</h2>
                <p className="text-xs text-muted-foreground mt-1">
                  Esta acción es irreversible. Las keys serán marcadas como eliminadas
                  y no podrán ser reclamadas. El historial de solicitudes se conserva.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleBulkDelete}
                className="flex-1 bg-destructive hover:bg-destructive/90 text-white py-2 rounded-lg text-sm font-medium transition-colors">
                Confirmar eliminación
              </button>
              <button
                onClick={() => setBulkDeleteModal(false)}
                className="flex-1 bg-secondary hover:bg-accent text-foreground py-2 rounded-lg text-sm transition-colors">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: solicitar acción */}
      {requestModal && (
        <div className="modal-overlay modal-enter">
          <div className="modal-box space-y-4">
            <div>
              <h2 className="font-semibold">Solicitar acción</h2>
              <p className="text-xs text-muted-foreground mt-0.5 font-mono truncate">{requestModal.key}</p>
            </div>
            <div className="space-y-2">
              {REQUEST_TYPES.map(({ value, label, icon: Icon }) => (
                <button key={value} onClick={() => setRequestForm({ ...requestForm, type: value })}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-sm transition-colors text-left ${
                    requestForm.type === value ? "border-primary bg-primary/10" : "border-border bg-secondary/20 hover:bg-accent"
                  }`}>
                  <Icon className="w-4 h-4 text-muted-foreground" />
                  <span>{label}</span>
                </button>
              ))}
            </div>
            <div>
              <label className="text-sm text-muted-foreground block mb-1.5">Comentario (opcional)</label>
              <textarea value={requestForm.comment} onChange={(e) => setRequestForm({ ...requestForm, comment: e.target.value })}
                className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring h-20 resize-none"
                placeholder="Motivo o información adicional..." />
            </div>
            <p className="text-xs text-muted-foreground bg-secondary/30 rounded-lg px-3 py-2">
              Esta solicitud será enviada al owner y notificada por Discord.
            </p>
            <div className="flex gap-2">
              <button onClick={submitRequest} disabled={submitting}
                className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                <Send className="w-3.5 h-3.5" /> Enviar solicitud
              </button>
              <button onClick={() => setRequestModal(null)} className="flex-1 bg-secondary hover:bg-accent text-foreground py-2 rounded-lg text-sm transition-colors">Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
