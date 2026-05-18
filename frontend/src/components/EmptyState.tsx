import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
  className?: string;
}

export default function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-12 sm:py-16 px-6 text-center", className)}>
      <div className="relative mb-5">
        {/* Glow ring */}
        <div className="absolute inset-0 rounded-2xl bg-secondary/30 blur-md scale-110" />
        <div className="relative w-12 h-12 rounded-xl bg-secondary/60 border border-border/60 flex items-center justify-center">
          <Icon className="w-5 h-5 text-muted-foreground/70" />
        </div>
      </div>
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description && (
        <p className="text-xs text-muted-foreground mt-1.5 max-w-[240px] leading-relaxed">{description}</p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="mt-5 px-4 py-2 rounded-lg text-xs font-medium border
                     transition-all duration-150 active:scale-[0.98]"
          style={{ background: "var(--theme-soft)", color: "var(--theme-primary)", borderColor: "var(--theme-border)" }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "var(--theme-muted)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "var(--theme-soft)")}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
