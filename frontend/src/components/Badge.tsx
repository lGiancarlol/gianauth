import { cn } from "@/lib/utils";

const styles: Record<string, string> = {
  available:       "bg-emerald-500/8 text-emerald-600 border-emerald-500/20 dark:text-emerald-400",
  used:            "bg-blue-500/8 text-blue-600 border-blue-500/20 dark:text-blue-400",
  blocked:         "bg-red-500/8 text-red-600 border-red-500/20 dark:text-red-400",
  expired:         "bg-orange-500/8 text-orange-600 border-orange-500/20 dark:text-orange-400",
  owner:           "bg-amber-500/8 text-amber-600 border-amber-500/20 dark:text-amber-400",
  reseller:        "bg-primary/8 text-primary border-primary/20",
  pending:         "bg-amber-500/8 text-amber-600 border-amber-500/20 dark:text-amber-400",
  approved:        "bg-emerald-500/8 text-emerald-600 border-emerald-500/20 dark:text-emerald-400",
  completed:       "bg-blue-500/8 text-blue-600 border-blue-500/20 dark:text-blue-400",
  rejected:        "bg-red-500/8 text-red-600 border-red-500/20 dark:text-red-400",
  nueva:           "bg-secondary text-muted-foreground border-border",
  entregada:       "bg-secondary text-muted-foreground border-border",
  asignada:        "bg-secondary text-muted-foreground border-border",
  pendiente_pago:  "bg-amber-500/8 text-amber-600 border-amber-500/20 dark:text-amber-400",
  vip:             "bg-secondary text-foreground border-border",
  archivada:       "bg-secondary text-muted-foreground border-border",
  // Renewal
  active:          "bg-emerald-500/8 text-emerald-600 border-emerald-500/20 dark:text-emerald-400",
  renewal_pending: "bg-amber-500/8 text-amber-600 border-amber-500/20 dark:text-amber-400",
  overdue:         "bg-red-500/8 text-red-600 border-red-500/20 dark:text-red-400",
  // Tickets
  open:            "bg-amber-500/8 text-amber-600 border-amber-500/20 dark:text-amber-400",
  in_progress:     "bg-blue-500/8 text-blue-600 border-blue-500/20 dark:text-blue-400",
  closed:          "bg-secondary text-muted-foreground border-border",
  low_priority:    "bg-secondary text-muted-foreground border-border",
  medium_priority: "bg-amber-500/8 text-amber-600 border-amber-500/20 dark:text-amber-400",
  high_priority:   "bg-red-500/8 text-red-600 border-red-500/20 dark:text-red-400",
};

const labels: Record<string, string> = {
  available:       "Disponible",
  used:            "Usada",
  blocked:         "Bloqueada",
  expired:         "Expirada",
  owner:           "Owner",
  reseller:        "Revendedor",
  pending:         "Pendiente",
  approved:        "Aprobada",
  completed:       "Completada",
  rejected:        "Rechazada",
  nueva:           "Nueva",
  entregada:       "Entregada",
  asignada:        "Asignada",
  pendiente_pago:  "Pend. Pago",
  vip:             "VIP",
  archivada:       "Archivada",
  // Renewal
  active:          "Activo",
  renewal_pending: "Pendiente",
  overdue:         "Vencido",
  // Tickets
  open:            "Abierto",
  in_progress:     "En progreso",
  closed:          "Cerrado",
  low_priority:    "Baja",
  medium_priority: "Media",
  high_priority:   "Alta",
};

export default function Badge({ value }: { value: string }) {
  return (
    <span className={cn(
      "inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border",
      styles[value] || "bg-muted text-muted-foreground border-border"
    )}>
      {labels[value] || value}
    </span>
  );
}
