/**
 * Scores the 100 fictional comparison profiles with the same Future Resilience Score
 * (computeResilience) the user gets — no second formula. Profiles only carry monthly
 * averages, so the mapping below is conservative and every gap stays unknown:
 * - one observed month (income = annual/12, spending = monthly spending) → income
 *   variability unknown and the cash-flow pillar is shrunk toward 50 like any short history;
 * - total monthly spending stands in for essential spending (an upper bound);
 * - debt balances come from the breakdown; APR and minimum payments stay unknown;
 * - no portfolio history, goals amounts or retirement simulation → those stay unknown.
 * Pure and deterministic; aggregates never include ids or names.
 */
import { computeResilience, PILLAR_WEIGHTS, type PillarId, type ResilienceResult } from "./resilience";
import type { FinancialSnapshot } from "@/types/risk";
import { debtBandScoreFromAmount, scoreFoundationsCore } from "./wellness";

export interface ComparisonProfileInput {
  id: string;
  annualIncomeCents: number | null;
  monthlySpendingCents: number | null;
  savingsCents: number | null;
  debtCents: number | null;
  debtBreakdown: Record<string, number | null> | null;
  investmentsCents: number | null;
}

const FIXED_NOW = "2026-10-01T00:00:00.000Z";
const n = (v: number | null | undefined) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.round(v) : null);

export function profileSnapshot(p: ComparisonProfileInput): FinancialSnapshot {
  const income = n(p.annualIncomeCents), spend = n(p.monthlySpendingCents), debt = n(p.debtCents);
  const monthlyIncome = income === null ? 0 : Math.round(income / 12);
  const months = income === null || spend === null ? [] : [{
    month: "2026-09", income: monthlyIncome, spending: spend, net: monthlyIncome - spend,
    surplusRate: monthlyIncome ? ((monthlyIncome - spend) / monthlyIncome) * 100 : null,
    savingsTransfers: 0, investmentContributions: 0, otherTransfers: 0, transactionCount: 1,
  }];
  const debts = debt === null || debt === 0 ? [] : Object.entries(p.debtBreakdown ?? {})
    .map(([k, v]) => ({ id: k, name: k.replace(/_cents$/, "").replace(/_/g, " "), balanceCents: n(v), aprPercent: null, minPaymentCents: null }))
    .filter((d) => (d.balanceCents ?? 0) > 0);
  if (debt !== null && debt > 0 && debts.length === 0) debts.push({ id: "debt", name: "debt", balanceCents: debt, aprPercent: null, minPaymentCents: null });
  const recurring = spend === null ? [] : [{
    key: "essentials", merchant: "Monthly spending (approximation)", category: "Other" as never, estimatedCents: spend,
    frequency: "monthly" as never, paymentCount: 1, transactionIds: [], explanation: "Profile monthly spending used as essentials.",
    monthlyEquivalentCents: spend, annualCostCents: spend * 12, detection: "recurring" as never, review: "unreviewed" as never, lastDate: "2026-09-30",
  }];
  const inv = n(p.investmentsCents) ?? 0;
  const summary = months[0] ?? { income: 0, spending: 0, net: 0, surplusRate: null, savingsTransfers: 0, investmentContributions: 0, otherTransfers: 0, transactionCount: 0 };
  return {
    generatedAt: FIXED_NOW,
    cashFlow: { selectedRange: summary, months },
    recurring,
    manual: {
      emergencyFundCents: n(p.savingsCents), emergencyFundTargetCents: null, cashReserves: [], debts,
      debtsConfirmedNone: debt === 0, obligations: [], goals: [], timeHorizonYears: null, riskComfort: "unknown", updatedAt: FIXED_NOW,
    },
    investments: { accounts: [], holdings: [], totalValueMicros: String(inv * 10_000), partial: false },
    marketHistory: null,
    coverage: [],
  } as FinancialSnapshot;
}

export const scoreProfile = (p: ComparisonProfileInput): ResilienceResult =>
  computeResilience({ snapshot: profileSnapshot(p), now: new Date(FIXED_NOW) });

