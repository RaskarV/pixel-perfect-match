/**
 * SmartSpend financial engine — pure, deterministic, React-free.
 * Sign convention: amounts are stored positive; income adds, expense subtracts.
 * Balance = mode opening balance + net of all recorded transactions up to a date.
 * Forecast: projects unpaid scheduled payments, expected income streams, open
 * receivables (business) and average variable daily spending. Paid payments are
 * represented by their recorded transaction only, so nothing is counted twice.
 * These are prototype rules — not a validated credit-risk or financial-advice model.
 */
import {
  addDays, addMonths, addQuarters, addWeeks, addYears, differenceInCalendarDays, endOfMonth,
  isValid, parseISO, setDate, startOfMonth, subDays, subMonths, format, getDaysInMonth,
} from "date-fns";
import type { AppData, Frequency, Goal, Mode, PayMethod, Payment, Risk, SimInputs, Transaction } from "./types";
import { iso, safeNum } from "./format";

const d = (s: string) => parseISO(s);
export const signed = (t: Transaction) => (t.type === "income" ? t.amount : -t.amount);
export const byMode = <T extends { mode: Mode }>(xs: T[], mode: Mode) => xs.filter((x) => x.mode === mode);
export const safeDiv = (a: number, b: number) => (b === 0 || !Number.isFinite(b) ? 0 : safeNum(a / b));

// ---------- basic totals ----------
export function totalIn(txns: Transaction[], type: "income" | "expense", from: string, to: string) {
  return txns.filter((t) => t.type === type && t.date >= from && t.date <= to).reduce((s, t) => s + t.amount, 0);
}
export function currentBalance(data: AppData, mode: Mode, today: Date) {
  const ti = iso(today);
  return data.settings.finance[mode].openingBalance + byMode(data.transactions, mode).filter((t) => t.date <= ti).reduce((s, t) => s + signed(t), 0);
}
export function monthStats(txns: Transaction[], month: Date) {
  const from = iso(startOfMonth(month));
  const to = iso(endOfMonth(month));
  const income = totalIn(txns, "income", from, to);
  const expense = totalIn(txns, "expense", from, to);
  return { income, expense, net: income - expense, savingsRate: safeDiv(income - expense, income) * 100, label: format(month, "MMM") };
}
export function lastMonths(txns: Transaction[], today: Date, n = 6) {
  return Array.from({ length: n }, (_, i) => monthStats(txns, subMonths(today, n - 1 - i)));
}
export function spendingByCategory(txns: Transaction[], from: string, to: string, buckets?: string[]) {
  const map = new Map<string, number>();
  for (const t of txns) {
    if (t.type !== "expense" || t.date < from || t.date > to) continue;
    let c = t.category;
    if (buckets) {
      if (c === "EMI" || c === "Subscriptions" || c === "Insurance") c = c === "Subscriptions" ? "Entertainment" : "Other";
      if (!buckets.includes(c)) c = "Other";
    }
    map.set(c, (map.get(c) ?? 0) + t.amount);
  }
  const total = [...map.values()].reduce((a, b) => a + b, 0);
  return [...map.entries()].map(([name, value]) => ({ name, value, pct: safeDiv(value, total) * 100 })).sort((a, b) => b.value - a.value);
}
export function creditUtilization(cards: AppData["cards"]) {
  const limit = cards.reduce((s, c) => s + c.limit, 0);
  const out = cards.reduce((s, c) => s + c.outstanding, 0);
  return { limit, outstanding: out, pct: safeDiv(out, limit) * 100 };
}

// ---------- payments ----------
export type PaymentStatus = "Upcoming" | "Due Soon" | "Overdue" | "Paid";
export function paymentStatus(p: Payment, today: Date): PaymentStatus {
  if (p.paid) return "Paid";
  const diff = differenceInCalendarDays(d(p.dueDate), today);
  if (diff < 0) return "Overdue";
  if (diff <= 7) return "Due Soon";
  return "Upcoming";
}
export function nextDue(date: string, f: Frequency): string {
  const x = d(date);
  switch (f) {
    case "weekly": return iso(addWeeks(x, 1));
    case "monthly": return iso(addMonths(x, 1));
    case "quarterly": return iso(addQuarters(x, 1));
    case "yearly": return iso(addYears(x, 1));
    default: return date;
  }
}
export function upcomingTotal(payments: Payment[], today: Date, days: number) {
  const end = iso(addDays(today, days));
  return payments.filter((p) => !p.paid && p.dueDate <= end).reduce((s, p) => s + p.amount, 0);
}

