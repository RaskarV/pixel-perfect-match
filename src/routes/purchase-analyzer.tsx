import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { format, parseISO } from "date-fns";
import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ShoppingCart } from "lucide-react";
import { pageHead } from "@/lib/meta";
import { useApp, useModeData } from "@/lib/store";
import { analyzePurchase, type PurchaseResult } from "@/lib/finance";
import type { PayMethod } from "@/lib/types";
import { fmtDate, formatINR, formatINRCompact, iso } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { C, ChartTip, Field, PageHeader, Panel, RiskBadge } from "@/components/app/bits";

export const Route = createFileRoute("/purchase-analyzer")({
  head: () => pageHead("Purchase Analyzer", "Check whether a planned purchase fits your projected cash flow before you commit."),
  component: PurchaseAnalyzer,
});

function PurchaseAnalyzer() {
  const { data, mode, today } = useApp();
  const md = useModeData();
  const [f, setF] = useState({ name: "", amount: "", date: iso(today), method: "debit" as PayMethod, discount: "", reward: "", fees: "", emiMonths: "6", emiRate: "14" });
  const [err, setErr] = useState("");
  const [result, setResult] = useState<PurchaseResult | null>(null);

  const analyze = () => {
    const amount = Number(f.amount);
    if (!f.name.trim()) return setErr("Name the purchase.");
    if (!(amount > 0)) return setErr("Amount must be greater than zero.");
    if (!f.date) return setErr("Pick a purchase date.");
    setErr("");
    setResult(analyzePurchase(data, mode, {
      name: f.name.trim(), amount, date: f.date, method: f.method,
      discount: Number(f.discount) || 0, reward: Number(f.reward) || 0, fees: Number(f.fees) || 0,
      emiMonths: Number(f.emiMonths) || 6, emiRate: Number(f.emiRate) || 0,
    }, today));
  };

  return (
    <div>
      <PageHeader title="Purchase Analyzer" subtitle="Simulates the purchase against your forecast and grades the cash-flow risk" />
      <div className="grid gap-4 xl:grid-cols-3">
        <Panel title="Purchase details" className="xl:col-span-1">
          <div className="space-y-4">
            <Field label="What are you buying?" htmlFor="pa-name"><Input id="pa-name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="e.g. MacBook Air" /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Price (₹)" htmlFor="pa-amt"><Input id="pa-amt" type="number" min="0" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></Field>
              <Field label="Purchase date" htmlFor="pa-date"><Input id="pa-date" type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
            </div>
            <Field label="Payment method">
              <Select value={f.method} onValueChange={(v) => setF({ ...f, method: v as PayMethod })}>
                <SelectTrigger aria-label="Payment method"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="debit">Debit / UPI (pay now)</SelectItem>
                  <SelectItem value="credit">Credit card (pay at bill)</SelectItem>
                  <SelectItem value="emi">EMI (monthly installments)</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            {f.method === "emi" && (
              <div className="grid grid-cols-2 gap-3">
                <Field label="Months" htmlFor="pa-months"><Input id="pa-months" type="number" min="1" value={f.emiMonths} onChange={(e) => setF({ ...f, emiMonths: e.target.value })} /></Field>
                <Field label="Interest % p.a." htmlFor="pa-rate"><Input id="pa-rate" type="number" min="0" value={f.emiRate} onChange={(e) => setF({ ...f, emiRate: e.target.value })} /></Field>
              </div>
            )}
            <div className="grid grid-cols-3 gap-3">
              <Field label="Discount (₹)" htmlFor="pa-disc"><Input id="pa-disc" type="number" min="0" value={f.discount} onChange={(e) => setF({ ...f, discount: e.target.value })} /></Field>
              <Field label="Rewards (₹)" htmlFor="pa-rew"><Input id="pa-rew" type="number" min="0" value={f.reward} onChange={(e) => setF({ ...f, reward: e.target.value })} /></Field>
              <Field label="Fees (₹)" htmlFor="pa-fee"><Input id="pa-fee" type="number" min="0" value={f.fees} onChange={(e) => setF({ ...f, fees: e.target.value })} /></Field>
            </div>
            {err && <p className="text-xs text-expense">{err}</p>}
            <Button className="w-full" onClick={analyze}><ShoppingCart className="size-4" /> Analyze affordability</Button>
          </div>
        </Panel>

        <div className="space-y-4 xl:col-span-2">
          {!result ? (
            <Panel><p className="py-10 text-center text-sm text-muted-foreground">Fill in the purchase and run the analysis to see the verdict, the reasoning and the balance impact.</p></Panel>
          ) : (
            <>
              <div className="ai-surface p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-lg font-semibold">{result.input.name} — {formatINR(result.price)}</h2>
                  <RiskBadge risk={result.risk} />
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{result.explanation}</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <MiniStat k="Balance before" v={formatINR(result.balanceBefore)} />
                  <MiniStat k="Right after purchase" v={formatINR(result.balanceAfterPurchase)} />
                  <MiniStat k="After 30 days of obligations" v={formatINR(result.balanceAfterObligations)} />
                  <MiniStat k="Lowest projected point" v={formatINR(result.minAfter)} sub={fmtDate(result.minDate, md.settings.dateFormat)} />
                  <MiniStat k="Reserve headroom" v={formatINR(result.reserveHeadroom)} sub={`Reserve ${formatINR(result.reserve)}`} />
                  <MiniStat k="Effective total cost" v={formatINR(result.totalCost)} sub={result.installment > 0 ? `EMI ≈ ${formatINR(result.installment)}/mo` : undefined} />
                </div>
              </div>

              <Panel title="Why this verdict" subtitle="Every factor the rule engine considered">
                <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
                  {result.reasons.map((r, i) => <li key={i}>{r}</li>)}
                </ul>
              </Panel>

              <Panel title="Balance with and without the purchase" subtitle="Simulated projection">
                <div className="h-64">
                  <ResponsiveContainer>
                    <AreaChart data={result.series} margin={{ left: 0, right: 8, top: 8 }}>
                      <CartesianGrid stroke={C.grid} strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="date" tickFormatter={(v) => format(parseISO(v), "dd MMM")} stroke={C.axis} fontSize={11} minTickGap={30} />
                      <YAxis tickFormatter={(v) => formatINRCompact(v)} stroke={C.axis} fontSize={11} width={64} />
                      <Tooltip content={<ChartTip labelFmt={(l) => format(parseISO(l), "dd MMM yyyy")} />} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Area type="monotone" dataKey="base" name="Without purchase" stroke={C.income} fill="none" strokeWidth={2} />
                      <Area type="monotone" dataKey="withPurchase" name="With purchase" stroke={C.forecast} fill="none" strokeWidth={2} strokeDasharray="5 4" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </Panel>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function MiniStat({ k, v, sub }: { k: string; v: string; sub?: string | undefined }) {
  return (
    <div className="rounded-lg border border-ai/20 bg-background/40 p-3">
      <div className="text-xs text-muted-foreground">{k}</div>
      <div className="num mt-0.5 text-sm font-semibold">{v}</div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}
