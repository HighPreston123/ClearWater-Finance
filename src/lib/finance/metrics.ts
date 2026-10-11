import type { CashFlowSummary, Category, DateRange, MonthSummary, Transaction } from "@/types/finance";
import { inRange, monthKey } from "./dates";

export const filterByRange = (txns: Transaction[], r: DateRange) => txns.filter((t) => inRange(t.date, r));

/**
 * Income = income transactions; Spending = expense transactions.
 * Transfers between tracked accounts (savings, investment contributions) are
 * excluded from both and reported separately. Unrealized gains are never income.
 */
export function summarize(txns: Transaction[]): CashFlowSummary {
  let income = 0, spending = 0, savingsTransfers = 0, investmentContributions = 0, otherTransfers = 0;
  for (const t of txns) {
    if (t.type === "income") income += t.amount;
    else if (t.type === "expense") spending += t.amount;
    else if (t.category === "Savings") savingsTransfers += t.amount;
    else if (t.category === "Investments") investmentContributions += t.amount;
    else otherTransfers += t.amount;
  }
  const net = income - spending;
  return {
    income,
    spending,
    net,
    surplusRate: income === 0 ? null : (net / income) * 100,
    savingsTransfers,
    investmentContributions,
    otherTransfers,
    transactionCount: txns.length,
  };
}

export function spendingByCategory(txns: Transaction[]): { category: Category; cents: number }[] {
  const map = new Map<Category, number>();
  for (const t of txns) if (t.type === "expense") map.set(t.category, (map.get(t.category) ?? 0) + t.amount);
  return [...map.entries()].map(([category, cents]) => ({ category, cents })).sort((a, b) => b.cents - a.cents);
}

export function monthlySummaries(txns: Transaction[]): MonthSummary[] {
  const groups = new Map<string, Transaction[]>();
  for (const t of txns) {
    const k = monthKey(t.date);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(t);
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([month, ts]) => ({ month, ...summarize(ts) }));
}

export function summaryForMonth(txns: Transaction[], month: string): MonthSummary {
  return { month, ...summarize(txns.filter((t) => monthKey(t.date) === month)) };
}

export function categoryTotalsAll(txns: Transaction[]): Map<Category, number> {
  const m = new Map<Category, number>();
  for (const t of txns) m.set(t.category, (m.get(t.category) ?? 0) + t.amount);
  return m;
}

export const DISCRETIONARY: Category[] = ["Dining", "Shopping", "Entertainment"];
export function discretionaryTotal(txns: Transaction[]) {
  return txns.filter((t) => t.type === "expense" && DISCRETIONARY.includes(t.category)).reduce((s, t) => s + t.amount, 0);
}
