import { cn } from "@/lib/utils";

interface BadgeConfig {
  bg: string;
  text: string;
  border: string;
  dot: string;
  label: string;
}

const config: Record<string, BadgeConfig> = {
  available:       { bg: "bg-emerald-500/8",  text: "text-emerald-400", border: "border-emerald-500/20", dot: "bg-emerald-400",  label: "Disponible"  },
  used:            { bg: "bg-slate-500/8",     text: "text-slate-400",   border: "border-slate-500/20",   dot: "bg-slate-400",   label: "Usada"       },
  blocked:         { bg: "bg-red-500/8",       text: "text-red-400",     border: "border-red-500/20",     dot: "bg-red-400",     label: "Bloqueada"   },
  expired:         { bg: "bg-orange-500/8",    text: "text-orange-400",  border: "border-orange-500/20",  dot: "bg-orange-400",  label: "Expirada"    },
  pending:         { bg: "bg-amber-500/8",     text: "text-amber-400",   border: "border-amber-500/20",   dot: "bg-amber-400",   label: "Pendiente"   },
  approved:        { bg: "bg-emerald-500/8",   text: "text-emerald-400", border: "border-emerald-500/20", dot: "bg-emerald-400", label: "Aprobada"    },
  completed:       { bg: "bg-slate-500/8",     text: "text-slate-400",   border: "border-slate-500/20",   dot: "bg-slate-400",   label: "Completada"  },
  rejected:        { bg: "bg-red-500/8",       text: "text-red-400",     border: "border-red-500/20",     dot: "bg-red-400",     label: "Rechazada"   },
  active:          { bg: "bg-emerald-500/8",   text: "text-emerald-400", border: "border-emerald-500/20", dot: "bg-emerald-400", label: "Activo"      },
  overdue:         { bg: "bg-red-500/8",       text: "text-red-400",     border: "border-red-500/20",     dot: "bg-red-400",     label: "Vencido"     },
  owner:           { bg: "bg-amber-500/8",     text: "text-amber-400",   border: "border-amber-500/20",   dot: "bg-amber-400",   label: "Owner"       },
  reseller:        { bg: "bg-[#c0392b]/8",     text: "text-[#c0392b]",   border: "border-[#c0392b]/20",   dot: "bg-[#c0392b]",   label: "Revendedor"  },
  open:            { bg: "bg-amber-500/8",     text: "text-amber-400",   border: "border-amber-500/20",   dot: "bg-amber-400",   label: "Abierto"     },
  in_progress:     { bg: "bg-slate-500/8",     text: "text-slate-400",   border: "border-slate-500/20",   dot: "bg-slate-400",   label: "En progreso" },
  closed:          { bg: "bg-secondary",       text: "text-muted-foreground", border: "border-border",    dot: "bg-muted-foreground", label: "Cerrado" },
  high_priority:   { bg: "bg-red-500/8",       text: "text-red-400",     border: "border-red-500/20",     dot: "bg-red-400",     label: "Alta"        },
  medium_priority: { bg: "bg-amber-500/8",     text: "text-amber-400",   border: "border-amber-500/20",   dot: "bg-amber-400",   label: "Media"       },
  low_priority:    { bg: "bg-secondary",       text: "text-muted-foreground", border: "border-border",    dot: "bg-muted-foreground", label: "Baja"    },
  renewal_pending: { bg: "bg-amber-500/8",     text: "text-amber-400",   border: "border-amber-500/20",   dot: "bg-amber-400",   label: "Pendiente"   },
  nueva:           { bg: "bg-secondary",       text: "text-muted-foreground", border: "border-border",    dot: "bg-muted-foreground", label: "Nueva"   },
  entregada:       { bg: "bg-slate-500/8",     text: "text-slate-400",   border: "border-slate-500/20",   dot: "bg-slate-400",   label: "Entregada"   },
  asignada:        { bg: "bg-secondary",       text: "text-muted-foreground", border: "border-border",    dot: "bg-muted-foreground", label: "Asignada"},
  pendiente_pago:  { bg: "bg-amber-500/8",     text: "text-amber-400",   border: "border-amber-500/20",   dot: "bg-amber-400",   label: "Pend. Pago"  },
  vip:             { bg: "bg-purple-500/8",    text: "text-purple-400",  border: "border-purple-500/20",  dot: "bg-purple-400",  label: "VIP"         },
  archivada:       { bg: "bg-secondary",       text: "text-muted-foreground", border: "border-border",    dot: "bg-muted-foreground", label: "Archivada"},
};

interface BadgeProps {
  value: string;
  dot?: boolean;
  className?: string;
}

export default function Badge({ value, dot = true, className }: BadgeProps) {
  const c = config[value];
  if (!c) {
    return (
      <span className={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border",
        "bg-secondary text-muted-foreground border-border",
        className
      )}>
        {value}
      </span>
    );
  }
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border",
      c.bg, c.text, c.border,
      className
    )}>
      {dot && <span className={cn("status-dot", c.dot)} />}
      {c.label}
    </span>
  );
}
