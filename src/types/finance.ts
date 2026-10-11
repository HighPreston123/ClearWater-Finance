/** Monetary amounts on transactions are positive integer cents. `type` gives them meaning. */
export type Cents = number;

export type TransactionType = "income" | "expense" | "transfer";

export const CATEGORIES = [
  "Income",
  "Housing",
  "Utilities",
  "Groceries",
  "Dining",
  "Transportation",
  "Shopping",
  "Entertainment",
  "Healthcare",
  "Subscriptions",
  "Savings",
  "Investments",
  "Other",
] as const;
export type Category = (typeof CATEGORIES)[number];

export interface Transaction {
  id: string;
  /** Calendar date, YYYY-MM-DD. Never parsed with local time zones. */
  date: string;
  merchant: string;
  amount: Cents;
  type: TransactionType;
  category: Category;
  categorySource: "rule" | "manual";
  description: string;
  accountId: string;
  /** For transfers between tracked accounts. */
  linkedAccountId?: string;
}

export interface DateRange {
  start: string;
  end: string;
}

export interface CashFlowSummary {
  income: Cents;
  spending: Cents;
  net: Cents;
  /** null when income is zero */
  surplusRate: number | null;
  savingsTransfers: Cents;
  investmentContributions: Cents;
  otherTransfers: Cents;
  transactionCount: number;
}

export interface MonthSummary extends CashFlowSummary {
  month: string; // YYYY-MM
}

export type RecurringFrequency = "weekly" | "monthly";
export type RecurringDetection = "likely" | "confirmed" | "not_recurring";
export type RecurringReview = "essential" | "worth_reviewing" | "unconfirmed";

export interface RecurringSeries {
  key: string;
  merchant: string;
  category: Category;
  estimatedCents: Cents;
  frequency: RecurringFrequency;
  paymentCount: number;
  transactionIds: string[];
  explanation: string;
  monthlyEquivalentCents: number;
  annualCostCents: number;
  detection: RecurringDetection;
  review: RecurringReview;
  lastDate: string;
}

export interface RecurringOverride {
  detection?: RecurringDetection;
  review?: RecurringReview;
}

export interface SavingsScenarioSettings {
  subscriptionsPct: number;
  diningPct: number;
  shoppingPct: number;
}