// ---------- forecast ----------
export interface FEvent { date: string; label: string; amount: number; kind: "income" | "expense" }
export interface FPoint { date: string; balance: number; income: number; expense: number; events: FEvent[] }
export interface ForecastOpts {
  includeIncome?: boolean;
  includeExpenses?: boolean;
  includeVariable?: boolean;
  extraEvents?: FEvent[];
  receivableDelays?: Record<string, number>;
}
export interface Forecast { points: FPoint[]; start: number; end: number; min: number; minDate: string; totalIncome: number; totalExpense: number; events: FEvent[] }

const VARIABLE = new Set(["Food", "Transport", "Shopping", "Entertainment", "Healthcare", "Other", "Marketing", "Supplier"]);
export function dailyVariableSpend(txns: Transaction[], today: Date) {
  const from = iso(subDays(today, 90));
  const ti = iso(today);
  const total = txns.filter((t) => t.type === "expense" && VARIABLE.has(t.category) && t.date > from && t.date <= ti).reduce((s, t) => s + t.amount, 0);
  return Math.round(total / 90);
}

export function scheduledEvents(data: AppData, mode: Mode, today: Date, days: number, opts: ForecastOpts = {}): FEvent[] {
  const first = addDays(today, 1);
  const end = addDays(today, days);
  const fi = iso(first), ei = iso(end);
  const ev: FEvent[] = [];
  if (opts.includeExpenses !== false) {
    for (const p of byMode(data.payments, mode)) {
      if (p.paid) continue;
      let due = p.dueDate;
      let guard = 0;
      while (due <= ei && guard++ < 200) {
        ev.push({ date: due < fi ? fi : due, label: p.name, amount: p.amount, kind: "expense" });
        if (p.frequency === "one-time") break;
        due = nextDue(due, p.frequency);
      }
    }
  }
  if (opts.includeIncome !== false) {
    for (const inc of byMode(data.incomes, mode)) {
      for (let m = 0; m <= Math.ceil(days / 28) + 1; m++) {
        const base = startOfMonth(addMonths(today, m));
        const dt = iso(setDate(base, Math.min(inc.dayOfMonth, getDaysInMonth(base))));
        if (dt >= fi && dt <= ei) ev.push({ date: dt, label: inc.name, amount: inc.amount, kind: "income" });
      }
    }
    if (mode === "business") {
      for (const r of data.receivables) {
        if (r.status === "received") continue;
        const delay = (opts.receivableDelays?.[r.id] ?? 0) + (r.status === "delayed" ? r.delayDays : 0);
        let dt = iso(addDays(d(r.expectedDate), delay));
        if (dt < fi) dt = fi;
        if (dt <= ei) ev.push({ date: dt, label: `${r.customer} (${r.invoice})`, amount: r.amount, kind: "income" });
      }
    }
  }
  for (const e of opts.extraEvents ?? []) if (e.date >= fi && e.date <= ei && e.amount > 0) ev.push(e);
  return ev.sort((a, b) => a.date.localeCompare(b.date));
}

export function forecast(data: AppData, mode: Mode, today: Date, days: number, opts: ForecastOpts = {}): Forecast {
  const days_ = Math.max(1, Math.min(400, Math.round(safeNum(days))));
  const start = currentBalance(data, mode, today);
  const events = scheduledEvents(data, mode, today, days_, opts);
  const variable = opts.includeVariable === false || opts.includeExpenses === false ? 0 : dailyVariableSpend(byMode(data.transactions, mode), today);
  const byDate = new Map<string, FEvent[]>();
  for (const e of events) byDate.set(e.date, [...(byDate.get(e.date) ?? []), e]);
  let bal = start;
  let min = start, minDate = iso(today), tin = 0, tex = 0;
  const points: FPoint[] = [{ date: iso(today), balance: start, income: 0, expense: 0, events: [] }];
  for (let i = 1; i <= days_; i++) {
    const di = iso(addDays(today, i));
    const evs = byDate.get(di) ?? [];
    const income = evs.filter((e) => e.kind === "income").reduce((s, e) => s + e.amount, 0);
    const expense = evs.filter((e) => e.kind === "expense").reduce((s, e) => s + e.amount, 0) + variable;
    bal += income - expense;
    tin += income; tex += expense;
    if (bal < min) { min = bal; minDate = di; }
    points.push({ date: di, balance: Math.round(bal), income, expense, events: evs });
  }
  return { points, start, end: Math.round(bal), min: Math.round(min), minDate, totalIncome: tin, totalExpense: tex, events };
}

