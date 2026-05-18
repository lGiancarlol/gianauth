/**
 * ui.tsx — Shared responsive UI primitives for GianAuth dashboard.
 * Import what you need: PageHeader, Card, TableWrap, Modal, ActionRow, etc.
 * Zero business logic — pure layout/visual components.
 */
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

// ── Page shell ────────────────────────────────────────────────────────────────

export function PageShell({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("space-y-4 sm:space-y-5 page-content", className)}>
      {children}
    </div>
  );
}

// ── Page header ───────────────────────────────────────────────────────────────

export function PageHeader({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("page-header", className)}>
      {children}
    </div>
  );
}

export function PageTitle({ children, subtitle }: { children: React.ReactNode; subtitle?: string }) {
  return (
    <div className="min-w-0">
      <h1 className="page-title">{children}</h1>
      {subtitle && <p className="page-subtitle">{subtitle}</p>}
    </div>
  );
}

// ── Card ──────────────────────────────────────────────────────────────────────

export function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("card", className)}>
      {children}
    </div>
  );
}

export function CardBody({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("card-p", className)}>
      {children}
    </div>
  );
}

// ── Table wrapper ─────────────────────────────────────────────────────────────

export function TableWrap({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("table-wrap", className)}>
      {children}
    </div>
  );
}

// ── Responsive grids ──────────────────────────────────────────────────────────

export function Grid2({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("grid-responsive-2", className)}>{children}</div>;
}

export function Grid3({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("grid-responsive-3", className)}>{children}</div>;
}

export function Grid4({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("grid-responsive-4", className)}>{children}</div>;
}

// ── Action row ────────────────────────────────────────────────────────────────

export function ActionRow({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("action-row", className)}>
      {children}
    </div>
  );
}

// ── Icon buttons ──────────────────────────────────────────────────────────────

interface IconBtnProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  danger?: boolean;
  children: React.ReactNode;
}

export function IconBtn({ danger, children, className, ...props }: IconBtnProps) {
  return (
    <button
      className={cn(danger ? "icon-btn-danger" : "icon-btn", className)}
      {...props}
    >
      {children}
    </button>
  );
}

// ── Primary button ────────────────────────────────────────────────────────────

interface BtnProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md";
}

export function Btn({ children, variant = "primary", size = "md", className, ...props }: BtnProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-colors shrink-0 whitespace-nowrap disabled:opacity-50",
        size === "sm" ? "px-3 py-1.5 text-xs min-h-[32px]" : "px-3 sm:px-4 py-2 text-sm min-h-[40px]",
        variant === "primary" && "btn-primary",
        variant === "secondary" && "bg-secondary hover:bg-accent text-foreground border border-border",
        variant === "ghost" && "hover:bg-accent text-muted-foreground hover:text-foreground",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

// ── Modal ─────────────────────────────────────────────────────────────────────

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  size?: "sm" | "md";
  children: React.ReactNode;
}

export function Modal({ open, onClose, title, size = "md", children }: ModalProps) {
  if (!open) return null;
  return (
    <div className="modal-overlay modal-enter" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={size === "sm" ? "modal-box-sm" : "modal-box"}>
        {title && (
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-sm sm:text-base">{title}</h2>
            <button onClick={onClose} className="icon-btn">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

// ── Section header (inside card) ──────────────────────────────────────────────

export function SectionHeader({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 flex-wrap mb-3 sm:mb-4">
      <div className="font-semibold text-sm">{children}</div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

// ── Filter bar ────────────────────────────────────────────────────────────────

export function FilterBar({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {children}
    </div>
  );
}

// ── Inline badge row (for status badges that must wrap) ───────────────────────

export function BadgeRow({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-1", className)}>
      {children}
    </div>
  );
}

// ── Truncated text ────────────────────────────────────────────────────────────

export function TruncText({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("truncate min-w-0 block", className)}>
      {children}
    </span>
  );
}

// ── Mono key display ──────────────────────────────────────────────────────────

export function MonoKey({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("font-mono text-xs truncate min-w-0 block max-w-[180px] sm:max-w-[260px] md:max-w-none", className)}>
      {children}
    </span>
  );
}

// ── Empty row (for tables) ────────────────────────────────────────────────────

export function EmptyRow({ cols, children }: { cols: number; children: React.ReactNode }) {
  return (
    <tr>
      <td colSpan={cols} className="px-4 py-10 text-center text-muted-foreground text-sm">
        {children}
      </td>
    </tr>
  );
}

// ── Pagination bar ────────────────────────────────────────────────────────────

interface PaginationProps {
  page: number;
  pages: number;
  total: number;
  limit: number;
  onPrev: () => void;
  onNext: () => void;
}

export function Pagination({ page, pages, total, limit, onPrev, onNext }: PaginationProps) {
  if (pages <= 1) return null;
  return (
    <div className="flex items-center justify-between px-3 sm:px-4 py-3 border-t border-border bg-secondary/10 gap-2 flex-wrap">
      <p className="text-xs text-muted-foreground">
        {(page - 1) * limit + 1}–{Math.min(page * limit, total)} de {total}
      </p>
      <div className="flex items-center gap-1">
        <button onClick={onPrev} disabled={page === 1}
          className="icon-btn disabled:opacity-40">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <span className="text-xs text-muted-foreground px-2">{page} / {pages}</span>
        <button onClick={onNext} disabled={page === pages}
          className="icon-btn disabled:opacity-40">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
}
