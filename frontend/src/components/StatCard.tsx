import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  description?: string;
  variant?: "default" | "success" | "warning" | "danger";
}

const variants = {
  default: { icon: "",            value: "text-foreground"    },
  success: { icon: "text-emerald-400 bg-emerald-500/8 border-emerald-500/20", value: "text-emerald-400" },
  warning: { icon: "text-amber-400 bg-amber-500/8 border-amber-500/20",   value: "text-foreground"    },
  danger:  { icon: "text-red-400 bg-red-500/8 border-red-500/20",         value: "text-red-400"       },
};

export default function StatCard({ title, value, icon: Icon, description, variant = "default" }: StatCardProps) {
  const v = variants[variant];
  const isDefault = variant === "default";
  return (
    <div className="card card-hover card-p group transition-all duration-150">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs sm:text-sm text-muted-foreground truncate">{title}</p>
          <p className={cn("text-2xl font-bold mt-1 tabular-nums", v.value)}>{value}</p>
          {description && (
            <p className="text-xs text-muted-foreground mt-1 truncate">{description}</p>
          )}
        </div>
        <div
          className={cn(
            "w-9 h-9 sm:w-10 sm:h-10 rounded-lg border flex items-center justify-center shrink-0",
            "transition-transform duration-150 group-hover:scale-105",
            !isDefault && v.icon
          )}
          style={isDefault ? {
            background:   "var(--theme-soft)",
            borderColor:  "var(--theme-border)",
            color:        "var(--theme-primary)",
          } : undefined}
        >
          <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
        </div>
      </div>
    </div>
  );
}