export function historicalBalance(data: AppData, mode: Mode, today: Date, days: number) {
  const txns = byMode(data.transactions, mode);
  const cur = currentBalance(data, mode, today);
  const out: { date: string; balance: number }[] = [];
  for (let i = days; i >= 0; i--) {
    const di = iso(subDays(today, i));
    const after = txns.filter((t) => t.date > di && t.date <= iso(today)).reduce((s, t) => s + signed(t), 0);
    out.push({ date: di, balance: cur - after });
  }
  return out;
}

export function balanceOn(fc: Forecast, date: string) {
  let last = fc.points[0]?.balance ?? 0;
  for (const p of fc.points) { if (p.date > date) break; last = p.balance; }
  return last;
}

// ---------- risk ----------
export function classifyRisk(minBalance: number, reserve: number, headroomPct: number): Risk {
  if (minBalance < 0 || minBalance < reserve * 0.5) return "high";
  if (minBalance < reserve * (1 + headroomPct / 100)) return "medium";
  return "low";
}
export const RISK_LABEL: Record<Risk, string> = { low: "Appears Affordable", medium: "Consider Waiting", high: "High Cash-Flow Risk" };
export const RISK_SHORT: Record<Risk, string> = { low: "Low risk", medium: "Medium risk", high: "High risk" };

// ---------- EMI ----------
export function emiInstallment(principal: number, annualRatePct: number, months: number) {
  const n = Math.max(1, Math.round(safeNum(months)));
  const P = Math.max(0, safeNum(principal));
  const r = safeNum(annualRatePct) / 12 / 100;
  if (r <= 0) return P / n;
  const f = Math.pow(1 + r, n);
  return safeNum((P * r * f) / (f - 1));
}

// ---------- purchase analysis ----------
export interface PurchaseInput {
  name: string;
  amount: number;
  date: string;
  method: PayMethod;
  category?: string;
  discount?: number;
  reward?: number;
  emiMonths?: number;
  emiRate?: number;
  fees?: number;
  reserveOverride?: number;
  extraEvents?: FEvent[];
}
export interface PurchaseResult {
  input: PurchaseInput;
  price: number;
  totalCost: number;
  installment: number;
  balanceBefore: number;
  balanceAfterPurchase: number;
  balanceAfterObligations: number;
  minAfter: number;
  minDate: string;
  reserve: number;
  reserveHeadroom: number;
  obligations: FEvent[];
  obligationsTotal: number;
  utilBefore: number;
  utilAfter: number | null;
  risk: Risk;
  label: string;
  explanation: string;
  reasons: string[];
  series: { date: string; base: number; withPurchase: number }[];
}

export function purchaseEvents(input: PurchaseInput, data: AppData): { events: FEvent[]; total: number; installment: number; price: number } {
  const price = Math.max(0, safeNum(input.amount) - safeNum(input.discount ?? 0));
  const fees = Math.max(0, safeNum(input.fees ?? 0));
  const label = input.name || "Planned purchase";
  if (input.method === "emi") {
    const months = Math.max(1, Math.round(safeNum(input.emiMonths ?? 6)));
    const inst = emiInstallment(price, input.emiRate ?? 0, months);
    const events: FEvent[] = Array.from({ length: months }, (_, i) => ({ date: iso(addMonths(d(input.date), i + 1)), label: `${label} EMI ${i + 1}/${months}`, amount: Math.round(inst), kind: "expense" as const }));
    if (fees) events.push({ date: input.date, label: `${label} processing fee`, amount: fees, kind: "expense" });
    return { events, total: inst * months + fees, installment: inst, price };
  }
  if (input.method === "credit") {
    const card = data.cards[0];
    const pd = d(input.date);
    let due = setDate(pd, card?.dueDay ?? 15);
    if (due <= pd) due = addMonths(due, 1);
    if (differenceInCalendarDays(due, pd) < 20) due = addMonths(due, 1);
    return { events: [{ date: iso(due), label: `${label} (card bill)`, amount: price + fees, kind: "expense" }], total: price + fees, installment: 0, price };
  }
  return { events: [{ date: input.date, label, amount: price + fees, kind: "expense" }], total: price + fees, installment: 0, price };
}

