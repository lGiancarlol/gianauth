import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("rounded-md skeleton-shimmer", className)} />;
}

export function TableSkeleton({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-0">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-border last:border-0">
          {Array.from({ length: cols }).map((_, j) => (
            <Skeleton
              key={j}
              className={cn(
                "h-3",
                j === 0 ? "w-28 sm:w-36" : j === cols - 1 ? "w-14 ml-auto" : "w-16 sm:w-20"
              )}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export function StatCardSkeleton() {
  return (
    <div className="card card-p">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2 flex-1">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-7 w-14" />
        </div>
        <Skeleton className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg shrink-0" />
      </div>
    </div>
  );
}

export function CardSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="card card-p space-y-3">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn("h-3", i === 0 ? "w-1/3" : i === lines - 1 ? "w-1/4" : "w-2/3")}
        />
      ))}
    </div>
  );
}

export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="card card-p flex items-center gap-3">
          <Skeleton className="w-8 h-8 rounded-lg shrink-0" />
          <div className="flex-1 space-y-2 min-w-0">
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="h-2.5 w-1/2" />
          </div>
          <Skeleton className="w-16 h-6 rounded-full shrink-0" />
        </div>
      ))}
    </div>
  );
}

export function ModalSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-5 w-1/3" />
      <div className="space-y-3">
        <Skeleton className="h-9 w-full rounded-lg" />
        <Skeleton className="h-9 w-full rounded-lg" />
        <Skeleton className="h-20 w-full rounded-lg" />
      </div>
      <div className="flex gap-2 pt-1">
        <Skeleton className="h-9 flex-1 rounded-lg" />
        <Skeleton className="h-9 flex-1 rounded-lg" />
      </div>
    </div>
  );
}
