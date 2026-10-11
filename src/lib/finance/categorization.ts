import type { Category, Transaction, TransactionType } from "@/types/finance";

/** Merchant/keyword rules. First match wins; "Other" is the fallback. */
export const CATEGORY_RULES: { pattern: RegExp; category: Category }[] = [
  { pattern: /payroll|freelance|salary/i, category: "Income" },
  { pattern: /apartments|rent|landlord/i, category: "Housing" },
  { pattern: /power|light|electric|internet|comcast|verizon|wireless|water/i, category: "Utilities" },
  { pattern: /netflix|spotify|gym|fitlife|hulu|subscription/i, category: "Subscriptions" },
  { pattern: /trader joe|safeway|whole foods|grocery|market/i, category: "Groceries" },
  { pattern: /chipotle|sushi|coffee|trattoria|taqueria|shake shack|cafe|restaurant/i, category: "Dining" },
  { pattern: /metro|transit|shell|gas|auto|midas|uber|lyft/i, category: "Transportation" },
  { pattern: /target|best buy|amazon|store/i, category: "Shopping" },
  { pattern: /amc|theatre|live nation|concert|cinema/i, category: "Entertainment" },
  { pattern: /pharmacy|cvs|urgent care|dental|clinic|doctor/i, category: "Healthcare" },
  { pattern: /savings/i, category: "Savings" },
  { pattern: /ira|401\(?k\)?|brokerage|hsa contribution/i, category: "Investments" },
];

export function categorizeByRules(merchant: string, description: string, type: TransactionType): Category {
  const text = `${merchant} ${description}`;
  for (const r of CATEGORY_RULES) {
    if (!r.pattern.test(text)) continue;
    // Never let a rule assign "Income" to a non-income transaction.
    if (r.category === "Income" && type !== "income") continue;
    return r.category;
  }
  return type === "income" ? "Income" : "Other";
}

/** Re-apply rules while preserving manual overrides. */
export function applyRules(txns: Transaction[]): Transaction[] {
  return txns.map((t) =>
    t.categorySource === "manual" ? t : { ...t, category: categorizeByRules(t.merchant, t.description, t.type) },
  );
}

/** Changes category only. Transaction type is never modified here. */
export function setCategory(txns: Transaction[], ids: Set<string>, category: Category): Transaction[] {
  return txns.map((t) => (ids.has(t.id) ? { ...t, category, categorySource: "manual" } : t));
}