export function analyzePurchase(data: AppData, mode: Mode, input: PurchaseInput, today: Date): PurchaseResult {
  const pd = d(input.date);
  const offset = Math.max(1, differenceInCalendarDays(pd, today));
  const horizon = Math.min(400, offset + 60 + (input.method === "emi" ? Math.round(safeNum(input.emiMonths ?? 0)) * 30 : 0));
  const { settings } = data;
  const reserve = input.reserveOverride ?? settings.finance[mode].reserve;
  const pe = purchaseEvents(input, data);
  const base = forecast(data, mode, today, horizon, { extraEvents: input.extraEvents ?? [] });
  const withP = forecast(data, mode, today, horizon, { extraEvents: [...(input.extraEvents ?? []), ...pe.events] });
  const dayBefore = iso(subDays(pd, 1));
  const after30 = iso(addDays(pd, 30));
  const fromPurchase = withP.points.filter((p) => p.date >= input.date);
  let minAfter = Infinity, minDate = input.date;
  for (const p of fromPurchase) if (p.balance < minAfter) { minAfter = p.balance; minDate = p.date; }
  if (!Number.isFinite(minAfter)) minAfter = withP.end;
  const obligations = base.events.filter((e) => e.kind === "expense" && e.date >= input.date && e.date <= after30);
  const obligationsTotal = obligations.reduce((s, e) => s + e.amount, 0);
  const cu = creditUtilization(data.cards);
  const utilAfter = input.method === "credit" ? safeDiv(cu.outstanding + pe.price, cu.limit) * 100 : null;
  let risk = classifyRisk(minAfter, reserve, settings.headroomPct);
  const reasons: string[] = [];
  if (utilAfter !== null) {
    if (utilAfter > 80) risk = "high";
    else if (utilAfter > 50 && risk === "low") risk = "medium";
    reasons.push(`Credit utilization would rise from ${cu.pct.toFixed(0)}% to ${utilAfter.toFixed(0)}% until the card bill is paid.`);
  }
  const balanceBefore = balanceOn(withP, dayBefore);
  const balanceAfterPurchase = balanceOn(withP, input.date);
  const balanceAfterObligations = balanceOn(withP, after30);
  const big = [...obligations].sort((a, b) => b.amount - a.amount).slice(0, 3);
  if (big.length) reasons.push(`Known obligations in the 30 days after the purchase total ₹${Math.round(obligationsTotal).toLocaleString("en-IN")}, led by ${big.map((b) => b.label).join(", ")}.`);
  reasons.push(`Lowest projected balance after buying is ₹${Math.round(minAfter).toLocaleString("en-IN")} on ${format(d(minDate), "dd MMM")}, versus a reserve of ₹${reserve.toLocaleString("en-IN")}.`);
  if (input.method === "emi") reasons.push(`EMI of ≈₹${Math.round(pe.installment).toLocaleString("en-IN")}/month for ${input.emiMonths} months at ${input.emiRate ?? 0}% p.a. (reducing balance); total interest ≈₹${Math.round(pe.total - pe.price - (input.fees ?? 0)).toLocaleString("en-IN")}.`);
  if ((input.reward ?? 0) > 0) reasons.push(`Expected rewards of ₹${input.reward} reduce the effective cost but are not counted as cash inflow.`);
  const explanation =
    risk === "low"
      ? `Your projected balance stays above your emergency reserve after this purchase and the obligations that follow it.`
      : risk === "medium"
        ? `Your balance appears sufficient, but upcoming obligations would leave limited headroom above your ₹${reserve.toLocaleString("en-IN")} reserve. Consider waiting until after your next income.`
        : `This purchase would push your projected balance ${minAfter < 0 ? "below zero" : "well below your emergency reserve"}. Waiting or reducing the amount is safer.`;
  const series = withP.points.map((p, i) => ({ date: p.date, base: base.points[i]?.balance ?? p.balance, withPurchase: p.balance }));
  return {
    input, price: pe.price, totalCost: pe.total - safeNum(input.reward ?? 0), installment: pe.installment,
    balanceBefore, balanceAfterPurchase, balanceAfterObligations, minAfter, minDate, reserve,
    reserveHeadroom: minAfter - reserve, obligations, obligationsTotal,
    utilBefore: cu.pct, utilAfter, risk, label: RISK_LABEL[risk], explanation, reasons, series,
  };
}

