import type { RecurringOverride, RecurringSeries, Transaction } from "@/types/finance";
import { daysBetween } from "./dates";
import { formatCents } from "@/lib/format";

export const RECURRING_RULES = {
  minPayments: 3,
  weekly: [6, 8] as const,
  monthly: [26, 35] as const,
  amountTolerance: 0.4, // each payment within ±40% of the median
};

export function normalizeMerchant(m: string) {
  return m.toLowerCase().replace(/[#*\d]+/g, " ").replace(/[^a-z& ]/g, " ").replace(/\s+/g, " ").trim();
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : Math.round((s[mid - 1]! + s[mid]!) / 2);
};

/** Uses ALL available expense history (not the selected date range). */
export function detectRecurring(all: Transaction[], overrides: Record<string, RecurringOverride>): RecurringSeries[] {
  const groups = new Map<string, Transaction[]>();
  for (const t of all) {
    if (t.type !== "expense") continue;
    const k = normalizeMerchant(t.merchant);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(t);
  }
  const out: RecurringSeries[] = [];
  for (const [key, ts] of groups) {
    if (ts.length < RECURRING_RULES.minPayments) continue;
    const sorted = [...ts].sort((a, b) => a.date.localeCompare(b.date));
    const intervals = sorted.slice(1).map((t, i) => daysBetween(sorted[i]!.date, t.date));
    const within = ([lo, hi]: readonly [number, number]) => intervals.every((d) => d >= lo && d <= hi);
    const frequency = within(RECURRING_RULES.weekly) ? "weekly" : within(RECURRING_RULES.monthly) ? "monthly" : null;
    if (!frequency) continue;
    const amounts = sorted.map((t) => t.amount);
    const med = median(amounts);
    if (!amounts.every((a) => Math.abs(a - med) <= med * RECURRING_RULES.amountTolerance)) continue;
    const variable = amounts.some((a) => Math.abs(a - med) > med * 0.05);
    const min = Math.min(...amounts), max = Math.max(...amounts);
    const ov = overrides[key] ?? {};
    const last = sorted[sorted.length - 1]!;
    const monthly = frequency === "weekly" ? (med * 52) / 12 : med;
    const annual = frequency === "weekly" ? med * 52 : med * 12;
    out.push({
      key,
      merchant: last.merchant,
      category: last.category,
      estimatedCents: med,
      frequency,
      paymentCount: sorted.length,
      transactionIds: sorted.map((t) => t.id),
      explanation: `${sorted.length} payments roughly every ${frequency === "weekly" ? "week" : "month"} (gaps of ${Math.min(...intervals)}–${Math.max(...intervals)} days). Amounts ${variable ? `vary from ${formatCents(min)} to ${formatCents(max)}, so the estimate uses the median` : `are consistent at about ${formatCents(med)}`}.`,
      monthlyEquivalentCents: monthly,
      annualCostCents: annual,
      detection: ov.detection ?? "likely",
      review: ov.review ?? "unconfirmed",
      lastDate: last.date,
    });
  }
  return out.sort((a, b) => b.monthlyEquivalentCents - a.monthlyEquivalentCents);
}

export const activeSeries = (s: RecurringSeries[]) => s.filter((x) => x.detection !== "not_recurring");
export const monthlyRecurringCost = (s: RecurringSeries[]) =>
  Math.round(activeSeries(s).reduce((sum, x) => sum + x.monthlyEquivalentCents, 0));
