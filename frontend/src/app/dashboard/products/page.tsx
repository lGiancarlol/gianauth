"use client";
import { useEffect, useState } from "react";
import api from "@/lib/api";
import Badge from "@/components/Badge";
import { TableSkeleton } from "@/components/Skeleton";
import { toast } from "sonner";
import EmptyState from "@/components/EmptyState";
import { Plus, Pencil, Trash2, ToggleLeft, ToggleRight, Package } from "lucide-react";
import { useSocket } from "@/hooks/useSocket";
import { useProductsStore } from "@/lib/store";

interface Product { id: number; name: string; slug: string; active: boolean; createdAt: string; }

export default function ProductsPage() {
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", slug: "" });
  const [editModal, setEditModal] = useState<Product | null>(null);
  const [editName, setEditName] = useState("");

  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  useSocket(token); // Ensures socket is alive and store is updated

  // Use store as source of truth; local state only for loading
  const storeProducts = useProductsStore((s) => s.products);
  const setStoreProducts = useProductsStore((s) => s.setProducts);
  const products = storeProducts.length > 0 ? storeProducts as Product[] : [];

  async function load() {
    try {
      const { data } = await api.get("/products");
      setStoreProducts(data);
    } catch { toast.error("Error al cargar productos"); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api.post("/products", form);
      toast.success("Producto creado");
      setShowCreate(false);
      setForm({ name: "", slug: "" });
      load();
    } catch (err: any) { toast.error(err.response?.data?.error || "Error al crear"); }
  }

  async function toggleActive(p: Product) {
    try {
      await api.patch(`/products/${p.id}`, { active: !p.active });
      toast.success(p.active ? "Producto desactivado" : "Producto activado");
      load();
    } catch { toast.error("Error al actualizar"); }
  }

  async function handleEdit() {
    if (!editModal) return;
    try {
      await api.patch(`/products/${editModal.id}`, { name: editName });
      toast.success("Producto actualizado");
      setEditModal(null);
      load();
    } catch { toast.error("Error al actualizar"); }
  }

  async function handleDelete(p: Product) {
    if (!confirm(`¿Eliminar "${p.name}"? Solo es posible si no tiene keys activas.`)) return;
    try {
      await api.delete(`/products/${p.id}`);
      toast.success("Producto eliminado");
      load();
    } catch (err: any) { toast.error(err.response?.data?.error || "Error al eliminar"); }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Productos</h1>
          <p className="text-muted-foreground text-sm mt-1">{products.length} productos registrados</p>
        </div>
        <button onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          <Plus className="w-4 h-4" /> Nuevo Producto
        </button>
      </div>

      {showCreate && (
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="font-semibold mb-4">Crear Producto</h2>
          <form onSubmit={handleCreate} className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="text-sm text-muted-foreground block mb-1.5">Nombre</label>
              <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="Ej: Producto Pro" required />
            </div>
            <div className="flex-1">
              <label className="text-sm text-muted-foreground block mb-1.5">Slug (único)</label>
              <input type="text" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/\s+/g, "-") })}
                className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="Ej: producto-pro" required />
            </div>
            <button type="submit" className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium transition-colors">Crear</button>
            <button type="button" onClick={() => setShowCreate(false)} className="bg-secondary hover:bg-accent text-foreground px-4 py-2 rounded-lg text-sm transition-colors">Cancelar</button>
          </form>
        </div>
      )}

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-secondary/30">
              <th className="text-left px-4 py-3 text-muted-foreground font-medium">Nombre</th>
              <th className="text-left px-4 py-3 text-muted-foreground font-medium">Slug</th>
              <th className="text-left px-4 py-3 text-muted-foreground font-medium">Estado</th>
              <th className="text-left px-4 py-3 text-muted-foreground font-medium">Creado</th>
              <th className="text-right px-4 py-3 text-muted-foreground font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5}><TableSkeleton rows={4} cols={5} /></td></tr>
            ) : products.length === 0 ? (
              <tr><td colSpan={5}><EmptyState icon={Package} title="Sin productos" description="Crea tu primer producto para empezar a asignar keys." /></td></tr>
            ) : (
              products.map((p) => (
                <tr key={p.id} className="border-b border-border last:border-0 hover:bg-accent/30 transition-colors">
                  <td className="px-4 py-3 font-medium">{p.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{p.slug}</td>
                  <td className="px-4 py-3">
                    <Badge value={p.active ? "available" : "blocked"} />
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{new Date(p.createdAt).toLocaleDateString("es")}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => { setEditModal(p); setEditName(p.name); }}
                        className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors" title="Editar">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => toggleActive(p)}
                        className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-amber-400 transition-colors" title={p.active ? "Desactivar" : "Activar"}>
                        {p.active ? <ToggleRight className="w-3.5 h-3.5" /> : <ToggleLeft className="w-3.5 h-3.5" />}
                      </button>
                      <button onClick={() => handleDelete(p)}
                        className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-red-400 transition-colors" title="Eliminar">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {editModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-xl p-6 w-full max-w-sm space-y-4">
            <h2 className="font-semibold">Editar producto</h2>
            <div>
              <label className="text-sm text-muted-foreground block mb-1.5">Nombre</label>
              <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)}
                className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div className="flex gap-2">
              <button onClick={handleEdit} className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground py-2 rounded-lg text-sm font-medium transition-colors">Guardar</button>
              <button onClick={() => setEditModal(null)} className="flex-1 bg-secondary hover:bg-accent text-foreground py-2 rounded-lg text-sm transition-colors">Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
