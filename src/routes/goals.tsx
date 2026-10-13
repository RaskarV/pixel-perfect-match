import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Target, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { pageHead } from "@/lib/meta";
import { useApp, useModeData } from "@/lib/store";
import { goalProgress } from "@/lib/finance";
import type { Goal } from "@/lib/types";
import { fmtDate, formatINR, iso, uid } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { ConfirmDialog, EmptyState, Field, PageHeader, Panel, Pill } from "@/components/app/bits";

export const Route = createFileRoute("/goals")({
  head: () => pageHead("Financial Goals", "Savings goals with progress, required monthly saving and feasibility."),
  component: GoalsPage,
});

function GoalsPage() {
  const { update, today } = useApp();
  const md = useModeData();
  const [addOpen, setAddOpen] = useState(false);
  const [delId, setDelId] = useState<string | null>(null);

  return (
    <div>
      <PageHeader title="Financial Goals" subtitle="Track targets and whether your planned monthly saving gets you there on time" actions={<Button onClick={() => setAddOpen(true)}><Plus className="size-4" /> Add Goal</Button>} />
      {md.goals.length === 0 ? <EmptyState title="No goals yet" body="Add a savings goal to see required monthly contributions." /> : (
        <div className="grid gap-4 lg:grid-cols-2">
          {md.goals.map((g) => {
            const p = goalProgress(g, today);
            return (
              <Panel key={g.id}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="grid size-8 place-items-center rounded-lg bg-forecast/12 text-forecast"><Target className="size-4" /></span>
                    <div>
                      <h3 className="text-base font-semibold">{g.name}</h3>
                      <p className="text-xs text-muted-foreground">Target {fmtDate(g.targetDate, md.settings.dateFormat)} · {p.months} months left</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Pill t={p.achievable ? "income" : "warning"}>{p.achievable ? "On track" : "Behind"}</Pill>
                    <Button size="icon" variant="ghost" aria-label={`Delete goal ${g.name}`} onClick={() => setDelId(g.id)}><Trash2 className="size-4 text-muted-foreground" /></Button>
                  </div>
                </div>
                <div className="mt-4 flex items-baseline justify-between text-sm">
                  <span className="num font-semibold">{formatINR(g.saved)} <span className="text-xs font-normal text-muted-foreground">of {formatINR(g.target)}</span></span>
                  <span className="num text-muted-foreground">{p.pct.toFixed(0)}%</span>
                </div>
                <Progress value={p.pctCapped} className="mt-2" />
                <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div><dt className="text-xs text-muted-foreground">Remaining</dt><dd className="num font-medium">{formatINR(p.remaining)}</dd></div>
                  <div><dt className="text-xs text-muted-foreground">Required / month</dt><dd className="num font-medium">{formatINR(p.required)}</dd></div>
                  <div><dt className="text-xs text-muted-foreground">Planned / month</dt><dd className="num font-medium">{formatINR(g.monthly)}</dd></div>
                  <div><dt className="text-xs text-muted-foreground">Shortfall / month</dt><dd className={`num font-medium ${p.achievable ? "text-income" : "text-warning"}`}>{formatINR(Math.max(0, p.required - g.monthly))}</dd></div>
                </dl>
              </Panel>
            );
          })}
        </div>
      )}

      <AddGoal open={addOpen} onOpenChange={setAddOpen} />
      <ConfirmDialog open={delId !== null} onOpenChange={(o) => !o && setDelId(null)} title="Delete goal?" body="The goal and its progress will be removed." onConfirm={() => {
        update((d) => ({ ...d, goals: d.goals.filter((g) => g.id !== delId) }));
        setDelId(null);
        toast.success("Goal deleted");
      }} />
    </div>
  );
}

function AddGoal({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { update, mode } = useApp();
  const [f, setF] = useState({ name: "", target: "", saved: "", targetDate: "", monthly: "" });
  const [err, setErr] = useState("");

  const submit = () => {
    const target = Number(f.target);
    if (!f.name.trim()) return setErr("Enter a name.");
    if (!(target > 0)) return setErr("Target must be greater than zero.");
    if (!f.targetDate) return setErr("Pick a target date.");
    const g: Goal = { id: uid("g"), mode, name: f.name.trim(), target, saved: Math.max(0, Number(f.saved) || 0), targetDate: f.targetDate, monthly: Math.max(0, Number(f.monthly) || 0) };
    update((d) => ({ ...d, goals: [g, ...d.goals] }));
    toast.success("Goal added");
    setErr("");
    setF({ name: "", target: "", saved: "", targetDate: "", monthly: "" });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Add a goal</DialogTitle></DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2"><Field label="Name" htmlFor="g-name"><Input id="g-name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="e.g. Europe trip" /></Field></div>
          <Field label="Target amount (₹)" htmlFor="g-target"><Input id="g-target" type="number" min="0" value={f.target} onChange={(e) => setF({ ...f, target: e.target.value })} /></Field>
          <Field label="Saved so far (₹)" htmlFor="g-saved"><Input id="g-saved" type="number" min="0" value={f.saved} onChange={(e) => setF({ ...f, saved: e.target.value })} /></Field>
          <Field label="Target date" htmlFor="g-date"><Input id="g-date" type="date" value={f.targetDate} onChange={(e) => setF({ ...f, targetDate: e.target.value })} /></Field>
          <Field label="Planned monthly saving (₹)" htmlFor="g-monthly"><Input id="g-monthly" type="number" min="0" value={f.monthly} onChange={(e) => setF({ ...f, monthly: e.target.value })} /></Field>
        </div>
        {err && <p className="text-xs text-expense">{err}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit}>Add</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
