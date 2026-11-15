"use client";
import clsx from "clsx";
import Link from "next/link";
import { useEffect, type ComponentProps, type ReactNode } from "react";
import { create } from "zustand";
import { Inbox, OctagonAlert, ShieldCheck, Siren, TriangleAlert, X } from "lucide-react";
import type { Severity } from "@/lib/types";

export const cn = clsx;

/* ---------- Buttons ---------- */
type Variant = "primary" | "accent" | "outline" | "ghost";
const btn = (variant: Variant = "primary", size: "sm" | "md" = "md") =>
  cn("inline-flex items-center justify-center gap-2 rounded-md font-medium transition disabled:cursor-not-allowed disabled:opacity-40",
    size === "sm" ? "px-2.5 py-1 text-xs" : "px-4 py-2 text-sm",
    { primary: "bg-ink text-paper hover:bg-ink/85", accent: "bg-accent text-ink hover:bg-accent/80", outline: "border border-ink/50 hover:bg-ink/10", ghost: "hover:bg-ink/10" }[variant]);

export function Button({ variant, size, className, ...p }: ComponentProps<"button"> & { variant?: Variant; size?: "sm" | "md" }) {
  return <button type="button" {...p} className={cn(btn(variant, size), className)} />;
}
export function LinkButton({ href, variant, size, className, children }: { href: string; variant?: Variant; size?: "sm" | "md"; className?: string; children: ReactNode }) {
  return <Link href={href} className={cn(btn(variant, size), className)}>{children}</Link>;
}

/* ---------- Layout bits ---------- */
export function Card({ className, ...p }: ComponentProps<"div">) {
  return <div {...p} className={cn("rounded-lg border border-ink/25 bg-ink/[0.04] p-4", className)} />;
}
export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div><h1 className="text-2xl font-bold">{title}</h1>{subtitle && <p className="mt-1 text-sm text-ink/70">{subtitle}</p>}</div>
      {actions && <div className="flex flex-wrap gap-2 print:hidden">{actions}</div>}
    </div>
  );
}
export function StatCard({ label, value, icon, hint, href, emphasis }: { label: string; value: ReactNode; icon?: ReactNode; hint?: string; href?: string; emphasis?: boolean }) {
  const inner = (
    <div className={cn("h-full rounded-lg border p-4 transition", emphasis ? "border-accent bg-ink text-paper" : "border-ink/25 bg-ink/[0.04] hover:bg-ink/10")}>
      <div className="flex items-center justify-between text-xs font-medium uppercase tracking-wide opacity-80">{label}<span className={emphasis ? "text-accent" : ""}>{icon}</span></div>
      <div className="mt-2 text-3xl font-bold">{value}</div>
      {hint && <div className="mt-1 text-xs opacity-70">{hint}</div>}
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}
export function EmptyState({ title, text }: { title: string; text?: string }) {
  return <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-ink/40 p-8 text-center"><Inbox aria-hidden /><div className="font-semibold">{title}</div>{text && <div className="text-sm text-ink/70">{text}</div>}</div>;
}
export const Skeleton = ({ className }: { className?: string }) => <div className={cn("animate-pulse rounded bg-ink/10", className)} />;
export function ProgressBar({ value, max = 100, accent }: { value: number; max?: number; accent?: boolean }) {
  return <div className="h-2 w-full overflow-hidden rounded bg-ink/15" role="progressbar" aria-valuenow={value} aria-valuemax={max}><div className={cn("h-full", accent ? "bg-accent" : "bg-ink")} style={{ width: `${Math.min(100, (value / max) * 100)}%` }} /></div>;
}
export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: readonly T[]; value: T; onChange: (t: T) => void }) {
  return (
    <div role="tablist" className="mb-4 flex gap-1 overflow-x-auto border-b border-ink/25">
      {tabs.map((t) => <button key={t} role="tab" aria-selected={t === value} onClick={() => onChange(t)} className={cn("-mb-px whitespace-nowrap border-b-4 px-4 py-2 text-sm font-medium", t === value ? "border-accent" : "border-transparent text-ink/70 hover:text-ink")}>{t}</button>)}
    </div>
  );
}

