import { useMemo, useState, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard, ArrowLeftRight, LineChart, CalendarClock, ShoppingCart, CalendarCheck, FlaskConical,
  Lightbulb, Target, Settings, Bell, Menu, Search, BrainCircuit, User, Building2, RotateCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useApp } from "@/lib/store";
import { insights, paymentStatus } from "@/lib/finance";
import { formatINR } from "@/lib/format";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "./bits";
import { toast } from "sonner";

export const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/transactions", label: "Transactions", icon: ArrowLeftRight },
  { to: "/forecast", label: "Cash Flow Forecast", icon: LineChart },
  { to: "/payments", label: "Upcoming Payments", icon: CalendarClock },
  { to: "/purchase-analyzer", label: "Purchase Analyzer", icon: ShoppingCart },
  { to: "/when-to-buy", label: "When Should I Buy?", icon: CalendarCheck },
  { to: "/simulator", label: "What-If Simulator", icon: FlaskConical },
  { to: "/insights", label: "Financial Insights", icon: Lightbulb },
  { to: "/goals", label: "Financial Goals", icon: Target },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

function SidebarBody({ onNavigate }: { onNavigate?: () => void }) {
  const { pathname } = useLocation();
  const { mode, setMode, data } = useApp();
  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex items-center gap-3 px-5 py-5">
        <div className="grid size-10 place-items-center rounded-xl bg-primary/15 text-primary">
          <BrainCircuit className="size-5" />
        </div>
        <div>
          <div className="font-semibold leading-tight">SmartSpend AI</div>
          <div className="text-xs text-muted-foreground">Spend Smart, Stay Ahead</div>
        </div>
      </div>
      <div className="px-4 pb-4">
        <div className="grid grid-cols-2 gap-1 rounded-lg border border-sidebar-border bg-input-bg p-1" role="radiogroup" aria-label="Finance mode">
          {([["personal", "Personal", User], ["business", "Business", Building2]] as const).map(([m, l, I]) => (
            <button key={m} role="radio" aria-checked={mode === m} onClick={() => { setMode(m); toast.success(`Switched to ${m === "personal" ? "Personal Finance" : "Small Business"} mode`); }}
              className={cn("flex items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium transition-colors", mode === m ? "bg-sidebar-accent text-foreground" : "text-muted-foreground hover:text-foreground")}>
              <I className="size-3.5" />{l}
            </button>
          ))}
        </div>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3">
        {NAV.map((n) => {
          const active = pathname.startsWith(n.to);
          return (
            <Link key={n.to} to={n.to} onClick={onNavigate}
              className={cn("relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors", active ? "bg-sidebar-accent text-foreground" : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground")}>
              {active && <span className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-primary" />}
              <n.icon className={cn("size-4", active && "text-primary")} />
              {n.label}
            </Link>
          );
        })}
      </nav>
      <div className="m-3 flex items-center gap-3 rounded-xl border border-sidebar-border p-3">
        <div className="grid size-9 place-items-center rounded-full bg-ai/20 text-sm font-semibold text-ai">
          {data.settings.name.split(" ").map((x) => x[0]).join("").slice(0, 2)}
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">{data.settings.name}</div>
          <div className="text-xs text-warning">Demo Account</div>
        </div>
      </div>
    </div>
  );
}

function Notifications() {
  const { data, mode, today, update } = useApp();
  const items = useMemo(() => {
    const n = data.settings.notifications;
    const out: { id: string; title: string; body: string; link: string }[] = [];
    if (n.bills) for (const p of data.payments.filter((p) => p.mode === mode)) {
      const s = paymentStatus(p, today);
      if (s === "Due Soon" || s === "Overdue") out.push({ id: `n-${p.id}-${p.dueDate}`, title: `${p.name} — ${s}`, body: `${formatINR(p.amount)} due ${p.dueDate}`, link: "/payments" });
    }
    for (const i of insights(data, mode, today)) {
      if (i.severity === "low") continue;
      if (i.type === "cashflow" && !n.lowBalance) continue;
      if (i.type === "credit" && !n.credit) continue;
      out.push({ id: `n-${i.id}`, title: i.title, body: i.explanation, link: i.link });
    }
    return out;
  }, [data, mode, today]);
  const unread = items.filter((i) => !data.readNotifications.includes(i.id)).length;
  const markAll = () => update((d) => ({ ...d, readNotifications: [...new Set([...d.readNotifications, ...items.map((i) => i.id)])] }));
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={`Notifications, ${unread} unread`}>
          <Bell className="size-4" />
          {unread > 0 && <span className="num absolute -right-0.5 -top-0.5 grid min-w-4 place-items-center rounded-full bg-expense px-1 text-[10px] font-semibold text-primary-foreground">{unread}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <span className="text-sm font-semibold">Notifications</span>
          <button className="text-xs text-primary hover:underline disabled:opacity-50" disabled={!unread} onClick={markAll}>Mark all read</button>
        </div>
        <div className="max-h-80 overflow-y-auto">
          {items.length === 0 && <p className="p-4 text-sm text-muted-foreground">You're all caught up.</p>}
          {items.map((i) => (
            <Link key={i.id} to={i.link} onClick={() => update((d) => ({ ...d, readNotifications: [...new Set([...d.readNotifications, i.id])] }))} className="block border-b px-4 py-3 last:border-0 hover:bg-accent">
              <div className="flex items-start gap-2">
                {!data.readNotifications.includes(i.id) && <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />}
                <div>
                  <div className="text-sm font-medium">{i.title}</div>
                  <div className="line-clamp-2 text-xs text-muted-foreground">{i.body}</div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [mobile, setMobile] = useState(false);
  const [cmd, setCmd] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { mode, resetDemo, ready } = useApp();
  const current = NAV.find((n) => pathname.startsWith(n.to));

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-r border-sidebar-border lg:block">
        <SidebarBody />
      </aside>
      <Sheet open={mobile} onOpenChange={setMobile}>
        <SheetContent side="left" className="w-72 border-sidebar-border p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SidebarBody onNavigate={() => setMobile(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b bg-background/85 px-4 backdrop-blur sm:px-6">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobile(true)} aria-label="Open navigation"><Menu className="size-5" /></Button>
          <div className="min-w-0">
            <div className="text-xs text-muted-foreground">SmartSpend / {mode === "personal" ? "Personal" : "Business"}</div>
            <div className="truncate text-sm font-semibold">{current?.label ?? "SmartSpend AI"}</div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button onClick={() => setCmd(true)} className="hidden items-center gap-2 rounded-lg border bg-input-bg px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground md:flex">
              <Search className="size-3.5" /> Quick navigation…
            </button>
            <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setCmd(true)} aria-label="Quick navigation"><Search className="size-4" /></Button>
            <span className="hidden rounded-full border border-warning/40 px-2.5 py-0.5 text-xs font-medium text-warning sm:inline">Demo Data</span>
            <Notifications />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Profile menu"><User className="size-4" /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel>Demo account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate({ to: "/settings" })}><Settings className="size-4" /> Settings</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setConfirmReset(true)}><RotateCcw className="size-4" /> Reset demo data</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 sm:px-6 lg:px-8">
          {ready ? children : <div className="grid h-64 place-items-center text-sm text-muted-foreground">Loading demo data…</div>}
        </main>
        <footer className="px-6 pb-6 text-center text-xs text-muted-foreground">
          All figures are fictional demo data. Projections are rule-based simulations, not financial advice.
        </footer>
      </div>

      <CommandDialog open={cmd} onOpenChange={setCmd}>
        <CommandInput placeholder="Jump to a page…" />
        <CommandList>
          <CommandEmpty>No pages found.</CommandEmpty>
          <CommandGroup heading="Pages">
            {NAV.map((n) => (
              <CommandItem key={n.to} onSelect={() => { setCmd(false); navigate({ to: n.to }); }}>
                <n.icon className="size-4" /> {n.label}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
      <ConfirmDialog open={confirmReset} onOpenChange={setConfirmReset} title="Reset demo data?" body="All demo records will return to their original values. Your changes and saved scenarios will be lost." confirmLabel="Reset" onConfirm={() => { resetDemo(); toast.success("Demo data reset"); }} />
    </div>
  );
}
