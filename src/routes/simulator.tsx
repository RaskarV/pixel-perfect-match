import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { addDays, format, parseISO } from "date-fns";
import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { FlaskConical, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { pageHead } from "@/lib/meta";
import { useApp, useModeData } from "@/lib/store";
import { simulate } from "@/lib/finance";
import type { Scenario, SimInputs } from "@/lib/types";
import { fmtDate, formatINR, formatINRCompact, iso, uid } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { C, ChartTip, Field, PageHeader, Panel, Pill } from "@/components/app/bits";

export const Route = createFileRoute("/simulator")({
  head: () => pageHead("What-If Simulator", "Test purchases, income changes and delayed receivables against your cash-flow forecast."),
  component: Simulator,
});

function Simulator() {
  const { data, mode, today, update } = useApp();
  const md = useModeData();
  const [f, setF] = useState<SimInputs>({
    purchaseAmount: 0, purchaseDate: iso(addDays(today, 7)),
    incomeAmount: 0, incomeDate: iso(addDays(today, 14)),
    extraExpense: 0, extraExpenseDate: iso(addDays(today, 21)),
    reserve: md.finance.reserve, delayedReceivableId: "", delayDays: 0,
  });
  const res = useMemo(() => simulate(data, mode, f, today), [data, mode, f, today]);
  const scenarios = data.scenarios.filter((s) => s.mode === mode);
  const openReceivables = data.receivables.filter((r) => r.status !== "received");

  const saveScenario = () => {
    const name = window.prompt("Name this scenario", "My scenario");
    if (!name) return;
    const s: Scenario = { id: uid("s"), name, mode, inputs: f, createdAt: iso(today) };
    update((d) => ({ ...d, scenarios: [s, ...d.scenarios] }));
    toast.success("Scenario saved");
  };

  const num = (v: string) => Number(v) || 0;
  const setNum = (k: keyof SimInputs) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: num(e.target.value) });
  const setDateF = (k: keyof SimInputs) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  return (
    <div>
      <PageHeader title="What-If Simulator" subtitle="Layer hypothetical events over the next 90 days and compare against the baseline" />
      <div className="grid gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-1">
          <Panel title="Hypothetical events">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Planned purchase (₹)" htmlFor="s-pa"><Input id="s-pa" type="number" min="0" value={f.purchaseAmount || ""} onChange={setNum("purchaseAmount")} /></Field>
                <Field label="On date" htmlFor="s-pd"><Input id="s-pd" type="date" value={f.purchaseDate} onChange={setDateF("purchaseDate")} /></Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Extra income (₹)" htmlFor="s-ia"><Input id="s-ia" type="number" min="0" value={f.incomeAmount || ""} onChange={setNum("incomeAmount")} /></Field>
                <Field label="On date" htmlFor="s-id"><Input id="s-id" type="date" value={f.incomeDate} onChange={setDateF("incomeDate")} /></Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Extra expense (₹)" htmlFor="s-ea"><Input id="s-ea" type="number" min="0" value={f.extraExpense || ""} onChange={setNum("extraExpense")} /></Field>
                <Field label="On date" htmlFor="s-ed"><Input id="s-ed" type="date" value={f.extraExpenseDate} onChange={setDateF("extraExpenseDate")} /></Field>
              </div>
              <Field label="Reserve to protect (₹)" htmlFor="s-res"><Input id="s-res" type="number" min="0" value={f.reserve || ""} onChange={setNum("reserve")} /></Field>
              {mode === "business" && openReceivables.length > 0 && (
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Delay a receivable">
                    <Select value={f.delayedReceivableId || "none"} onValueChange={(v) => setF({ ...f, delayedReceivableId: v === "none" ? "" : v })}>
                      <SelectTrigger aria-label="Receivable to delay"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {openReceivables.map((r) => <SelectItem key={r.id} value={r.id}>{r.customer} ({r.invoice})</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Delay by (days)" htmlFor="s-dd"><Input id="s-dd" type="number" min="0" value={f.delayDays || ""} onChange={setNum("delayDays")} /></Field>
                </div>
              )}
              <Button variant="outline" className="w-full" onClick={saveScenario}><Save className="size-4" /> Save scenario</Button>
            </div>
          </Panel>
          {scenarios.length > 0 && (
            <Panel title="Saved scenarios">
              <ul className="divide-y">
                {scenarios.map((s) => (
                  <li key={s.id} className="flex items-center gap-2 py-2.5">
                    <button className="min-w-0 flex-1 truncate text-left text-sm hover:text-primary" onClick={() => { setF(s.inputs); toast.success(`Loaded "${s.name}"`); }}>{s.name}</button>
                    <Button size="icon" variant="ghost" aria-label={`Delete scenario ${s.name}`} onClick={() => update((d) => ({ ...d, scenarios: d.scenarios.filter((x) => x.id !== s.id) }))}><Trash2 className="size-4 text-muted-foreground" /></Button>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </div>

        <div className="space-y-4 xl:col-span-2">
          <div className="grid gap-4 sm:grid-cols-2">
            <Summary title="Baseline (no changes)" s={res.baseline} reserve={md.finance.reserve} df={md.settings.dateFormat} />
            <Summary title="With your changes" s={res.modified} reserve={f.reserve} df={md.settings.dateFormat} />
          </div>
          <Panel title="Baseline vs scenario" subtitle="Simulated daily balance over 90 days">
            <div className="h-72">
              <ResponsiveContainer>
                <AreaChart data={res.series} margin={{ left: 0, right: 8, top: 8 }}>
                  <CartesianGrid stroke={C.grid} strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" tickFormatter={(v) => format(parseISO(v), "dd MMM")} stroke={C.axis} fontSize={11} minTickGap={30} />
                  <YAxis tickFormatter={(v) => formatINRCompact(v)} stroke={C.axis} fontSize={11} width={64} />
                  <Tooltip content={<ChartTip labelFmt={(l) => format(parseISO(l), "dd MMM yyyy")} />} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Area type="monotone" dataKey="baseline" name="Baseline" stroke={C.income} fill="none" strokeWidth={2} />
                  <Area type="monotone" dataKey="modified" name="Scenario" stroke={C.forecast} fill="none" strokeWidth={2} strokeDasharray="5 4" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function Summary({ title, s, reserve, df }: { title: string; s: { end: number; min: number; minDate: string; income: number; expense: number; breaches: number; risk: "low" | "medium" | "high" }; reserve: number; df: string }) {
  return (
    <Panel title={title}>
      <dl className="space-y-2 text-sm">
        <div className="flex justify-between"><dt className="text-muted-foreground">End balance (90d)</dt><dd className="num font-medium">{formatINR(s.end)}</dd></div>
        <div className="flex justify-between"><dt className="text-muted-foreground">Lowest point</dt><dd className="num font-medium">{formatINR(s.min)} <span className="text-xs text-muted-foreground">on {fmtDate(s.minDate, df)}</span></dd></div>
        <div className="flex justify-between"><dt className="text-muted-foreground">Income / expense</dt><dd className="num font-medium">{formatINR(s.income)} / {formatINR(s.expense)}</dd></div>
        <div className="flex justify-between"><dt className="text-muted-foreground">Days below reserve ({formatINR(reserve)})</dt><dd className="num font-medium">{s.breaches}</dd></div>
        <div className="flex justify-between"><dt className="text-muted-foreground">Risk</dt><dd><Pill t={s.risk === "low" ? "income" : s.risk === "medium" ? "warning" : "expense"}>{s.risk}</Pill></dd></div>
      </dl>
    </Panel>
  );
}
