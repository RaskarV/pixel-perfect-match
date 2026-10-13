import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus, Trash2, TrendingDown, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { pageHead } from "@/lib/meta";
import { useApp, useModeData } from "@/lib/store";
import { BUSINESS_CATEGORIES, PAYMENT_METHODS_TXN, PERSONAL_CATEGORIES, type Transaction, type TxnType } from "@/lib/types";
import { fmtDate, formatINR, iso, uid } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ConfirmDialog, EmptyState, Field, Money, PageHeader, Panel } from "@/components/app/bits";

export const Route = createFileRoute("/transactions")({
  head: () => pageHead("Transactions", "Browse, filter, add and delete income and expense records."),
  component: Transactions,
});

function Transactions() {
  const { update, today } = useApp();
  const md = useModeData();
  const [q, setQ] = useState("");
  const [type, setType] = useState<"all" | TxnType>("all");
  const [cat, setCat] = useState("all");
  const [addOpen, setAddOpen] = useState(false);
  const [delId, setDelId] = useState<string | null>(null);

  const cats = md.mode === "personal" ? PERSONAL_CATEGORIES : BUSINESS_CATEGORIES;
  const rows = useMemo(() => {
    return md.transactions
      .filter((t) => (type === "all" || t.type === type) && (cat === "all" || t.category === cat))
      .filter((t) => !q || t.description.toLowerCase().includes(q.toLowerCase()))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [md.transactions, type, cat, q]);

  const totalIn = rows.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const totalOut = rows.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const accName = (id: string) => md.data.accounts.find((a) => a.id === id)?.name ?? "—";

  return (
    <div>
      <PageHeader title="Transactions" subtitle="Every recorded income and expense in this mode" actions={<Button onClick={() => setAddOpen(true)}><Plus className="size-4" /> Add Transaction</Button>} />

      <Panel>
        <div className="mb-4 flex flex-wrap gap-2">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search description…" className="w-56" aria-label="Search transactions" />
          <Select value={type} onValueChange={(v) => setType(v as "all" | TxnType)}>
            <SelectTrigger className="w-36" aria-label="Filter by type"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="income">Income</SelectItem>
              <SelectItem value="expense">Expense</SelectItem>
            </SelectContent>
          </Select>
          <Select value={cat} onValueChange={setCat}>
            <SelectTrigger className="w-44" aria-label="Filter by category"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {cats.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="ml-auto flex items-center gap-4 text-xs text-muted-foreground">
            <span>In <span className="num font-medium text-income">{formatINR(totalIn)}</span></span>
            <span>Out <span className="num font-medium text-expense">{formatINR(totalOut)}</span></span>
          </div>
        </div>

        {rows.length === 0 ? <EmptyState title="No transactions match" body="Adjust the filters or add a new transaction." /> : (
          <ul className="divide-y">
            {rows.slice(0, 100).map((t) => (
              <li key={t.id} className="flex items-center gap-3 py-2.5">
                <span className={`grid size-8 shrink-0 place-items-center rounded-lg ${t.type === "income" ? "bg-income/12 text-income" : "bg-expense/12 text-expense"}`}>
                  {t.type === "income" ? <TrendingUp className="size-4" /> : <TrendingDown className="size-4" />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{t.description}</div>
                  <div className="truncate text-xs text-muted-foreground">{t.category} · {fmtDate(t.date, md.settings.dateFormat)} · {t.method} · {accName(t.accountId)}</div>
                </div>
                <Money value={t.amount} type={t.type} className="text-sm" />
                <Button size="icon" variant="ghost" aria-label={`Delete ${t.description}`} onClick={() => setDelId(t.id)}><Trash2 className="size-4 text-muted-foreground" /></Button>
              </li>
            ))}
          </ul>
        )}
        {rows.length > 100 && <p className="pt-3 text-center text-xs text-muted-foreground">Showing the 100 most recent of {rows.length} matches.</p>}
      </Panel>

      <AddDialog open={addOpen} onOpenChange={setAddOpen} cats={cats} />
      <ConfirmDialog open={delId !== null} onOpenChange={(o) => !o && setDelId(null)} title="Delete transaction?" body="This record will be removed permanently. Balances and forecasts will update." onConfirm={() => {
        update((d) => ({ ...d, transactions: d.transactions.filter((t) => t.id !== delId) }));
        setDelId(null);
        toast.success("Transaction deleted");
      }} />
    </div>
  );
}

function AddDialog({ open, onOpenChange, cats }: { open: boolean; onOpenChange: (o: boolean) => void; cats: string[] }) {
  const { update, today, mode, data } = useApp();
  const [f, setF] = useState({ description: "", amount: "", type: "expense" as TxnType, category: cats[0] ?? "Other", date: iso(today), method: "UPI", accountId: data.settings.defaultAccount[mode] });
  const [err, setErr] = useState("");

  const submit = () => {
    const amount = Number(f.amount);
    if (!f.description.trim()) return setErr("Enter a description.");
    if (!(amount > 0)) return setErr("Amount must be greater than zero.");
    if (!f.date) return setErr("Pick a date.");
    const txn: Transaction = { id: uid("t"), mode, date: f.date, description: f.description.trim(), amount, type: f.type, category: f.category, accountId: f.accountId, method: f.method };
    update((d) => ({ ...d, transactions: [txn, ...d.transactions] }));
    toast.success("Transaction added");
    setErr("");
    setF({ ...f, description: "", amount: "" });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Add transaction</DialogTitle></DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2"><Field label="Description" htmlFor="tx-desc"><Input id="tx-desc" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="e.g. BigBasket groceries" /></Field></div>
          <Field label="Amount (₹)" htmlFor="tx-amt"><Input id="tx-amt" type="number" min="0" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></Field>
          <Field label="Date" htmlFor="tx-date"><Input id="tx-date" type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
          <Field label="Type">
            <Select value={f.type} onValueChange={(v) => setF({ ...f, type: v as TxnType })}>
              <SelectTrigger aria-label="Type"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="expense">Expense</SelectItem><SelectItem value="income">Income</SelectItem></SelectContent>
            </Select>
          </Field>
          <Field label="Category">
            <Select value={f.category} onValueChange={(v) => setF({ ...f, category: v })}>
              <SelectTrigger aria-label="Category"><SelectValue /></SelectTrigger>
              <SelectContent>{cats.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Payment method">
            <Select value={f.method} onValueChange={(v) => setF({ ...f, method: v })}>
              <SelectTrigger aria-label="Payment method"><SelectValue /></SelectTrigger>
              <SelectContent>{PAYMENT_METHODS_TXN.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
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
          <Button onClick={submit}>Add</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
