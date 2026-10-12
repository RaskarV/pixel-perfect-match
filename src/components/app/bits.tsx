import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatINR } from "@/lib/format";
import type { Risk } from "@/lib/types";
import { RISK_LABEL } from "@/lib/finance";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Panel({ title, subtitle, actions, children, className }: { title?: ReactNode; subtitle?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("card-surface p-5", className)}>
      {(title || actions) && (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
          <div>
            {title && <h2 className="text-base font-semibold">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
          </div>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

const tone = {
  income: "text-income bg-income/12",
  expense: "text-expense bg-expense/12",
  forecast: "text-forecast bg-forecast/12",
  ai: "text-ai bg-ai/12",
  warning: "text-warning bg-warning/12",
  neutral: "text-muted-foreground bg-muted",
} as const;
export type Tone = keyof typeof tone;

export function StatCard({ label, value, icon: Icon, hint, t = "neutral", valueTone }: { label: string; value: string; icon: LucideIcon; hint?: ReactNode; t?: Tone; valueTone?: "income" | "expense" | "forecast" }) {
  return (
    <div className="card-surface p-5 transition-colors hover:border-ring/40">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className={cn("grid size-9 place-items-center rounded-lg", tone[t])}>
          <Icon className="size-4" />
        </span>
      </div>
      <div className={cn("num mt-3 text-2xl font-semibold tracking-tight", valueTone && { income: "text-income", expense: "text-expense", forecast: "text-forecast" }[valueTone])}>{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

export function Pill({ t = "neutral", children, className }: { t?: Tone; children: ReactNode; className?: string }) {
  return <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap", tone[t], className)}>{children}</span>;
}

export const riskTone: Record<Risk, Tone> = { low: "income", medium: "warning", high: "expense" };
export function RiskBadge({ risk, short }: { risk: Risk; short?: boolean }) {
  return <Pill t={riskTone[risk]}>{short ? { low: "Low", medium: "Medium", high: "High" }[risk] : RISK_LABEL[risk]}</Pill>;
}

export function StatusBadge({ status }: { status: string }) {
  const t: Tone = status === "Paid" || status === "Received" ? "income" : status === "Overdue" || status === "Delayed" ? "expense" : status === "Due Soon" ? "warning" : "forecast";
  return <Pill t={t}>{status}</Pill>;
}

export function Money({ value, type, className }: { value: number; type?: "income" | "expense"; className?: string }) {
  return (
    <span className={cn("num font-medium", type === "income" && "text-income", type === "expense" && "text-expense", className)}>
      {type === "income" ? "+" : type === "expense" ? "−" : ""}
      {formatINR(value)}
    </span>
  );
}

export function EmptyState({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
      <Inbox className="size-8 text-muted-foreground" />
      <p className="font-medium">{title}</p>
      {body && <p className="max-w-sm text-sm text-muted-foreground">{body}</p>}
      {action}
    </div>
  );
}

export function Field({ label, error, children, htmlFor, hint }: { label: string; error?: string; children: ReactNode; htmlFor?: string; hint?: string }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor} className="text-xs text-muted-foreground">{label}</Label>
      {children}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && <p className="text-xs text-expense">{error}</p>}
    </div>
  );
}

export function ConfirmDialog({ open, onOpenChange, title, body, confirmLabel = "Delete", onConfirm }: { open: boolean; onOpenChange: (o: boolean) => void; title: string; body: string; confirmLabel?: string; onConfirm: () => void }) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{body}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={onConfirm}>{confirmLabel}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function RangeTabs<T extends number | string>({ value, options, onChange, format = (v) => `${v}D` }: { value: T; options: T[]; onChange: (v: T) => void; format?: (v: T) => string }) {
  return (
    <div className="inline-flex rounded-lg border bg-input-bg p-0.5" role="tablist">
      {options.map((o) => (
        <button key={String(o)} role="tab" aria-selected={o === value} onClick={() => onChange(o)} className={cn("rounded-md px-3 py-1 text-xs font-medium transition-colors", o === value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
          {format(o)}
        </button>
      ))}
    </div>
  );
}

export function ChartTip({ active, payload, label, labelFmt }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string; labelFmt?: (l: string) => string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-lg">
      <div className="mb-1 font-medium">{labelFmt && label ? labelFmt(label) : label}</div>
      {payload.filter((p) => p.value != null).map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="size-2 rounded-full" style={{ background: p.color }} />
          <span className="text-muted-foreground">{p.name}</span>
          <span className="num ml-auto font-medium">{formatINR(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

export const C = {
  income: "var(--income)",
  expense: "var(--expense)",
  forecast: "var(--forecast)",
  ai: "var(--ai)",
  warning: "var(--warning)",
  grid: "var(--border)",
  axis: "var(--muted-foreground)",
  cats: ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)", "var(--chart-6)", "var(--chart-7)", "var(--chart-8)"],
};
