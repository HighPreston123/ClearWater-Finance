import type { Category, SavingsScenarioSettings, Transaction } from "@/types/finance";
import { monthKey } from "./dates";

export interface ScenarioLine {
  id: keyof SavingsScenarioSettings;
  category: Category;
  label: string;
  baselineMonthlyCents: number;
  reductionPct: number;
  monthlySavingsCents: number;
  annualSavingsCents: number;
}

const LINES: { id: keyof SavingsScenarioSettings; category: Category; label: string }[] = [
  { id: "subscriptionsPct", category: "Subscriptions", label: "Subscriptions" },
  { id: "diningPct", category: "Dining", label: "Dining out" },
  { id: "shoppingPct", category: "Shopping", label: "Shopping" },
];

/**
 * Baseline = average monthly spending per category over the given complete months.
 * Each scenario covers one distinct category, so totals never double-count.
 */
export function computeSavingsScenarios(all: Transaction[], months: string[], s: SavingsScenarioSettings) {
  const lines: ScenarioLine[] = LINES.map((l) => {
    const total = all
      .filter((t) => t.type === "expense" && t.category === l.category && months.includes(monthKey(t.date)))
      .reduce((sum, t) => sum + t.amount, 0);
    const baseline = months.length ? total / months.length : 0;
    const pct = s[l.id];
    const monthly = (baseline * pct) / 100;
    return { ...l, baselineMonthlyCents: baseline, reductionPct: pct, monthlySavingsCents: monthly, annualSavingsCents: monthly * 12 };
  });
  const monthlyTotal = lines.reduce((s, l) => s + l.monthlySavingsCents, 0);
  return { lines, monthlyTotal, annualTotal: monthlyTotal * 12, monthsUsed: months };
}
