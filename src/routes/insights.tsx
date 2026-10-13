import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { Lightbulb, X } from "lucide-react";
import { pageHead } from "@/lib/meta";
import { useApp } from "@/lib/store";
import { insights, type Severity } from "@/lib/finance";
import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader, Panel, Pill } from "@/components/app/bits";

export const Route = createFileRoute("/insights")({
  head: () => pageHead("Financial Insights", "Rule-based observations about spending, cash flow, payments and credit."),
  component: InsightsPage,
});

const sevTone: Record<Severity, "expense" | "warning" | "neutral"> = { high: "expense", medium: "warning", low: "neutral" };
const order: Record<Severity, number> = { high: 0, medium: 1, low: 2 };

function InsightsPage() {
  const { data, mode, today, update } = useApp();
  const all = useMemo(() => insights(data, mode, today).sort((a, b) => order[a.severity] - order[b.severity]), [data, mode, today]);
  const active = all.filter((i) => !data.dismissedInsights.includes(i.id));
  const dismissed = all.filter((i) => data.dismissedInsights.includes(i.id));

  const dismiss = (id: string) => update((d) => ({ ...d, dismissedInsights: [...new Set([...d.dismissedInsights, id])] }));
  const restore = (id: string) => update((d) => ({ ...d, dismissedInsights: d.dismissedInsights.filter((x) => x !== id) }));

  return (
    <div>
      <PageHeader title="Financial Insights" subtitle="Deterministic, rule-based observations generated from your demo records — each shows the data behind it" />
      {active.length === 0 ? <EmptyState title="No active insights" body="Everything looks calm right now." /> : (
        <div className="grid gap-4 lg:grid-cols-2">
          {active.map((i) => (
            <Panel key={i.id}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="grid size-8 place-items-center rounded-lg bg-ai/12 text-ai"><Lightbulb className="size-4" /></span>
                  <Pill t={sevTone[i.severity]}>{i.severity}</Pill>
                </div>
                <Button size="icon" variant="ghost" aria-label={`Dismiss insight: ${i.title}`} onClick={() => dismiss(i.id)}><X className="size-4 text-muted-foreground" /></Button>
              </div>
              <h3 className="mt-3 text-base font-semibold">{i.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{i.explanation}</p>
              <div className="mt-3 flex items-center justify-between">
                <span className="num text-sm font-medium">{i.metric}</span>
                <Button size="sm" variant="outline" asChild><Link to={i.link as "/forecast"}>{i.action}</Link></Button>
              </div>
            </Panel>
          ))}
        </div>
      )}
      {dismissed.length > 0 && (
        <Panel title="Dismissed" className="mt-6">
          <ul className="divide-y">
            {dismissed.map((i) => (
              <li key={i.id} className="flex items-center gap-3 py-2.5">
                <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">{i.title}</span>
                <Button size="sm" variant="ghost" onClick={() => restore(i.id)}>Restore</Button>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}
