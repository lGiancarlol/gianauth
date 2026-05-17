"use client";
import { useEffect, useState } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import { Copy, CheckCircle, Loader2 } from "lucide-react";
import { Skeleton } from "@/components/Skeleton";
import { useSocket } from "@/hooks/useSocket";
import { useProductsStore } from "@/lib/store";

interface StockItem {
  productId: number;
  duration: number;
  _count: { id: number };
  product: { id: number; name: string; slug: string; active: boolean };
}

export default function ClaimPage() {
  const [stock, setStock] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [claimedKey, setClaimedKey] = useState<{ key: string; expiresAt: string | null } | null>(null);
  const [selected, setSelected] = useState({ productId: 0, duration: 0 });
  const [disabledProducts, setDisabledProducts] = useState<Set<number>>(new Set());

  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const { on } = useSocket(token);
  // Reactively disable products that get deactivated via store
  const storeProducts = useProductsStore((s) => s.products);

  async function loadStock() {
    try {
      const { data } = await api.get("/licenses/stock");
      const active = (data as StockItem[]).filter((s) => s.product?.active !== false);
      setStock(active);
      if (active.length > 0) setSelected({ productId: active[0].productId, duration: active[0].duration });
    } catch {
      toast.error("Error al cargar stock");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadStock(); }, []);

  useEffect(() => {
    // Sync disabled set from store whenever products change
    const disabled = new Set(storeProducts.filter((p) => !p.active).map((p) => p.id));
    setDisabledProducts(disabled);
    if (disabled.has(selected.productId)) setSelected({ productId: 0, duration: 0 });
  }, [storeProducts]);

  useEffect(() => {
    return on<{ id: number; active: boolean }>("product:state_changed", ({ id, active }) => {
      if (!active) {
        setDisabledProducts((prev) => new Set(prev).add(id));
        setStock((prev) => prev.filter((s) => s.productId !== id));
        setSelected((prev) => prev.productId === id ? { productId: 0, duration: 0 } : prev);
      } else {
        setDisabledProducts((prev) => { const next = new Set(prev); next.delete(id); return next; });
        loadStock();
      }
    });
  }, [on]);

  async function handleClaim() {
    if (!selected.productId || !selected.duration) return toast.error("Selecciona producto y duración");
    setClaiming(true);
    setClaimedKey(null);
    try {
      const { data } = await api.post("/licenses/claim", { productId: selected.productId, duration: selected.duration });
      setClaimedKey({ key: data.key, expiresAt: data.expiresAt });
      toast.success("¡Key reclamada exitosamente!");
      loadStock();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Error al reclamar");
    } finally {
      setClaiming(false);
    }
  }

  const products = Array.from(new Map(stock.map((s) => [s.productId, s.product])).values());
  const durations = stock.filter((s) => s.productId === selected.productId);

  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <h1 className="text-2xl font-bold">Reclamar Key</h1>
        <p className="text-muted-foreground text-sm mt-1">Selecciona el producto y duración para obtener una key de tu inventario</p>
      </div>

      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-4 w-20" />
            <div className="grid grid-cols-2 gap-2">
              <Skeleton className="h-16" />
              <Skeleton className="h-16" />
            </div>
          </div>
        ) : stock.length === 0 ? (
          <p className="text-muted-foreground text-sm">No tienes stock disponible en este momento</p>
        ) : (
          <>
            <div>
              <label className="text-sm text-muted-foreground block mb-1.5">Producto</label>
              <select
                value={selected.productId}
                onChange={(e) => {
                  const pid = parseInt(e.target.value);
                  const first = stock.find((s) => s.productId === pid);
                  setSelected({ productId: pid, duration: first?.duration || 0 });
                  setClaimedKey(null);
                }}
                className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>

            <div>
              <label className="text-sm text-muted-foreground block mb-1.5">Duración</label>
              <div className="grid grid-cols-2 gap-2">
                {durations.map((item) => (
                  <button key={item.duration}
                    onClick={() => { setSelected({ ...selected, duration: item.duration }); setClaimedKey(null); }}
                    className={`p-3 rounded-lg border text-sm transition-colors text-left ${
                      selected.duration === item.duration
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-secondary/30 text-foreground hover:bg-accent"
                    }`}>
                    <div className="font-medium">{item.duration} {item.duration === 1 ? "día" : "días"}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{item._count.id} disponibles</div>
                  </button>
                ))}
              </div>
            </div>

            <button onClick={handleClaim} disabled={claiming || !selected.productId || !selected.duration || disabledProducts.has(selected.productId)}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium py-2.5 rounded-lg text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
              {claiming && <Loader2 className="w-4 h-4 animate-spin" />}
              {claiming ? "Reclamando..." : "Reclamar Key"}
            </button>
          </>
        )}
      </div>

      {claimedKey && (
        <div className="bg-emerald-500/8 border border-emerald-500/20 rounded-xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">Key reclamada exitosamente</span>
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm font-mono">{claimedKey.key}</code>
            <button onClick={() => { navigator.clipboard.writeText(claimedKey.key); toast.success("Key copiada"); }}
              className="p-2 bg-primary/10 hover:bg-primary/20 border border-primary/20 rounded-lg text-primary transition-colors">
              <Copy className="w-4 h-4" />
            </button>
          </div>
          {claimedKey.expiresAt && (
            <p className="text-xs text-muted-foreground">
              Expira: {new Date(claimedKey.expiresAt).toLocaleDateString("es", { day: "numeric", month: "long", year: "numeric" })}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
