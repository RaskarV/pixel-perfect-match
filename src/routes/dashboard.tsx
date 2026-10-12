import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { format, parseISO, startOfMonth, endOfMonth } from "date-fns";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Wallet, TrendingUp, TrendingDown, LineChart as LineIcon, Sparkles, ArrowRight, Check } from "lucide-react";
import { toast } from "sonner";
import { pageHead } from "@/lib/meta";
import { useApp, useModeData } from "@/lib/store";
import { balanceOn, creditUtilization, currentBalance, forecast, historicalBalance, insights, lastMonths, monthStats, nextDue, paymentStatus, spendingByCategory, upcomingTotal } from "@/lib/finance";
import { DONUT_CATEGORIES } from "@/lib/types";
import { formatINR, formatINRCompact, fmtDate, iso, uid } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { C, ChartTip, Money, Panel, Pill, RangeTabs, StatCard, StatusBadge, EmptyState } from "@/components/app/bits";

export const Route = createFileRoute("/dashboard")({
  head: () => pageHead("Dashboard", "Your financial outlook: balance, simulated cash-flow forecast, upcoming payments and insights."),
  component: Dashboard,
});

function greeting(d: Date) {
  const h = d.getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export function useMarkPaid() {
  const { update, today } = useApp();
  return (id: string) => {
    update((d) => {
      const p = d.payments.find((x) => x.id === id);
      if (!p || p.paid) return d;
      const txnId = uid("t");
      const txn = { id: txnId, mode: p.mode, date: iso(today), description: p.name, amount: p.amount, type: "expense" as const, category: catFor(p.category, p.mode), accountId: p.accountId, method: "Net Banking", notes: "Recorded from Upcoming Payments" };
      const payments = d.payments.map((x) => (x.id !== id ? x : p.frequency === "one-time" ? { ...x, paid: true, paidTxnId: txnId } : { ...x, dueDate: nextDue(x.dueDate, x.frequency) }));
      return { ...d, transactions: [txn, ...d.transactions], payments };
    });
    toast.success("Payment marked as paid and recorded as a transaction");
  };
}
export function catFor(c: string, mode: string) {
  if (mode === "business") return ({ Rent: "Rent", Salaries: "Salaries", Supplier: "Supplier", Taxes: "Taxes", Subscriptions: "Software" } as Record<string, string>)[c] ?? "Other";
  return ({ Rent: "Housing", EMI: "EMI", "Credit Card": "Other", Insurance: "Insurance", Utilities: "Utilities", Subscriptions: "Subscriptions" } as Record<string, string>)[c] ?? "Other";
}

function Dashboard() {
  const { data, mode, today } = useApp();
  const md = useModeData();
  const markPaid = useMarkPaid();
  const [range, setRange] = useState<7 | 30 | 60 | 90>(30);
  const ms = monthStats(md.transactions, today);
  const bal = currentBalance(data, mode, today);
  const monthEnd = iso(endOfMonth(today));
  const fcMonth = forecast(data, mode, today, Math.max(1, Math.round((endOfMonth(today).getTime() - today.getTime()) / 864e5)));
  const projectedMonthEnd = balanceOn(fcMonth, monthEnd);

  const chart = useMemo(() => {
    const hist = historicalBalance(data, mode, today, range);
    const fc = forecast(data, mode, today, range);
    const rows = hist.map((h) => ({ date: h.date, actual: h.balance as number | null, projected: null as number | null }));
    rows[rows.length - 1].projected = rows[rows.length - 1].actual;
    for (const p of fc.points.slice(1)) rows.push({ date: p.date, actual: null, projected: p.balance });
    return rows;
  }, [data, mode, today, range]);

  const months = lastMonths(md.transactions, today, 6);
  const cats = spendingByCategory(md.transactions, iso(startOfMonth(today)), iso(today), mode === "personal" ? DONUT_CATEGORIES : undefined);
  const catTotal = cats.reduce((s, c) => s + c.value, 0);
  const upcoming = [...md.payments].filter((p) => !p.paid).sort((a, b) => a.dueDate.localeCompare(b.dueDate)).slice(0, 5);
  const recent = [...md.transactions].filter((t) => t.date <= iso(today)).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
  const fc60 = forecast(data, mode, today, 60);
  const up30 = upcomingTotal(md.payments, today, 30);
  const cu = creditUtilization(data.cards);
  const topInsight = insights(data, mode, today).filter((i) => !data.dismissedInsights.includes(i.id)).sort((a, b) => ({ high: 0, medium: 1, low: 2 })[a.severity] - ({ high: 0, medium: 1, low: 2 })[b.severity])[0];
  const pf = (s: string) => fmtDate(s, md.settings.dateFormat);
  const accName = (id: string) => data.accounts.find((a) => a.id === id)?.name ?? "—";
  const top3 = upcoming.slice(0, 3);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{greeting(today)}, {md.settings.name.split(" ")[0]}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "business" ? "Nimbus Digital Studio — here's your business cash outlook." : "Here's your financial outlook and what deserves your attention."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-lg border bg-input-bg px-3 py-2 text-xs text-muted-foreground">{format(today, "EEEE, dd MMM yyyy")}</span>
          <Button asChild><Link to="/purchase-analyzer">Analyze a Purchase <ArrowRight className="size-4" /></Link></Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={mode === "business" ? "Cash Available" : "Current Balance"} value={formatINR(bal)} icon={Wallet} t="ai" hint="Across tracked accounts" />
        <StatCard label="Income This Month" value={formatINR(ms.income)} icon={TrendingUp} t="income" valueTone="income" hint={`${format(today, "MMMM")} to date`} />
        <StatCard label="Expenses This Month" value={formatINR(ms.expense)} icon={TrendingDown} t="expense" valueTone="expense" hint={`Budget ${formatINR(md.finance.budget)} · ${Math.round((ms.expense / Math.max(1, md.finance.budget)) * 100)}% used`} />
        <StatCard label="Projected Month-End" value={formatINR(projectedMonthEnd)} icon={LineIcon} t="forecast" valueTone="forecast"
          hint={<span className={projectedMonthEnd >= bal ? "text-income" : "text-expense"}>{projectedMonthEnd >= bal ? "▲" : "▼"} {formatINR(Math.abs(projectedMonthEnd - bal))} vs today · simulated</span>} />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Panel className="xl:col-span-2" title="Cash-flow overview" subtitle="Actual balance and simulated forecast (rule-based, not a trained model)" actions={<RangeTabs value={range} options={[7, 30, 60, 90] as const as unknown as (7 | 30 | 60 | 90)[]} onChange={setRange} />}>
          <div className="h-72">
            <ResponsiveContainer>
              <AreaChart data={chart} margin={{ left: 0, right: 8, top: 8 }}>
                <defs>
                  <linearGradient id="gA" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.income} stopOpacity={0.3} /><stop offset="100%" stopColor={C.income} stopOpacity={0} /></linearGradient>
                  <linearGradient id="gF" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.forecast} stopOpacity={0.25} /><stop offset="100%" stopColor={C.forecast} stopOpacity={0} /></linearGradient>
                </defs>
                <CartesianGrid stroke={C.grid} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tickFormatter={(v) => format(parseISO(v), "dd MMM")} stroke={C.axis} fontSize={11} minTickGap={30} />
                <YAxis tickFormatter={(v) => formatINRCompact(v)} stroke={C.axis} fontSize={11} width={64} />
                <Tooltip content={<ChartTip labelFmt={(l) => format(parseISO(l), "dd MMM yyyy")} />} />
                <ReferenceLine x={iso(today)} stroke={C.axis} strokeDasharray="4 4" label={{ value: "Today", fill: C.axis, fontSize: 11, position: "top" }} />
                <ReferenceLine y={md.finance.reserve} stroke={C.warning} strokeDasharray="2 4" />
                <Area type="monotone" dataKey="actual" name="Actual balance" stroke={C.income} fill="url(#gA)" strokeWidth={2} connectNulls={false} />
                <Area type="monotone" dataKey="projected" name="Simulated forecast" stroke={C.forecast} fill="url(#gF)" strokeWidth={2} strokeDasharray="5 4" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <div className="ai-surface flex flex-col p-5">
          <div className="flex items-center gap-2 text-ai"><Sparkles className="size-4" /><span className="text-sm font-semibold">SmartSpend insight</span></div>
          {topInsight ? (
            <>
              <p className="mt-3 text-base font-medium">{topInsight.title}</p>
              <p className="mt-2 text-sm text-muted-foreground">{topInsight.explanation}</p>
              {top3.length > 0 && (
                <div className="mt-4 rounded-lg border border-ai/20 bg-background/40 p-3 text-xs">
                  <div className="mb-2 text-muted-foreground">Records considered</div>
                  {top3.map((p) => (
                    <div key={p.id} className="flex justify-between py-0.5"><span>{p.name} · {pf(p.dueDate)}</span><span className="num">{formatINR(p.amount)}</span></div>
                  ))}
                  <div className="mt-1 flex justify-between border-t border-ai/20 pt-1"><span>Emergency reserve</span><span className="num">{formatINR(md.finance.reserve)}</span></div>
                </div>
              )}
            </>
          ) : <p className="mt-3 text-sm text-muted-foreground">No active insights.</p>}
          <div className="mt-auto flex flex-wrap gap-2 pt-4">
            <Button size="sm" variant="outline" asChild><Link to="/forecast">View Cash Flow</Link></Button>
            <Button size="sm" asChild><Link to="/purchase-analyzer">Analyze Purchase</Link></Button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Panel className="xl:col-span-2" title="Income vs expenses" subtitle="Last six months">
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={months}>
                <CartesianGrid stroke={C.grid} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" stroke={C.axis} fontSize={11} />
                <YAxis tickFormatter={(v) => formatINRCompact(v)} stroke={C.axis} fontSize={11} width={64} />
                <Tooltip cursor={{ fill: "var(--accent)", opacity: 0.4 }} content={<ChartTip />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="income" name="Income" fill={C.income} radius={[4, 4, 0, 0]} />
                <Bar dataKey="expense" name="Expenses" fill={C.expense} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel title="Spending by category" subtitle="This month">
          {cats.length === 0 ? <EmptyState title="No expenses this month" /> : (
            <>
              <div className="relative h-44">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={cats} dataKey="value" nameKey="name" innerRadius={52} outerRadius={78} paddingAngle={2} stroke="none">
                      {cats.map((c, i) => <Cell key={c.name} fill={C.cats[i % C.cats.length]} />)}
                    </Pie>
                    <Tooltip content={<ChartTip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
                  <div><div className="text-xs text-muted-foreground">Total</div><div className="num text-sm font-semibold">{formatINR(catTotal)}</div></div>
                </div>
              </div>
              <ul className="mt-3 space-y-1.5 text-xs">
                {cats.map((c, i) => (
                  <li key={c.name} className="flex items-center gap-2">
                    <span className="size-2 rounded-full" style={{ background: C.cats[i % C.cats.length] }} />
                    <span>{c.name}</span>
                    <span className="ml-auto text-muted-foreground">{c.pct.toFixed(0)}%</span>
                    <span className="num w-20 text-right">{formatINR(c.value)}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Panel title="Upcoming payments" actions={<Link to="/payments" className="text-xs text-primary hover:underline">View all</Link>}>
          {upcoming.length === 0 ? <EmptyState title="Nothing scheduled" /> : (
            <ul className="divide-y">
              {upcoming.map((p) => (
                <li key={p.id} className="flex items-center gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{p.name}</div>
                    <div className="text-xs text-muted-foreground">{pf(p.dueDate)} · {p.category}</div>
                  </div>
                  <div className="text-right">
                    <Money value={p.amount} className="text-sm" />
                    <div><StatusBadge status={paymentStatus(p, today)} /></div>
                  </div>
                  <Button size="icon" variant="ghost" aria-label={`Mark ${p.name} as paid`} onClick={() => markPaid(p.id)}><Check className="size-4 text-income" /></Button>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Recent transactions" actions={<Link to="/transactions" className="text-xs text-primary hover:underline">View All Transactions</Link>}>
          <ul className="divide-y">
            {recent.map((t) => (
              <li key={t.id} className="flex items-center gap-3 py-2.5">
                <span className={`grid size-8 place-items-center rounded-lg ${t.type === "income" ? "bg-income/12 text-income" : "bg-expense/12 text-expense"}`}>
                  {t.type === "income" ? <TrendingUp className="size-4" /> : <TrendingDown className="size-4" />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{t.description}</div>
                  <div className="truncate text-xs text-muted-foreground">{t.category} · {pf(t.date)} · {t.method}</div>
                </div>
                <Money value={t.amount} type={t.type} className="text-sm" />
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="Financial health snapshot" subtitle="Calculated from demo records">
          <dl className="space-y-3 text-sm">
            <Row k="Savings rate (this month)" v={`${ms.savingsRate.toFixed(0)}%`} tone={ms.savingsRate >= 20 ? "income" : "warning"} />
            <Row k="Upcoming obligations (30 days)" v={formatINR(up30)} tone="warning" />
            {mode === "personal" && <Row k="Credit utilization" v={`${cu.pct.toFixed(0)}%`} tone={cu.pct > 30 ? "warning" : "income"} />}
            <Row k="Projected minimum (60 days)" v={formatINR(fc60.min)} tone={fc60.min < md.finance.reserve ? "expense" : "forecast"} sub={pf(fc60.minDate)} />
            <Row k="Emergency reserve" v={formatINR(md.finance.reserve)} />
            <Row k="Accounts" v={md.accounts.map((a) => a.name).length.toString()} sub={accName(md.settings.defaultAccount[mode])} />
          </dl>
        </Panel>
      </div>
    </div>
  );
}

function Row({ k, v, tone, sub }: { k: string; v: string; tone?: "income" | "expense" | "warning" | "forecast"; sub?: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-muted-foreground">{k}{sub && <div className="text-xs">{sub}</div>}</dt>
      <dd>{tone ? <Pill t={tone}><span className="num">{v}</span></Pill> : <span className="num font-medium">{v}</span>}</dd>
    </div>
  );
}
