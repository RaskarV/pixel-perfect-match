import { format, parseISO, isValid } from "date-fns";

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const inrCompact = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", notation: "compact", maximumFractionDigits: 1 });

export function safeNum(n: number): number {
  return Number.isFinite(n) ? n : 0;
}
export function formatINR(n: number): string {
  return inr.format(Math.round(safeNum(n)));
}
export function formatINRCompact(n: number): string {
  return inrCompact.format(safeNum(n));
}
export function formatPct(n: number, digits = 0): string {
  return `${safeNum(n).toFixed(digits)}%`;
}
export function iso(d: Date): string {
  return format(d, "yyyy-MM-dd");
}
export function fmtDate(s: string, pattern = "dd MMM yyyy"): string {
  const d = parseISO(s);
  return isValid(d) ? format(d, pattern) : "—";
}
export function uid(prefix = "id"): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-4)}`;
}
