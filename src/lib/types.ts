export type Mode = "personal" | "business";
export type TxnType = "income" | "expense";
export type Frequency = "one-time" | "weekly" | "monthly" | "quarterly" | "yearly";
export type PayMethod = "debit" | "credit" | "emi" | "cash";
export type Risk = "low" | "medium" | "high";

export interface Transaction {
  id: string;
  mode: Mode;
  date: string; // yyyy-MM-dd
  description: string;
  amount: number; // always positive; sign comes from type
  type: TxnType;
  category: string;
  accountId: string;
  method: string;
  notes?: string;
}

export interface Payment {
  id: string;
  mode: Mode;
  name: string;
  amount: number;
  dueDate: string;
  category: string;
  frequency: Frequency;
  accountId: string;
  notes?: string;
  paid: boolean;
  paidTxnId?: string;
}

export interface IncomeStream {
  id: string;
  mode: Mode;
  name: string;
  amount: number;
  dayOfMonth: number;
}

export interface Receivable {
  id: string;
  customer: string;
  invoice: string;
  amount: number;
  expectedDate: string;
  status: "expected" | "received" | "delayed";
  delayDays: number;
  receivedTxnId?: string;
}

export interface Account {
  id: string;
  mode: Mode;
  name: string;
  kind: "bank" | "savings" | "cash" | "current";
}

export interface CreditCard {
  id: string;
  name: string;
  limit: number;
  outstanding: number;
  dueDay: number;
  minDue: number;
}

export interface Goal {
  id: string;
  mode: Mode;
  name: string;
  target: number;
  saved: number;
  targetDate: string;
  monthly: number;
}

export interface ModeFinance {
  openingBalance: number; // balance before the first tracked transaction
  reserve: number;
  budget: number;
}

export interface Settings {
  name: string;
  email: string;
  currency: "INR";
  dateFormat: "dd MMM yyyy" | "dd/MM/yyyy" | "MM/dd/yyyy";
  forecastDays: 7 | 30 | 60 | 90;
  defaultAccount: Record<Mode, string>;
  notifications: { bills: boolean; lowBalance: boolean; largePurchase: boolean; credit: boolean; goals: boolean };
  finance: Record<Mode, ModeFinance>;
  headroomPct: number; // extra cushion above reserve required for "low" risk
}

export interface SimInputs {
  purchaseAmount: number;
  purchaseDate: string;
  incomeAmount: number;
  incomeDate: string;
  extraExpense: number;
  extraExpenseDate: string;
  reserve: number;
  delayedReceivableId: string;
  delayDays: number;
}

export interface Scenario {
  id: string;
  name: string;
  mode: Mode;
  inputs: SimInputs;
  createdAt: string;
}

export interface AppData {
  version: number;
  mode: Mode;
  transactions: Transaction[];
  payments: Payment[];
  incomes: IncomeStream[];
  receivables: Receivable[];
  accounts: Account[];
  cards: CreditCard[];
  goals: Goal[];
  settings: Settings;
  scenarios: Scenario[];
  dismissedInsights: string[];
  readNotifications: string[];
}

export const PERSONAL_CATEGORIES = [
  "Housing", "Food", "Transport", "Shopping", "Entertainment", "Healthcare", "Utilities", "EMI", "Subscriptions", "Insurance", "Salary", "Freelance", "Other",
];
export const BUSINESS_CATEGORIES = [
  "Client Payment", "Salaries", "Rent", "Supplier", "Taxes", "Software", "Equipment", "Utilities", "Marketing", "Other",
];
export const PAYMENT_CATEGORIES = [
  "Rent", "EMI", "Credit Card", "Insurance", "Utilities", "Subscriptions", "Salaries", "Supplier", "Taxes", "Other",
];
export const PAYMENT_METHODS_TXN = ["UPI", "Debit Card", "Credit Card", "Net Banking", "NEFT", "Cash", "Auto-debit"];
export const DONUT_CATEGORIES = ["Housing", "Food", "Transport", "Shopping", "Entertainment", "Healthcare", "Utilities", "Other"];