/** Foundations-pillar score of a comparison profile with the same formula the
 *  survey path uses. Profiles only carry monthly averages: total monthly
 *  spending stands in for essential expenses (an upper bound, discretionary
 *  stays 0) and dependable income is unknown — those parts are skipped,
 *  never treated as zero. */
export function scoreProfileFoundations(p: ComparisonProfileInput): number | null {
  const income = n(p.annualIncomeCents), spend = n(p.monthlySpendingCents), savings = n(p.savingsCents), debt = n(p.debtCents);
  return scoreFoundationsCore({
    liquidSavings: savings === null ? null : savings / 100,
    essentialMonthly: spend === null ? null : spend / 100,
    debtBandScore: debtBandScoreFromAmount(debt === null ? null : debt / 100, debt === 0),
    grossAnnualIncome: income === null ? null : income / 100,
    discretionaryMonthly: spend === null ? null : 0,
    dependableScore: null,
  });
}

export interface ComparisonStats {
  version: string;
  total: number;
  scored: number;
  insufficient: number;
  average: number | null;
  median: number | null;
  min: number | null;
  max: number | null;
  /** Ten 10-point bins, 0–9 … 90–100. Counts only. */
  histogram: { from: number; to: number; count: number }[];
  /** Sorted scores for percentile lookup (no ids). */
  sorted: number[];
  pillarAverages: Record<PillarId, number | null>;
  /** Financial foundations (wellness pillar) aggregates for the same profiles. */
  foundations: FoundationsStats;
}

export interface FoundationsStats {
  scored: number;
  average: number | null;
  median: number | null;
}

const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null);

export function aggregate(results: ResilienceResult[]): ComparisonStats {
  const scores = results.map((r) => r.score).filter((s): s is number => s !== null).sort((a, b) => a - b);
  const median = scores.length ? (scores.length % 2 ? scores[(scores.length - 1) / 2]! : (scores[scores.length / 2 - 1]! + scores[scores.length / 2]!) / 2) : null;
  const histogram = Array.from({ length: 10 }, (_, i) => ({ from: i * 10, to: i === 9 ? 100 : i * 10 + 9, count: 0 }));
  for (const s of scores) histogram[Math.min(9, Math.floor(s / 10))]!.count++;
  const pillarAverages = Object.fromEntries((Object.keys(PILLAR_WEIGHTS) as PillarId[]).map((id) => [id,
    avg(results.map((r) => r.pillars.find((p) => p.id === id)?.score ?? null).filter((x): x is number => x !== null))])) as Record<PillarId, number | null>;
  return {
    version: results[0]?.version ?? "", total: results.length, scored: scores.length, insufficient: results.length - scores.length,
    average: avg(scores), median, min: scores[0] ?? null, max: scores[scores.length - 1] ?? null, histogram, sorted: scores, pillarAverages,
    foundations: { scored: 0, average: null, median: null },
  };
}

/** Full comparison view: resilience scores plus financial-foundations (wellness)
 *  scores of the same profiles, both from one formula. */
export function scoreProfilesWithFoundations(inputs: ComparisonProfileInput[]): ComparisonStats {
  const foundationScores = inputs.map(scoreProfileFoundations).filter((s): s is number => s !== null).sort((a, b) => a - b);
  const median = foundationScores.length
    ? (foundationScores.length % 2 ? foundationScores[(foundationScores.length - 1) / 2]! : (foundationScores[foundationScores.length / 2 - 1]! + foundationScores[foundationScores.length / 2]!) / 2)
    : null;
  return {
    ...aggregate(inputs.map(scoreProfile)),
    foundations: { scored: foundationScores.length, average: avg(foundationScores), median },
  };
}

/** Share of the comparison group scoring strictly below, plus half of ties (0–100). */
export function percentileOf(score: number, sorted: number[]): number | null {
  if (!sorted.length) return null;
  const below = sorted.filter((s) => s < score).length, equal = sorted.filter((s) => s === score).length;
  return Math.round(((below + equal / 2) / sorted.length) * 100);
}

export const MIN_MEANINGFUL = 10;
