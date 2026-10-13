import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CalendarDays, IndianRupee, ShieldAlert, TrendingUp } from "lucide-react";
import { pageHead } from "@/lib/meta";
import { useApp, useModeData } from "@/lib/store";
import { forecast, historicalBalance } from "@/lib/finance";
import { fmtDate, formatINR, formatINRCompact, iso } from "@/lib/format";
import { C, ChartTip, EmptyState, PageHeader, Panel, RangeTabs, StatCard } from "@/components/app/bits";

export const Route = createFileRoute("/forecast")({
  head: () => pageHead("Cash Flow Forecast", "Simulated day-by-day balance projection from scheduled payments, income and typical spending."),
  component: ForecastPage,
});

function ForecastPage() {
  const { data, mode, today } = useApp();
  const md = useModeData();
  const [range, setRange] = useState<7 | 30 | 60 | 90>(md.settings.forecastDays);

  const fc = useMemo(() => forecast(data, mode, today, range), [data, mode, today, range]);
  const hist = useMemo(() => historicalBalance(data, mode, today, Math.min(range, 30)), [data, mode, today, range]);
  const chart = useMemo(() => {
    const rows = hist.map((h) => ({ date: h.date, actual: h.balance as number | null, projected: null as number | null }));
    const lastRow = rows[rows.length - 1];
    if (lastRow) lastRow.projected = lastRow.actual;
    for (const p of fc.points.slice(1)) rows.push({ date: p.date, actual: null, projected: p.balance });
    return rows;
  }, [hist, fc]);

  const belowReserve = fc.points.filter((p) => p.balance < md.finance.reserve).length;
  const upcomingEvents = fc.events.slice(0, 12);

  return (
    <div>
      <PageHeader title="Cash Flow Forecast" subtitle="Rule-based simulation from your scheduled payments, income streams and average daily spending — not a trained model" actions={<RangeTabs value={range} options={[7, 30, 60, 90] as (7 | 30 | 60 | 90)[]} onChange={setRange} />} />

      <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={`Projected in ${range} days`} value={formatINR(fc.end)} icon={TrendingUp} t="forecast" valueTone="forecast" hint="Simulated end balance" />
        <StatCard label="Lowest point" value={formatINR(fc.min)} icon={ShieldAlert} t={fc.min < md.finance.reserve ? "expense" : "income"} hint={fmtDate(fc.minDate, md.settings.dateFormat)} />
        <StatCard label="Expected income" value={formatINR(fc.totalIncome)} icon={IndianRupee} t="income" valueTone="income" hint="Scheduled in the period" />
        <StatCard label="Days below reserve" value={String(belowReserve)} icon={CalendarDays} t={belowReserve ? "warning" : "neutral"} hint={`Reserve ${formatINR(md.finance.reserve)}`} />
      </div>

      <Panel title="Balance projection" subtitle="Solid line is actual history; dashed line is the simulation" className="mb-4">
        <div className="h-80">
          <ResponsiveContainer>
            <AreaChart data={chart} margin={{ left: 0, right: 8, top: 8 }}>
              <defs>
                <linearGradient id="fcA" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.income} stopOpacity={0.3} /><stop offset="100%" stopColor={C.income} stopOpacity={0} /></linearGradient>
                <linearGradient id="fcF" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.forecast} stopOpacity={0.25} /><stop offset="100%" stopColor={C.forecast} stopOpacity={0} /></linearGradient>
              </defs>
              <CartesianGrid stroke={C.grid} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" tickFormatter={(v) => format(parseISO(v), "dd MMM")} stroke={C.axis} fontSize={11} minTickGap={30} />
              <YAxis tickFormatter={(v) => formatINRCompact(v)} stroke={C.axis} fontSize={11} width={64} />
              <Tooltip content={<ChartTip labelFmt={(l) => format(parseISO(l), "dd MMM yyyy")} />} />
              <ReferenceLine x={iso(today)} stroke={C.axis} strokeDasharray="4 4" label={{ value: "Today", fill: C.axis, fontSize: 11, position: "top" }} />
              <ReferenceLine y={md.finance.reserve} stroke={C.warning} strokeDasharray="2 4" label={{ value: "Reserve", fill: C.warning, fontSize: 11, position: "insideBottomRight" }} />
              <Area type="monotone" dataKey="actual" name="Actual balance" stroke={C.income} fill="url(#fcA)" strokeWidth={2} connectNulls={false} />
              <Area type="monotone" dataKey="projected" name="Simulated forecast" stroke={C.forecast} fill="url(#fcF)" strokeWidth={2} strokeDasharray="5 4" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      <Panel title="Scheduled events in this period" subtitle="Payments, income and receivables the simulation counts">
        {upcomingEvents.length === 0 ? <EmptyState title="No scheduled events" body="Add upcoming payments or income streams to enrich the forecast." /> : (
          <ul className="divide-y">
            {upcomingEvents.map((e, i) => (
              <li key={`${e.date}-${e.label}-${i}`} className="flex items-center gap-3 py-2.5">
                <span className={`size-2 shrink-0 rounded-full ${e.kind === "income" ? "bg-income" : "bg-expense"}`} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{e.label}</div>
                  <div className="text-xs text-muted-foreground">{fmtDate(e.date, md.settings.dateFormat)} · {e.kind === "income" ? "Expected income" : "Scheduled expense"}</div>
                </div>
                <span className={`num text-sm font-medium ${e.kind === "income" ? "text-income" : "text-expense"}`}>{e.kind === "income" ? "+" : "−"}{formatINR(e.amount)}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
