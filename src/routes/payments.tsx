import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Check, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { pageHead } from "@/lib/meta";
import { useApp, useModeData } from "@/lib/store";
import { paymentStatus, upcomingTotal } from "@/lib/finance";
import { PAYMENT_CATEGORIES, type Frequency, type Payment } from "@/lib/types";
import { fmtDate, formatINR, iso, uid } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ConfirmDialog, EmptyState, Field, Money, PageHeader, Panel, StatCard, StatusBadge } from "@/components/app/bits";
import { useMarkPaid } from "./dashboard";
import { CalendarClock, CircleAlert, Wallet } from "lucide-react";

export const Route = createFileRoute("/payments")({
  head: () => pageHead("Upcoming Payments", "Scheduled bills, EMIs and obligations with due dates and status."),
  component: PaymentsPage,
});

const FREQS: Frequency[] = ["one-time", "weekly", "monthly", "quarterly", "yearly"];

function PaymentsPage() {
  const { update, today } = useApp();
  const md = useModeData();
  const markPaid = useMarkPaid();
  const [addOpen, setAddOpen] = useState(false);
  const [delId, setDelId] = useState<string | null>(null);

  const rows = useMemo(() => [...md.payments].sort((a, b) => (a.paid === b.paid ? a.dueDate.localeCompare(b.dueDate) : a.paid ? 1 : -1)), [md.payments]);
  const due7 = upcomingTotal(md.payments, today, 7);
  const due30 = upcomingTotal(md.payments, today, 30);
  const overdue = md.payments.filter((p) => paymentStatus(p, today) === "Overdue").length;

  return (
    <div>
      <PageHeader title="Upcoming Payments" subtitle="Recurring and one-time obligations for this mode" actions={<Button onClick={() => setAddOpen(true)}><Plus className="size-4" /> Add Payment</Button>} />

      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <StatCard label="Due in 7 days" value={formatINR(due7)} icon={CalendarClock} t="warning" />
        <StatCard label="Due in 30 days" value={formatINR(due30)} icon={Wallet} t="forecast" />
        <StatCard label="Overdue items" value={String(overdue)} icon={CircleAlert} t={overdue ? "expense" : "neutral"} />
      </div>

      <Panel>
        {rows.length === 0 ? <EmptyState title="No payments scheduled" body="Add rent, EMIs, subscriptions or supplier payments to track them here." /> : (
          <ul className="divide-y">
            {rows.map((p) => (
              <li key={p.id} className="flex items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{p.name}</div>
                  <div className="text-xs text-muted-foreground">{fmtDate(p.dueDate, md.settings.dateFormat)} · {p.category} · {p.frequency === "one-time" ? "One-time" : p.frequency}</div>
                </div>
                <div className="text-right">
                  <Money value={p.amount} className="text-sm" />
                  <div><StatusBadge status={paymentStatus(p, today)} /></div>
                </div>
                {!p.paid && <Button size="icon" variant="ghost" aria-label={`Mark ${p.name} as paid`} onClick={() => markPaid(p.id)}><Check className="size-4 text-income" /></Button>}
                <Button size="icon" variant="ghost" aria-label={`Delete ${p.name}`} onClick={() => setDelId(p.id)}><Trash2 className="size-4 text-muted-foreground" /></Button>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <AddPayment open={addOpen} onOpenChange={setAddOpen} />
      <ConfirmDialog open={delId !== null} onOpenChange={(o) => !o && setDelId(null)} title="Delete payment?" body="This scheduled payment will be removed from forecasts." onConfirm={() => {
        update((d) => ({ ...d, payments: d.payments.filter((p) => p.id !== delId) }));
        setDelId(null);
        toast.success("Payment deleted");
      }} />
    </div>
  );
}

function AddPayment({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { update, today, mode, data } = useApp();
  const [f, setF] = useState({ name: "", amount: "", dueDate: iso(today), category: "Rent", frequency: "monthly" as Frequency, accountId: data.settings.defaultAccount[mode] });
  const [err, setErr] = useState("");

  const submit = () => {
    const amount = Number(f.amount);
    if (!f.name.trim()) return setErr("Enter a name.");
    if (!(amount > 0)) return setErr("Amount must be greater than zero.");
    if (!f.dueDate) return setErr("Pick a due date.");
    const p: Payment = { id: uid("p"), mode, name: f.name.trim(), amount, dueDate: f.dueDate, category: f.category, frequency: f.frequency, accountId: f.accountId, paid: false };
    update((d) => ({ ...d, payments: [p, ...d.payments] }));
    toast.success("Payment scheduled");
    setErr("");
    setF({ ...f, name: "", amount: "" });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Schedule a payment</DialogTitle></DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2"><Field label="Name" htmlFor="p-name"><Input id="p-name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="e.g. Office rent" /></Field></div>
          <Field label="Amount (₹)" htmlFor="p-amt"><Input id="p-amt" type="number" min="0" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></Field>
          <Field label="Due date" htmlFor="p-date"><Input id="p-date" type="date" value={f.dueDate} onChange={(e) => setF({ ...f, dueDate: e.target.value })} /></Field>
          <Field label="Category">
            <Select value={f.category} onValueChange={(v) => setF({ ...f, category: v })}>
              <SelectTrigger aria-label="Category"><SelectValue /></SelectTrigger>
              <SelectContent>{PAYMENT_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Frequency">
            <Select value={f.frequency} onValueChange={(v) => setF({ ...f, frequency: v as Frequency })}>
              <SelectTrigger aria-label="Frequency"><SelectValue /></SelectTrigger>
              <SelectContent>{FREQS.map((fr) => <SelectItem key={fr} value={fr}>{fr}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Account">
            <Select value={f.accountId} onValueChange={(v) => setF({ ...f, accountId: v })}>
              <SelectTrigger aria-label="Account"><SelectValue /></SelectTrigger>
              <SelectContent>{data.accounts.filter((a) => a.mode === mode).map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
        </div>
        {err && <p className="text-xs text-expense">{err}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit}>Schedule</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