/* ---------- Badges (shape/label based, not color-only) ---------- */
export type Tone = "ink" | "accent" | "outline" | "dashed" | "muted";
const TONE: Record<Tone, string> = { ink: "bg-ink text-paper", accent: "bg-accent text-ink", outline: "border border-ink/50", dashed: "border border-dashed border-ink/60", muted: "bg-ink/10" };
export function Badge({ tone = "muted", className, children }: { tone?: Tone; className?: string; children: ReactNode }) {
  return <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded px-2 py-0.5 text-xs font-medium", TONE[tone], className)}>{children}</span>;
}
const STATUS_TONE: Record<string, Tone> = {
  Running: "outline", Stopped: "muted", "Under Maintenance": "accent", Unknown: "dashed",
  Available: "outline", Busy: "accent", Unavailable: "muted", "On Leave": "dashed",
  Draft: "muted", "Pending Assignment": "dashed", Assigned: "accent", Accepted: "accent", "In Progress": "ink", "On Hold": "dashed", Completed: "outline", Cancelled: "muted",
  Open: "accent", Acknowledged: "outline", Resolved: "muted",
  Pending: "dashed", Approved: "outline", Rejected: "muted", "Partially Approved": "accent", Fulfilled: "ink",
  Low: "muted", Medium: "outline", High: "accent", Urgent: "ink", "ML Diagnostic": "outline", "Manual Report": "dashed",
};
export const StatusBadge = ({ status }: { status: string }) => <Badge tone={STATUS_TONE[status] ?? "muted"}>{status}</Badge>;

const SEV = {
  Normal: { cls: "border border-ink/50", Icon: ShieldCheck },
  Warning: { cls: "border border-ink bg-accent/30", Icon: TriangleAlert },
  High: { cls: "border border-ink bg-accent font-semibold", Icon: OctagonAlert },
  Critical: { cls: "border border-accent bg-ink font-bold text-accent ring-2 ring-accent/60", Icon: Siren },
} as const;
export function SeverityBadge({ severity }: { severity: Severity }) {
  const { cls, Icon } = SEV[severity];
  return <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded px-2 py-0.5 text-xs", cls)}><Icon size={13} aria-hidden />{severity}</span>;
}

/* ---------- Form controls (ref passes through for react-hook-form) ---------- */
const ctl = "w-full rounded-md border border-ink/40 bg-paper px-3 py-2 text-sm placeholder:text-ink/50 disabled:bg-ink/10 disabled:text-ink/70";
export const Input = ({ className, ...p }: ComponentProps<"input">) => <input {...p} className={cn(ctl, className)} />;
export const Select = ({ className, ...p }: ComponentProps<"select">) => <select {...p} className={cn(ctl, className)} />;
export const Textarea = ({ className, ...p }: ComponentProps<"textarea">) => <textarea rows={3} {...p} className={cn(ctl, className)} />;
export const Options = ({ list }: { list: readonly string[] }) => <>{list.map((o) => <option key={o} value={o}>{o}</option>)}</>;
export function Field({ label, error, hint, children, className }: { label: string; error?: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <label className={cn("block text-sm", className)}>
      <span className="mb-1 block font-medium">{label}</span>{children}
      {hint && <span className="mt-1 block text-xs text-ink/70">{hint}</span>}
      {error && <span role="alert" className="mt-1 block text-xs font-semibold">⚠ {error}</span>}
    </label>
  );
}

/* ---------- Modal + confirmation ---------- */
export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/60 p-4" onMouseDown={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title} onMouseDown={(e) => e.stopPropagation()} className={cn("my-8 w-full rounded-lg border border-ink bg-paper shadow-xl", wide ? "max-w-4xl" : "max-w-xl")}>
        <div className="flex items-center justify-between border-b border-ink/25 px-5 py-3"><h2 className="text-lg font-bold">{title}</h2><button onClick={onClose} aria-label="Close" className="rounded p-1 hover:bg-ink/10"><X size={18} /></button></div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
export function ConfirmDialog({ open, title, message, confirmLabel = "Confirm", onConfirm, onCancel }: { open: boolean; title: string; message: string; confirmLabel?: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <Modal open={open} onClose={onCancel} title={title}>
      <p className="text-sm">{message}</p>
      <div className="mt-5 flex justify-end gap-2"><Button variant="outline" onClick={onCancel}>Cancel</Button><Button variant="accent" onClick={onConfirm}>{confirmLabel}</Button></div>
    </Modal>
  );
}

/* ---------- Toasts ---------- */
const useToast = create<{ items: { id: number; msg: string }[] }>(() => ({ items: [] }));
export function toast(msg: string) {
  const id = Date.now() + Math.random();
  useToast.setState((s) => ({ items: [...s.items, { id, msg }] }));
  setTimeout(() => useToast.setState((s) => ({ items: s.items.filter((i) => i.id !== id) })), 3500);
}
export function Toaster() {
  const items = useToast((s) => s.items);
  return <div aria-live="polite" className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2">{items.map((t) => <div key={t.id} className="flex items-center gap-2 rounded-md border border-accent bg-ink px-4 py-2 text-sm text-paper shadow-lg"><span className="text-accent">✓</span>{t.msg}</div>)}</div>;
}