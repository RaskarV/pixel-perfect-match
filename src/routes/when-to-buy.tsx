import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { addDays } from "date-fns";
import { CalendarCheck, Plus, Trash2 } from "lucide-react";
import { pageHead } from "@/lib/meta";
import { useApp, useModeData } from "@/lib/store";
import { evaluateDates, type Candidate } from "@/lib/finance";
import { fmtDate, formatINR, iso } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState, Field, PageHeader, Panel, RiskBadge } from "@/components/app/bits";

export const Route = createFileRoute("/when-to-buy")({
  head: () => pageHead("When Should I Buy?", "Compare candidate purchase dates and find the safest day to buy."),
  component: WhenToBuy,
});

function WhenToBuy() {
  const { data, mode, today } = useApp();
  const md = useModeData();
  const [f, setF] = useState({ name: "", amount: "", earliest: iso(today), latest: iso(addDays(today, 45)), reserve: String(md.finance.reserve), priority: "normal" as "high" | "normal" | "low" });
  const [extras, setExtras] = useState<{ date: string; amount: string }[]>([]);
  const [err, setErr] = useState("");
  const [out, setOut] = useState<{ candidates: Candidate[]; recommended: Candidate | null } | null>(null);

  const run = () => {
    const amount = Number(f.amount);
    if (!(amount > 0)) return setErr("Amount must be greater than zero.");
    const r = evaluateDates(data, mode, {
      name: f.name || "Purchase", amount, earliest: f.earliest, latest: f.latest,
      reserve: Number(f.reserve) || 0, priority: f.priority,
      extraIncomes: extras.map((x) => ({ date: x.date, amount: Number(x.amount) || 0 })),
    }, today);
    if (r.error) return setErr(r.error);
    setErr("");
    setOut(r);
  };

  return (
    <div>
      <PageHeader title="When Should I Buy?" subtitle="Evaluates candidate dates between two bounds and recommends the safest one" />
      <div className="grid gap-4 xl:grid-cols-3">
        <Panel title="Timing window" className="xl:col-span-1">
          <div className="space-y-4">
            <Field label="Purchase name" htmlFor="wb-name"><Input id="wb-name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="e.g. New phone" /></Field>
            <Field label="Amount (₹)" htmlFor="wb-amt"><Input id="wb-amt" type="number" min="0" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Earliest date" htmlFor="wb-e"><Input id="wb-e" type="date" value={f.earliest} onChange={(e) => setF({ ...f, earliest: e.target.value })} /></Field>
              <Field label="Latest date" htmlFor="wb-l"><Input id="wb-l" type="date" value={f.latest} onChange={(e) => setF({ ...f, latest: e.target.value })} /></Field>
            </div>
            <Field label="Emergency reserve to protect (₹)" htmlFor="wb-res"><Input id="wb-res" type="number" min="0" value={f.reserve} onChange={(e) => setF({ ...f, reserve: e.target.value })} /></Field>
            <Field label="Priority" hint="High priority picks the earliest safe date; otherwise the date with the most headroom wins.">
              <Select value={f.priority} onValueChange={(v) => setF({ ...f, priority: v as "high" | "normal" | "low" })}>
                <SelectTrigger aria-label="Priority"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">High — buy as early as safe</SelectItem>
                  <SelectItem value="normal">Normal — best headroom</SelectItem>
                  <SelectItem value="low">Low — best headroom</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Expected extra income (optional)</span>
                <Button size="sm" variant="ghost" onClick={() => setExtras([...extras, { date: iso(addDays(today, 10)), amount: "" }])}><Plus className="size-3.5" /> Add</Button>
              </div>
              {extras.map((x, i) => (
                <div key={i} className="mb-2 flex items-center gap-2">
                  <Input type="date" value={x.date} onChange={(e) => setExtras(extras.map((y, j) => (j === i ? { ...y, date: e.target.value } : y)))} aria-label={`Extra income ${i + 1} date`} />
                  <Input type="number" min="0" placeholder="₹" value={x.amount} onChange={(e) => setExtras(extras.map((y, j) => (j === i ? { ...y, amount: e.target.value } : y)))} aria-label={`Extra income ${i + 1} amount`} />
                  <Button size="icon" variant="ghost" aria-label={`Remove extra income ${i + 1}`} onClick={() => setExtras(extras.filter((_, j) => j !== i))}><Trash2 className="size-4 text-muted-foreground" /></Button>
                </div>
              ))}
            </div>
            {err && <p className="text-xs text-expense">{err}</p>}
            <Button className="w-full" onClick={run}><CalendarCheck className="size-4" /> Find the best date</Button>
          </div>
        </Panel>

        <div className="xl:col-span-2">
          {!out ? (
            <Panel><p className="py-10 text-center text-sm text-muted-foreground">Set an amount and a date window to compare candidate purchase days.</p></Panel>
          ) : out.candidates.length === 0 ? (
            <EmptyState title="No viable dates" body="Every date in the window breaches your reserve. Try a later window or a smaller amount." />
          ) : (
            <Panel title="Candidate dates" subtitle={out.recommended ? `Recommended: ${fmtDate(out.recommended.date, md.settings.dateFormat)}` : "No date clears the risk bar"}>
              <ul className="divide-y">
                {out.candidates.map((c) => (
                  <li key={c.date} className={`flex items-center gap-3 py-3 ${out.recommended?.date === c.date ? "rounded-lg bg-ai/8 px-2" : ""}`}>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium">{fmtDate(c.date, md.settings.dateFormat)}{out.recommended?.date === c.date && <span className="ml-2 text-xs font-semibold text-ai">Recommended</span>}</div>
                      <div className="text-xs text-muted-foreground">{c.explanation}</div>
                    </div>
                    <div className="hidden text-right text-xs text-muted-foreground sm:block">
                      <div>Low point <span className="num">{formatINR(c.minBalance)}</span></div>
                      <div>Obligations <span className="num">{formatINR(c.obligations)}</span></div>
                    </div>
                    <RiskBadge risk={c.risk} short />
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}