// ---------- when should I buy ----------
export interface Candidate { date: string; balanceAfter: number; obligations: number; minBalance: number; headroom: number; risk: Risk; explanation: string }
export interface TimingInput { amount: number; earliest: string; latest: string; reserve: number; priority: "high" | "normal" | "low"; extraIncomes: { date: string; amount: number }[]; name?: string }
export function evaluateDates(data: AppData, mode: Mode, input: TimingInput, today: Date): { candidates: Candidate[]; recommended: Candidate | null; error?: string } {
  const e = d(input.earliest), l = d(input.latest);
  if (!isValid(e) || !isValid(l)) return { candidates: [], recommended: null, error: "Enter valid dates." };
  if (l < e) return { candidates: [], recommended: null, error: "Latest date must be on or after the earliest date." };
  if (differenceInCalendarDays(e, today) < 0) return { candidates: [], recommended: null, error: "Earliest date cannot be in the past." };
  if (!(input.amount > 0)) return { candidates: [], recommended: null, error: "Amount must be greater than zero." };
  const span = differenceInCalendarDays(l, e);
  const step = Math.max(1, Math.ceil(span / 9));
  const dates: string[] = [];
  for (let i = 0; i <= span; i += step) dates.push(iso(addDays(e, i)));
  if (dates[dates.length - 1] !== input.latest) dates.push(input.latest);
  const extraEvents: FEvent[] = input.extraIncomes.filter((x) => x.amount > 0 && x.date).map((x) => ({ date: x.date, amount: x.amount, label: "Expected income (user)", kind: "income" }));
  const evalEnd = iso(addDays(l, 30));
  const candidates = dates.map((date) => {
    const r = analyzePurchase(data, mode, { name: input.name ?? "Purchase", amount: input.amount, date, method: "debit", reserveOverride: input.reserve, extraEvents }, today);
    const windowMin = Math.min(...r.series.filter((p) => p.date >= date && p.date <= evalEnd).map((p) => p.withPurchase));
    const minBalance = Number.isFinite(windowMin) ? windowMin : r.minAfter;
    const risk = classifyRisk(minBalance, input.reserve, data.settings.headroomPct);
    const explanation = risk === "low"
      ? `Balance stays ₹${Math.round(minBalance - input.reserve).toLocaleString("en-IN")} above reserve.`
      : risk === "medium"
        ? `Leaves limited headroom; low point ₹${Math.round(minBalance).toLocaleString("en-IN")}.`
        : `Low point ₹${Math.round(minBalance).toLocaleString("en-IN")} breaches reserve.`;
    return { date, balanceAfter: r.balanceAfterPurchase, obligations: r.obligationsTotal, minBalance, headroom: minBalance - input.reserve, risk, explanation };
  });
  const ok = candidates.filter((c) => c.risk !== "high");
  let recommended: Candidate | null = null;
  const first = ok[0];
  if (first) {
    const lows = ok.filter((c) => c.risk === "low");
    const pool = lows.length ? lows : ok;
    recommended = input.priority === "high" ? first : pool.reduce((best, c) => (c.headroom > best.headroom + 1 ? c : best), pool[0] ?? first);
  }
  return { candidates, recommended };
}

// ---------- what-if simulator ----------
export function simulate(data: AppData, mode: Mode, s: SimInputs, today: Date, days = 90) {
  const baseReserve = data.settings.finance[mode].reserve;
  const baseline = forecast(data, mode, today, days);
  const extra: FEvent[] = [];
  if (s.purchaseAmount > 0) extra.push({ date: s.purchaseDate, label: "Planned purchase", amount: s.purchaseAmount, kind: "expense" });
  if (s.incomeAmount > 0) extra.push({ date: s.incomeDate, label: "Additional income", amount: s.incomeAmount, kind: "income" });
  if (s.extraExpense > 0) extra.push({ date: s.extraExpenseDate, label: "Additional expense", amount: s.extraExpense, kind: "expense" });
  const delays = mode === "business" && s.delayedReceivableId && s.delayDays > 0 ? { [s.delayedReceivableId]: s.delayDays } : undefined;
  const modified = forecast(data, mode, today, days, { extraEvents: extra, ...(delays ? { receivableDelays: delays } : {}) });
  const breaches = (f: Forecast, r: number) => f.points.filter((p) => p.balance < r).length;
  const summary = (f: Forecast, r: number) => ({ end: f.end, min: f.min, minDate: f.minDate, income: f.totalIncome, expense: f.totalExpense, breaches: breaches(f, r), risk: classifyRisk(f.min, r, data.settings.headroomPct) });
  return {
    baseline: summary(baseline, baseReserve),
    modified: summary(modified, s.reserve),
    series: baseline.points.map((p, i) => ({ date: p.date, baseline: p.balance, modified: modified.points[i]?.balance ?? p.balance })),
  };
}

