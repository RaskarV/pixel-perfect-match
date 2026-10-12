import { addDays, addMonths, setDate, startOfMonth, subMonths, min as minDate } from "date-fns";
import type { AppData, Payment, Transaction } from "./types";
import { iso } from "./format";

export const STORAGE_VERSION = 1;

/** Builds a fictional, internally consistent demo dataset relative to `today`. */
export function createSeed(today: Date = new Date()): AppData {
  const tx: Transaction[] = [];
  let n = 0;
  const t = (mode: Transaction["mode"], date: Date, description: string, amount: number, type: Transaction["type"], category: string, accountId: string, method: string): void => {
    tx.push({ id: `seed-t${++n}`, mode, date: iso(date), description, amount, type, category, accountId, method });
  };
  const monthStart = startOfMonth(today);
  // current-month dates never go past today
  const cur = (day: number) => minDate([setDate(monthStart, day), today]);

  // ---------- Personal: 5 full past months ----------
  for (let m = 5; m >= 1; m--) {
    const ms = subMonths(monthStart, m);
    const d = (day: number) => setDate(ms, day);
    const v = m * 37; // deterministic variation
    t("personal", d(1), "Salary — Infosys Ltd", 52000, "income", "Salary", "acc-bank", "NEFT");
    t("personal", d(18), "Freelance web project", 6000 + (v % 5) * 1000, "income", "Freelance", "acc-bank", "UPI");
    t("personal", d(2), "House rent — Kothrud flat", 15000, "expense", "Housing", "acc-bank", "Net Banking");
    t("personal", d(5), "Laptop EMI — Bajaj Finserv", 6500, "expense", "EMI", "acc-bank", "Auto-debit");
    t("personal", d(10), "MSEDCL electricity bill", 1500 + (v % 4) * 150, "expense", "Utilities", "acc-bank", "UPI");
    t("personal", d(6), "BigBasket groceries", 2200 + (v % 3) * 200, "expense", "Food", "acc-bank", "UPI");
    t("personal", d(20), "D-Mart groceries", 1900 + (v % 5) * 120, "expense", "Food", "acc-bank", "Debit Card");
    t("personal", d(13), "Swiggy dinner", 650 + (v % 4) * 90, "expense", "Food", "acc-bank", "UPI");
    t("personal", d(24), "Restaurant — Vaishali", 1100 + (v % 3) * 150, "expense", "Food", "acc-cash", "Cash");
    t("personal", d(8), "Uber rides", 520 + (v % 6) * 60, "expense", "Transport", "acc-bank", "UPI");
    t("personal", d(22), "Petrol — HP pump", 1400, "expense", "Transport", "acc-bank", "Credit Card");
    t("personal", d(3), "Netflix subscription", 649, "expense", "Subscriptions", "acc-bank", "Credit Card");
    t("personal", d(3), "Spotify Premium", 119, "expense", "Subscriptions", "acc-bank", "Credit Card");
    t("personal", d(15), m % 2 ? "Amazon — headphones" : "Myntra — clothing", 1800 + (v % 7) * 300, "expense", "Shopping", "acc-bank", "Credit Card");
    t("personal", d(26), "PVR movie tickets", 700 + (v % 3) * 100, "expense", "Entertainment", "acc-bank", "UPI");
    if (m % 2 === 1) t("personal", d(17), "Apollo Pharmacy", 850 + (v % 4) * 100, "expense", "Healthcare", "acc-bank", "UPI");
    t("personal", d(28), "Transfer to savings", 0, "expense", "Other", "acc-bank", "Net Banking");
  }
  // remove zero-amount placeholders
  for (let i = tx.length - 1; i >= 0; i--) if (tx[i].amount === 0) tx.splice(i, 1);

  // ---------- Personal: current month (income ₹60,000, expenses ₹32,000) ----------
  t("personal", cur(1), "Salary — Infosys Ltd", 52000, "income", "Salary", "acc-bank", "NEFT");
  t("personal", cur(2), "House rent — Kothrud flat", 15000, "expense", "Housing", "acc-bank", "Net Banking");
  t("personal", cur(3), "Netflix subscription", 649, "expense", "Subscriptions", "acc-bank", "Credit Card");
  t("personal", cur(4), "BigBasket groceries", 2400, "expense", "Food", "acc-bank", "UPI");
  t("personal", cur(5), "Laptop EMI — Bajaj Finserv", 6500, "expense", "EMI", "acc-bank", "Auto-debit");
  t("personal", cur(6), "Uber rides", 680, "expense", "Transport", "acc-bank", "UPI");
  t("personal", cur(7), "Freelance logo design", 8000, "income", "Freelance", "acc-bank", "UPI");
  t("personal", cur(8), "MSEDCL electricity bill", 1820, "expense", "Utilities", "acc-bank", "UPI");
  t("personal", cur(9), "Swiggy dinner", 1250, "expense", "Food", "acc-bank", "UPI");
  t("personal", cur(10), "D-Mart groceries", 1850, "expense", "Food", "acc-bank", "Debit Card");
  t("personal", cur(11), "Amazon — phone case & charger", 1851, "expense", "Shopping", "acc-bank", "Credit Card");

  // ---------- Business: Nimbus Digital Studio ----------
  for (let m = 5; m >= 0; m--) {
    const ms = subMonths(monthStart, m);
    const d = m === 0 ? cur : (day: number) => setDate(ms, day);
    const v = m * 53;
    t("business", d(1), "Team salaries", 180000, "expense", "Salaries", "biz-current", "Net Banking");
    t("business", d(2), "Office rent — Baner", 45000, "expense", "Rent", "biz-current", "Net Banking");
    t("business", d(3), "Client — Acme Retail retainer", 150000, "income", "Client Payment", "biz-current", "NEFT");
    t("business", d(6), "AWS & Google Workspace", 8500 + (v % 3) * 400, "expense", "Software", "biz-current", "Credit Card");
    t("business", d(8), "Client — Zenith Foods project", 90000 + (v % 4) * 15000, "income", "Client Payment", "biz-current", "NEFT");
    if (m !== 0) {
      t("business", d(14), "Supplier — PrintHub", 18000 + (v % 5) * 2000, "expense", "Supplier", "biz-current", "Net Banking");
      t("business", d(20), "Client — Orbit Labs milestone", 70000 + (v % 3) * 10000, "income", "Client Payment", "biz-current", "NEFT");
      t("business", d(22), "Meta ads campaign", 12000, "expense", "Marketing", "biz-current", "Credit Card");
      t("business", d(25), "Electricity & internet", 6200, "expense", "Utilities", "biz-current", "UPI");
    }
  }

  const net = (mode: string) => tx.filter((x) => x.mode === mode).reduce((s, x) => s + (x.type === "income" ? x.amount : -x.amount), 0);

  const nextDay = (day: number) => {
    const thisMonth = setDate(monthStart, day);
    return iso(thisMonth > today ? thisMonth : setDate(addMonths(monthStart, 1), day));
  };
  let p = 0;
  const pay = (o: Omit<Payment, "id" | "paid">): Payment => ({ ...o, id: `seed-p${++p}`, paid: false });

  const payments: Payment[] = [
    pay({ mode: "personal", name: "House rent", amount: 15000, dueDate: nextDay(2), category: "Rent", frequency: "monthly", accountId: "acc-bank" }),
    pay({ mode: "personal", name: "Laptop EMI — Bajaj Finserv", amount: 6500, dueDate: nextDay(5), category: "EMI", frequency: "monthly", accountId: "acc-bank" }),
    pay({ mode: "personal", name: "HDFC credit card bill", amount: 12400, dueDate: iso(addDays(today, 6)), category: "Credit Card", frequency: "one-time", accountId: "acc-bank" }),
    pay({ mode: "personal", name: "Jio Fiber internet", amount: 999, dueDate: iso(addDays(today, 3)), category: "Utilities", frequency: "monthly", accountId: "acc-bank" }),
    pay({ mode: "personal", name: "Star Health insurance", amount: 9800, dueDate: iso(addDays(today, 12)), category: "Insurance", frequency: "yearly", accountId: "acc-bank" }),
    pay({ mode: "personal", name: "Netflix subscription", amount: 649, dueDate: nextDay(3), category: "Subscriptions", frequency: "monthly", accountId: "acc-bank" }),
    pay({ mode: "personal", name: "MSEDCL electricity", amount: 1800, dueDate: nextDay(10), category: "Utilities", frequency: "monthly", accountId: "acc-bank" }),
    pay({ mode: "business", name: "Team salaries", amount: 180000, dueDate: nextDay(1), category: "Salaries", frequency: "monthly", accountId: "biz-current" }),
    pay({ mode: "business", name: "Office rent — Baner", amount: 45000, dueDate: nextDay(2), category: "Rent", frequency: "monthly", accountId: "biz-current" }),
    pay({ mode: "business", name: "Supplier — PrintHub invoice", amount: 26000, dueDate: iso(addDays(today, 5)), category: "Supplier", frequency: "one-time", accountId: "biz-current" }),
    pay({ mode: "business", name: "GST quarterly payment", amount: 38000, dueDate: iso(addDays(today, 9)), category: "Taxes", frequency: "quarterly", accountId: "biz-current" }),
    pay({ mode: "business", name: "AWS & Google Workspace", amount: 9000, dueDate: nextDay(6), category: "Subscriptions", frequency: "monthly", accountId: "biz-current" }),
  ];

  return {
    version: STORAGE_VERSION,
    mode: "personal",
    transactions: tx,
    payments,
    incomes: [
      { id: "inc-salary", mode: "personal", name: "Salary — Infosys Ltd", amount: 52000, dayOfMonth: 1 },
      { id: "inc-free", mode: "personal", name: "Freelance (expected)", amount: 6000, dayOfMonth: 18 },
      { id: "inc-acme", mode: "business", name: "Acme Retail retainer", amount: 150000, dayOfMonth: 3 },
    ],
    receivables: [
      { id: "rcv-1", customer: "Zenith Foods", invoice: "INV-1042", amount: 95000, expectedDate: iso(addDays(today, 4)), status: "expected", delayDays: 0 },
      { id: "rcv-2", customer: "Orbit Labs", invoice: "INV-1045", amount: 80000, expectedDate: iso(addDays(today, 10)), status: "expected", delayDays: 0 },
      { id: "rcv-3", customer: "Kavya Interiors", invoice: "INV-1039", amount: 42000, expectedDate: iso(addDays(today, 2)), status: "delayed", delayDays: 15 },
      { id: "rcv-4", customer: "Pune Fitness Co.", invoice: "INV-1048", amount: 60000, expectedDate: iso(addDays(today, 21)), status: "expected", delayDays: 0 },
    ],
    accounts: [
      { id: "acc-bank", mode: "personal", name: "Primary Bank Account", kind: "bank" },
      { id: "acc-sav", mode: "personal", name: "Savings Account", kind: "savings" },
      { id: "acc-cash", mode: "personal", name: "Cash Wallet", kind: "cash" },
      { id: "biz-current", mode: "business", name: "Business Current Account", kind: "current" },
      { id: "biz-petty", mode: "business", name: "Petty Cash", kind: "cash" },
    ],
    cards: [
      { id: "card-hdfc", name: "HDFC Regalia", limit: 150000, outstanding: 12400, dueDay: Math.min(28, addDays(today, 6).getDate()), minDue: 620 },
      { id: "card-icici", name: "Amazon Pay ICICI", limit: 80000, outstanding: 6200, dueDay: 15, minDue: 310 },
    ],
    goals: [
      { id: "g-emg", mode: "personal", name: "Emergency fund", target: 200000, saved: 85000, targetDate: iso(addMonths(today, 12)), monthly: 10000 },
      { id: "g-laptop", mode: "personal", name: "New laptop", target: 90000, saved: 32000, targetDate: iso(addMonths(today, 6)), monthly: 8000 },
      { id: "g-trip", mode: "personal", name: "Goa vacation", target: 40000, saved: 12000, targetDate: iso(addMonths(today, 4)), monthly: 5000 },
      { id: "g-edu", mode: "personal", name: "Higher education (MS)", target: 300000, saved: 45000, targetDate: iso(addMonths(today, 24)), monthly: 9000 },
      { id: "g-equip", mode: "business", name: "Business equipment", target: 250000, saved: 90000, targetDate: iso(addMonths(today, 8)), monthly: 20000 },
    ],
    settings: {
      name: "Alex Morgan",
      email: "alex.morgan@demo.smartspend.ai",
      currency: "INR",
      dateFormat: "dd MMM yyyy",
      forecastDays: 30,
      defaultAccount: { personal: "acc-bank", business: "biz-current" },
      notifications: { bills: true, lowBalance: true, largePurchase: true, credit: true, goals: true },
      finance: {
        personal: { openingBalance: 100000 - net("personal"), reserve: 40000, budget: 35000 },
        business: { openingBalance: 450000 - net("business"), reserve: 200000, budget: 320000 },
      },
      headroomPct: 25,
    },
    scenarios: [],
    dismissedInsights: [],
    readNotifications: [],
  };
}
