import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { pageHead } from "@/lib/meta";
import { useApp } from "@/lib/store";
import { formatINR } from "@/lib/format";
import { creditUtilization } from "@/lib/finance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ConfirmDialog, Field, PageHeader, Panel } from "@/components/app/bits";

export const Route = createFileRoute("/settings")({
  head: () => pageHead("Settings", "Profile, budgets, reserves, notification preferences and demo data controls."),
  component: SettingsPage,
});

const DATE_FORMATS = ["dd MMM yyyy", "dd/MM/yyyy", "MM/dd/yyyy"] as const;

function SettingsPage() {
  const { data, update, resetDemo, clearLocal } = useApp();
  const s = data.settings;
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const cu = creditUtilization(data.cards);

  const setS = (fn: (x: typeof s) => typeof s) => update((d) => ({ ...d, settings: fn(d.settings) }));
  const setFin = (mode: "personal" | "business", k: "openingBalance" | "reserve" | "budget", v: number) =>
    setS((x) => ({ ...x, finance: { ...x.finance, [mode]: { ...x.finance[mode], [k]: Math.max(0, v) } } }));
  const save = () => toast.success("Settings saved");

  return (
    <div>
      <PageHeader title="Settings" subtitle="Everything is stored locally in your browser as demo data" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Profile">
          <div className="space-y-4">
            <Field label="Display name" htmlFor="st-name"><Input id="st-name" value={s.name} onChange={(e) => setS((x) => ({ ...x, name: e.target.value }))} /></Field>
            <Field label="Email" htmlFor="st-email"><Input id="st-email" type="email" value={s.email} onChange={(e) => setS((x) => ({ ...x, email: e.target.value }))} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Date format">
                <Select value={s.dateFormat} onValueChange={(v) => setS((x) => ({ ...x, dateFormat: v as typeof s.dateFormat }))}>
                  <SelectTrigger aria-label="Date format"><SelectValue /></SelectTrigger>
                  <SelectContent>{DATE_FORMATS.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Default forecast range">
                <Select value={String(s.forecastDays)} onValueChange={(v) => setS((x) => ({ ...x, forecastDays: Number(v) as typeof s.forecastDays }))}>
                  <SelectTrigger aria-label="Default forecast range"><SelectValue /></SelectTrigger>
                  <SelectContent>{[7, 30, 60, 90].map((n) => <SelectItem key={n} value={String(n)}>{n} days</SelectItem>)}</SelectContent>
                </Select>
              </Field>
            </div>
            <Field label="Low-risk headroom above reserve (%)" htmlFor="st-head" hint="A forecast only counts as low risk if its lowest point stays this far above the reserve.">
              <Input id="st-head" type="number" min="0" max="100" value={s.headroomPct} onChange={(e) => setS((x) => ({ ...x, headroomPct: Math.max(0, Number(e.target.value) || 0) }))} />
            </Field>
            <Button onClick={save}>Save profile</Button>
          </div>
        </Panel>

        <Panel title="Notifications" subtitle="Controls which alerts appear in the bell menu">
          <div className="space-y-3">
            {([["bills", "Bill reminders"], ["lowBalance", "Low projected balance"], ["largePurchase", "Large purchases"], ["credit", "Credit utilization"], ["goals", "Goal progress"]] as const).map(([k, label]) => (
              <label key={k} className="flex items-center justify-between rounded-lg border px-3 py-2.5 text-sm">
                {label}
                <Switch checked={s.notifications[k]} onCheckedChange={(v) => setS((x) => ({ ...x, notifications: { ...x.notifications, [k]: v } }))} aria-label={label} />
              </label>
            ))}
          </div>
        </Panel>

        {(["personal", "business"] as const).map((m) => (
          <Panel key={m} title={m === "personal" ? "Personal finance" : "Business finance"} subtitle="Opening balance, emergency reserve and monthly budget">
            <div className="grid grid-cols-3 gap-3">
              <Field label="Opening balance (₹)" htmlFor={`st-${m}-ob`}><Input id={`st-${m}-ob`} type="number" min="0" value={s.finance[m].openingBalance} onChange={(e) => setFin(m, "openingBalance", Number(e.target.value) || 0)} /></Field>
              <Field label="Reserve (₹)" htmlFor={`st-${m}-res`}><Input id={`st-${m}-res`} type="number" min="0" value={s.finance[m].reserve} onChange={(e) => setFin(m, "reserve", Number(e.target.value) || 0)} /></Field>
              <Field label="Monthly budget (₹)" htmlFor={`st-${m}-bud`}><Input id={`st-${m}-bud`} type="number" min="0" value={s.finance[m].budget} onChange={(e) => setFin(m, "budget", Number(e.target.value) || 0)} /></Field>
            </div>
            <Button className="mt-4" onClick={save}>Save {m} settings</Button>
          </Panel>
        ))}

        <Panel title="Credit cards" subtitle={`Total utilization ${cu.pct.toFixed(0)}% — ${formatINR(cu.outstanding)} of ${formatINR(cu.limit)}`}>
          <ul className="divide-y">
            {data.cards.map((c) => (
              <li key={c.id} className="flex items-center justify-between py-2.5 text-sm">
                <span>{c.name} <span className="text-xs text-muted-foreground">· bill due on the {c.dueDay}th</span></span>
                <span className="num text-muted-foreground">{formatINR(c.outstanding)} / {formatINR(c.limit)}</span>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="Demo data" subtitle="Reset or wipe the locally stored dataset">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setConfirmReset(true)}>Reset to original demo data</Button>
            <Button variant="destructive" onClick={() => setConfirmClear(true)}>Clear local storage</Button>
          </div>
        </Panel>
      </div>

      <ConfirmDialog open={confirmReset} onOpenChange={setConfirmReset} title="Reset demo data?" body="All records return to their original values. Your edits and saved scenarios will be lost." confirmLabel="Reset" onConfirm={() => { resetDemo(); toast.success("Demo data reset"); }} />
      <ConfirmDialog open={confirmClear} onOpenChange={setConfirmClear} title="Clear local storage?" body="Stored data is removed and a fresh demo dataset is generated." confirmLabel="Clear" onConfirm={() => { clearLocal(); toast.success("Local storage cleared"); }} />
    </div>
  );
}