// ---------- goals ----------
export function goalProgress(g: Goal, today: Date) {
  const pct = Math.max(0, safeDiv(g.saved, g.target) * 100);
  const remaining = Math.max(0, g.target - g.saved);
  const months = Math.max(0, differenceInCalendarDays(d(g.targetDate), today) / 30.44);
  const required = remaining === 0 ? 0 : months < 1 ? remaining : remaining / months;
  const achievable = remaining === 0 || g.monthly >= required - 0.5;
  return { pct, pctCapped: Math.min(100, pct), remaining, months: Math.ceil(months), required: Math.ceil(safeNum(required)), achievable };
}

// ---------- insights ----------
export type Severity = "high" | "medium" | "low";
export interface Insight { id: string; type: "spending" | "cashflow" | "payments" | "subscriptions" | "credit" | "savings" | "receivables"; severity: Severity; title: string; explanation: string; metric: string; action: string; link: string }

export function insights(data: AppData, mode: Mode, today: Date): Insight[] {
  const txns = byMode(data.transactions, mode);
  const ti = iso(today);
  const out: Insight[] = [];
  const reserve = data.settings.finance[mode].reserve;
  const fmt = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

  // 1. category trend: last 30 days vs average of prior 90
  const recent = spendingByCategory(txns, iso(subDays(today, 29)), ti);
  const prior = spendingByCategory(txns, iso(subDays(today, 119)), iso(subDays(today, 30)));
  for (const r of recent) {
    const p = prior.find((x) => x.name === r.name);
    const avg = p ? p.value / 3 : 0;
    if (avg > 500 && r.value > avg * 1.15) {
      out.push({ id: `trend-${mode}-${r.name}`, type: "spending", severity: r.value > avg * 1.4 ? "medium" : "low", title: `${r.name} spending is higher than your recent average`, explanation: `Last 30 days: ${fmt(r.value)} vs a prior 30-day average of ${fmt(avg)} (+${Math.round(safeDiv(r.value - avg, avg) * 100)}%).`, metric: fmt(r.value - avg), action: "Review these transactions", link: "/transactions" });
    }
  }
  // 2. payment concentration
  const ups = byMode(data.payments, mode).filter((p) => !p.paid && p.dueDate >= ti && p.dueDate <= iso(addDays(today, 30))).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  for (const up of ups) {
    const wEnd = iso(addDays(d(up.dueDate), 6));
    const inWeek = ups.filter((p) => p.dueDate >= up.dueDate && p.dueDate <= wEnd);
    const big = inWeek.filter((p) => p.amount >= (mode === "business" ? 10000 : 1000));
    if (big.length >= 3) {
      const sum = big.reduce((s, p) => s + p.amount, 0);
      out.push({ id: `conc-${mode}-${up.dueDate}`, type: "payments", severity: "medium", title: `${big.length} obligations fall within the same week`, explanation: `${big.map((p) => p.name).join(", ")} are due between ${format(d(up.dueDate), "dd MMM")} and ${format(d(wEnd), "dd MMM")}.`, metric: fmt(sum), action: "Review upcoming payments", link: "/payments" });
      break;
    }
  }
  // 3. low projected balance
  const fc = forecast(data, mode, today, 60);
  if (fc.min < reserve) {
    out.push({ id: `low-${mode}-${fc.minDate}`, type: "cashflow", severity: fc.min < reserve * 0.5 ? "high" : "medium", title: mode === "business" ? "Projected cash shortage below reserve" : "Projected balance may fall below your emergency reserve", explanation: `The simulated forecast reaches ${fmt(fc.min)} on ${format(d(fc.minDate), "dd MMM")}, below your configured reserve of ${fmt(reserve)}.`, metric: fmt(reserve - fc.min), action: "Open cash-flow forecast", link: "/forecast" });
  } else {
    out.push({ id: `buffer-${mode}`, type: "cashflow", severity: "low", title: "Projected balance stays above your reserve", explanation: `The lowest simulated balance in the next 60 days is ${fmt(fc.min)} on ${format(d(fc.minDate), "dd MMM")}, ${fmt(fc.min - reserve)} above reserve.`, metric: fmt(fc.min), action: "View forecast", link: "/forecast" });
  }
  // 4. subscriptions
  const last30exp = totalIn(txns, "expense", iso(subDays(today, 29)), ti);
  const subs = txns.filter((t) => t.type === "expense" && (t.category === "Subscriptions" || t.category === "Software") && t.date >= iso(subDays(today, 29)) && t.date <= ti).reduce((s, t) => s + t.amount, 0);
  if (subs > 0) out.push({ id: `subs-${mode}`, type: "subscriptions", severity: "low", title: "Recurring subscriptions overview", explanation: `Subscriptions cost ${fmt(subs)} in the last 30 days — ${(safeDiv(subs, last30exp) * 100).toFixed(1)}% of expenses (${fmt(subs * 12)} per year).`, metric: fmt(subs), action: "Review recurring payments", link: "/payments" });
  // 5. large expenses
  const large = txns.filter((t) => t.type === "expense" && t.date >= iso(subDays(today, 29)) && t.date <= ti && !["Housing", "EMI", "Salaries", "Rent"].includes(t.category) && t.amount >= (mode === "business" ? 25000 : 5000));
  for (const t of large.slice(0, 2)) out.push({ id: `large-${t.id}`, type: "spending", severity: "low", title: `Large expense: ${t.description}`, explanation: `A one-off expense of ${fmt(t.amount)} on ${format(d(t.date), "dd MMM")} in ${t.category}.`, metric: fmt(t.amount), action: "View transactions", link: "/transactions" });
  // 6. credit utilization
  if (mode === "personal" && data.cards.length) {
    const cu = creditUtilization(data.cards);
    if (cu.pct > 30) out.push({ id: `credit-${Math.round(cu.pct)}`, type: "credit", severity: cu.pct > 60 ? "high" : "medium", title: "Credit utilization is above 30%", explanation: `${fmt(cu.outstanding)} outstanding on ${fmt(cu.limit)} of limits.`, metric: `${cu.pct.toFixed(0)}%`, action: "Manage cards", link: "/settings" });
    else out.push({ id: `credit-ok`, type: "credit", severity: "low", title: "Credit utilization is healthy", explanation: `${fmt(cu.outstanding)} outstanding across ${data.cards.length} cards (${cu.pct.toFixed(0)}% of limits).`, metric: `${cu.pct.toFixed(0)}%`, action: "Manage cards", link: "/settings" });
  }
  // 7. savings-rate trend
  const m = lastMonths(txns, today, 3);
  const prev = m[0];
  const last = m[1];
  if (prev && last && prev.income > 0 && last.income > 0) {
    const delta = last.savingsRate - prev.savingsRate;
    out.push({ id: `sav-${mode}-${last.label}`, type: "savings", severity: delta < -5 ? "medium" : "low", title: delta >= 0 ? `Savings rate improved in ${last.label}` : `Savings rate dropped in ${last.label}`, explanation: `${last.label}: ${last.savingsRate.toFixed(0)}% vs ${prev.label}: ${prev.savingsRate.toFixed(0)}% of income saved.`, metric: `${delta >= 0 ? "+" : ""}${delta.toFixed(0)} pts`, action: "Review financial goals", link: "/goals" });
  }
  // 8. receivables
  if (mode === "business") {
    const delayed = data.receivables.filter((r) => r.status === "delayed");
    if (delayed.length) {
      const sum = delayed.reduce((s, r) => s + r.amount, 0);
      out.push({ id: `rcv-${delayed.map((r) => r.id).join("")}`, type: "receivables", severity: "medium", title: `${delayed.length} customer payment${delayed.length > 1 ? "s are" : " is"} delayed`, explanation: `${delayed.map((r) => `${r.customer} (${r.invoice})`).join(", ")} — delays push expected cash later in the forecast.`, metric: fmt(sum), action: "Manage receivables", link: "/payments" });
    }
  }
  return out;
}

export { iso };
