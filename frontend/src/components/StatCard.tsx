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
  default: "text-primary bg-primary/10 border-primary/20",
  success: "text-emerald-600 bg-emerald-500/8 border-emerald-500/20 dark:text-emerald-400",
  warning: "text-amber-600 bg-amber-500/8 border-amber-500/20 dark:text-amber-400",
  danger:  "text-red-600 bg-red-500/8 border-red-500/20 dark:text-red-400",
};

export default function StatCard({ title, value, icon: Icon, description, variant = "default" }: StatCardProps) {
  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="text-2xl font-bold text-foreground mt-1">{value}</p>
          {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
        </div>
        <div className={cn("w-10 h-10 rounded-lg border flex items-center justify-center", variants[variant])}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
}
