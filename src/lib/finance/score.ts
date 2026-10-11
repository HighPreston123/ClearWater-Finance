import type { DateRange, Transaction } from "@/types/finance";
import { completeMonthsInRange, datasetCompleteMonths } from "./dates";
import { summaryForMonth } from "./metrics";
import { formatCents, formatPct, monthLabel } from "@/lib/format";

/** Demo rubric. These thresholds are product assumptions, not validated financial standards. */
export const FACTOR_A_TIERS = [
  { min: 50, points: 700, label: "50% or higher" },
  { min: 40, points: 630, label: "40% to below 50%" },
  { min: 30, points: 560, label: "30% to below 40%" },
  { min: 20, points: 490, label: "20% to below 30%" },
  { min: 10, points: 420, label: "10% to below 20%" },
  { min: 5, points: 280, label: "5% to below 10%" },
  { min: 0, points: 140, label: "0% to below 5%" },
  { min: -Infinity, points: 0, label: "Below 0%" },
];
export const FACTOR_A_MAX = 700;
export const FACTOR_B_MAX = 300;

export const SCORE_LABELS = [
  { max: 100, label: "Needs attention", tone: 1 },
  { max: 250, label: "Getting started", tone: 2 },
  { max: 450, label: "Building stability", tone: 3 },
  { max: 650, label: "Making progress", tone: 4 },
  { max: 750, label: "On track", tone: 5 },
  { max: 900, label: "Strong", tone: 6 },
  { max: 1000, label: "Very strong", tone: 7 },
];
export const labelForScore = (s: number) => SCORE_LABELS.find((l) => s <= l.max)!;

export const SCORE_DISCLAIMER =
  "Educational estimate based on recorded data. This is not a credit score or professional financial assessment.";
export const SCORE_SCOPE = "This score reflects recorded cash flow. Future risk and investment risk are not included yet.";

export interface ScoreFactor {
  id: "cash_flow_margin" | "prior_month_stability";
  name: string;
  available: number;
  earned: number;
  deducted: number;
  unavailable: boolean;
  /** Present when the score was normalized because the other factor was unavailable. */
  normalized?: { available: number; earned: number; deducted: number };
  supporting: { label: string; value: string }[];
  threshold: string;
  improve: string;
}

export type ScoreResult =
  | { status: "no_complete_month"; message: string }
  | { status: "no_income"; month: string; message: string }
  | {
      status: "ok";
      month: string;
      score: number;
      rawScore: number;
      rawAvailable: number;
      normalized: boolean;
      limitedHistory: boolean;
      label: string;
      tone: number;
      factors: ScoreFactor[];
    };

export function computeHistoricalScore(all: Transaction[], range: DateRange): ScoreResult {
  const months = completeMonthsInRange(all, range);
  if (!months.length) return { status: "no_complete_month", message: "Select a complete month to calculate a score." };
  const month = months[months.length - 1]!;
  const s = summaryForMonth(all, month);
  if (s.income === 0 || s.surplusRate === null) return { status: "no_income", month, message: "Not enough income data." };

  const tier = FACTOR_A_TIERS.find((t) => s.surplusRate! >= t.min)!;
  const a: ScoreFactor = {
    id: "cash_flow_margin",
    name: "Monthly cash-flow margin",
    available: FACTOR_A_MAX,
    earned: tier.points,
    deducted: FACTOR_A_MAX - tier.points,
    unavailable: false,
    supporting: [
      { label: "Income", value: formatCents(s.income) },
      { label: "Spending", value: formatCents(s.spending) },
      { label: "Net cash flow", value: formatCents(s.net) },
      { label: "Surplus rate", value: formatPct(s.surplusRate) },
    ],
    threshold: `Surplus rate ${formatPct(s.surplusRate)} falls in the "${tier.label}" tier → ${tier.points} of ${FACTOR_A_MAX} points.`,
    improve:
      tier.points === FACTOR_A_MAX
        ? "This factor earned full points. Keeping spending below 70% of income maintains it."
        : `Reaching the next tier in a future month (a higher surplus rate) would earn more points. Lowering adjustable spending or raising income increases the margin.`,
  };

  // Prior-month stability: up to two complete months immediately before the scored month, with income.
  const all_complete = datasetCompleteMonths(all);
  const idx = all_complete.indexOf(month);
  const prior = all_complete.slice(Math.max(0, idx - 2), idx).map((m) => summaryForMonth(all, m)).filter((m) => m.income > 0);
  let b: ScoreFactor;
  if (!prior.length) {
    b = {
      id: "prior_month_stability",
      name: "Prior-month stability",
      available: FACTOR_B_MAX,
      earned: 0,
      deducted: 0,
      unavailable: true,
      supporting: [{ label: "Eligible prior months", value: "None" }],
      threshold: "No complete prior months with recorded income. Factor unavailable; margin normalized to 1,000.",
      improve: "This factor becomes available after more complete months of recorded income.",
    };
  } else {
    const nonneg = prior.filter((m) => m.net >= 0).length;
    const earned = Math.round((FACTOR_B_MAX * nonneg) / prior.length);
    b = {
      id: "prior_month_stability",
      name: "Prior-month stability",
      available: FACTOR_B_MAX,
      earned,
      deducted: FACTOR_B_MAX - earned,
      unavailable: false,
      supporting: prior.map((m) => ({ label: monthLabel(m.month, true), value: `Net ${formatCents(m.net)}${m.net >= 0 ? " (nonnegative)" : " (negative)"}` })),
      threshold: `300 × ${nonneg} of ${prior.length} eligible prior month(s) with nonnegative cash flow = ${earned} points.`,
      improve:
        earned === FACTOR_B_MAX
          ? "All eligible prior months were nonnegative."
          : "Past months can't be rewritten by changes today. This factor improves as future months with consistent, nonnegative cash flow replace older ones.",
    };
  }

  const rawScore = a.earned + (b.unavailable ? 0 : b.earned);
  const rawAvailable = FACTOR_A_MAX + (b.unavailable ? 0 : FACTOR_B_MAX);
  let score = rawScore;
  if (b.unavailable) {
    score = Math.round((a.earned * 1000) / FACTOR_A_MAX);
    a.normalized = { available: 1000, earned: score, deducted: 1000 - score };
  }
  const l = labelForScore(score);
  return { status: "ok", month, score, rawScore, rawAvailable, normalized: b.unavailable, limitedHistory: b.unavailable, label: l.label, tone: l.tone, factors: [a, b] };
}
