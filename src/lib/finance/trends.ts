import { formatCents } from "@/lib/format";
import { monthEnd, monthKey, toDayNumber } from "./dates";

/**
 * Pure shaping of database-aggregated buckets into trend periods, comparisons and factual statements.
 * Amounts are positive integer cents. Transfers are never part of income or spending.
 */
export interface BucketRow {
  /** Bucket start date, YYYY-MM-DD (month start or Monday). */
  bucket: string;
  income: number;
  spending: number;
  transfers: number;
  txnCount: number;
}

export interface TrendPeriod extends BucketRow {
  /** Last day of the bucket, YYYY-MM-DD. */
  end: string;
  net: number;
  /** True when the dataset covers the whole calendar period. */
  complete: boolean;
}

export interface Change {
  current: number;
  previous: number;
  delta: number;
  /** null when the previous value is zero (no percentage against a zero baseline). */
  pct: number | null;
}

export interface CategoryComparison {
  category: string;
  current: number;
  previous: number;
  change: Change;
}

export function change(current: number, previous: number): Change {
  return { current, previous, delta: current - previous, pct: previous === 0 ? null : ((current - previous) / Math.abs(previous)) * 100 };
}

const addDays = (d: string, n: number) => new Date((toDayNumber(d) + n) * 86_400_000).toISOString().slice(0, 10);

export function toPeriods(rows: BucketRow[], kind: "month" | "week", bounds: { start: string; end: string }): TrendPeriod[] {
  return rows.map((r) => {
    const end = kind === "month" ? monthEnd(monthKey(r.bucket)) : addDays(r.bucket, 6);
    return { ...r, end, net: r.income - r.spending, complete: r.bucket >= bounds.start && end <= bounds.end };
  });
}

/** Latest complete period and the one immediately before it (consecutive calendar periods only). */
export function lastTwoComplete(periods: TrendPeriod[], kind: "month" | "week"): { current: TrendPeriod; previous: TrendPeriod | null } | null {
  const complete = periods.filter((p) => p.complete);
  const current = complete[complete.length - 1];
  if (!current) return null;
  const prevStart = kind === "month" ? `${prevMonthKey(monthKey(current.bucket))}-01` : addDays(current.bucket, -7);
  const previous = periods.find((p) => p.bucket === prevStart && p.complete) ?? null;
  return { current, previous };
}

function prevMonthKey(m: string) {
  const [y = 0, mo = 1] = m.split("-").map(Number);
  return mo === 1 ? `${y - 1}-12` : `${y}-${String(mo - 1).padStart(2, "0")}`;
}

/** One factual sentence; returns null when there is nothing supported to say. */
export function describeChange(label: string, c: Change, periodWord = "month"): string | null {
  if (c.current === 0 && c.previous === 0) return null;
  if (c.delta === 0) return `${label} was unchanged at ${formatCents(c.current)} compared with the previous ${periodWord}.`;
  const dir = c.delta > 0 ? "increased" : "decreased";
  if (c.pct === null) {
    return `${label} ${dir} by ${formatCents(Math.abs(c.delta))} compared with the previous ${periodWord}, which had ${formatCents(0)} (no percentage against a zero baseline).`;
  }
  return `${label} ${dir} by ${formatCents(Math.abs(c.delta))}, or ${Math.abs(c.pct).toFixed(0)}%, compared with the previous ${periodWord}.`;
}

export function compareCategories(current: Map<string, number>, previous: Map<string, number>): CategoryComparison[] {
  const cats = new Set([...current.keys(), ...previous.keys()]);
  return [...cats]
    .map((category) => {
      const cur = current.get(category) ?? 0, prev = previous.get(category) ?? 0;
      return { category, current: cur, previous: prev, change: change(cur, prev) };
    })
    .sort((a, b) => Math.abs(b.change.delta) - Math.abs(a.change.delta));
}

/** "What changed?" statements derived only from the given results. */
export function whatChanged(cur: TrendPeriod, prev: TrendPeriod, cats: CategoryComparison[], max = 3): string[] {
  const out: (string | null)[] = [
    describeChange("Income", change(cur.income, prev.income)),
    describeChange("Spending", change(cur.spending, prev.spending)),
    describeChange("Net cash flow", change(cur.net, prev.net)),
    ...cats.filter((c) => c.change.delta !== 0).slice(0, max).map((c) => describeChange(`${c.category} spending`, c.change)),
  ];
  return out.filter((s): s is string => Boolean(s));
}
