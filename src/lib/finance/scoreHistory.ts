import type { Transaction } from "@/types/finance";
import { computeHistoricalScore, type ScoreFactor } from "./score";
import { datasetCompleteMonths, monthEnd, monthRange, monthStart } from "./dates";
import { summaryForMonth } from "./metrics";

/** Bump when computeHistoricalScore's rubric changes; only same-version assessments are compared. */
export const SCORE_METHODOLOGY_VERSION = "historical-cash-flow-v1";
export const SCORE_TYPE = "historical_cash_flow";
export const RECONSTRUCTED_LABEL = "Reconstructed from historical transactions.";

export interface Assessment {
  periodStart: string;
  periodEnd: string;
  score: number | null;
  status: "ok" | "insufficient_data";
  factors: ScoreFactor[];
  metrics: Record<string, string | number | boolean | null>;
  /** Canonical string of every input the score depends on; hashed into the fingerprint. */
  fingerprintInput: string;
}

/**
 * Re-runs the existing deterministic score for every complete month. No new formula:
 * each month is scored exactly as the dashboard scores it when that month is selected.
 */
export function assessAllMonths(all: Transaction[]): Assessment[] {
  const months = datasetCompleteMonths(all);
  return months.map((m, i) => {
    const r = computeHistoricalScore(all, monthRange(m));
    // Inputs: the month's summary plus up to two prior complete months (used by the stability factor).
    const inputs = months.slice(Math.max(0, i - 2), i + 1).map((k) => {
      const s = summaryForMonth(all, k);
      return [k, s.income, s.spending, s.net];
    });
    const s = summaryForMonth(all, m);
    const metrics = { income: s.income, spending: s.spending, net: s.net, surplusRate: s.surplusRate, transactionCount: s.transactionCount };
    const base = { periodStart: monthStart(m), periodEnd: monthEnd(m), metrics, fingerprintInput: JSON.stringify([SCORE_METHODOLOGY_VERSION, inputs]) };
    if (r.status === "ok") {
      return { ...base, score: r.score, status: "ok", factors: r.factors, metrics: { ...metrics, label: r.label, normalized: r.normalized, limitedHistory: r.limitedHistory } };
    }
    return { ...base, score: null, status: "insufficient_data", factors: [], metrics: { ...metrics, reason: "message" in r ? r.message : "Not enough data" } };
  });
}

/** A score is "recorded" only when first calculated by the end of the month after its period. */
export function isReconstructed(periodEnd: string, calculatedAt: Date): boolean {
  const [y = 0, m = 1] = periodEnd.split("-").map(Number);
  const cutoff = Date.UTC(y, m + 1, 1); // first day of the second month after the period
  return calculatedAt.getTime() >= cutoff;
}
