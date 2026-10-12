import { createFileRoute, redirect } from "@tanstack/react-router";
import { pageHead } from "@/lib/meta";

export const Route = createFileRoute("/")({
  head: () => pageHead("Spend Smart, Stay Ahead", "SmartSpend AI helps you forecast cash flow and decide whether you can afford a purchase — and when to make it."),
  beforeLoad: () => {
    throw redirect({ to: "/dashboard" });
  },
});
