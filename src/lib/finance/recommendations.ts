import type { CashFlowSummary, MonthSummary, RecurringSeries } from "@/types/finance";
import type { ManualFinancialInputs } from "@/types/risk";
import { formatCents, formatPct, monthLabel } from "@/lib/format";

export interface PrimaryRecommendation {
  ruleId: "negative_cash_flow" | "emergency_fund" | "review_recurring" | "discretionary_increase" | "savings_target";
  title: string;
  detail: string;
  supporting: { label: string; value: string }[];
  nextStep: string;
  impact: string | null;
  basis: "Based on your transactions";
}

export interface RecommendationInput {
  periodLabel: string;
  summary: CashFlowSummary;
  /** Latest complete month in range and the month before, when available. */
  current: MonthSummary | null;
  previous: MonthSummary | null;
  currentDiscretionary: number | null;
  previousDiscretionary: number | null;
  recurring: RecurringSeries[];
  manual: ManualFinancialInputs;
}

/** Deterministic, ordered rules. Always returns exactly one recommendation. */
export function primaryRecommendation(i: RecommendationInput): PrimaryRecommendation {
  const basis = "Based on your transactions" as const;
  if (i.summary.net < 0) {
    return {
      ruleId: "negative_cash_flow", basis,
      title: "Close the gap between spending and income",
      detail: `During ${i.periodLabel}, spending exceeded income by ${formatCents(-i.summary.net)}.`,
      supporting: [
        { label: "Income", value: formatCents(i.summary.income) },
        { label: "Spending", value: formatCents(i.summary.spending) },
        { label: "Net cash flow", value: formatCents(i.summary.net) },
      ],
      nextStep: "Review your largest expenses this period and mark which were one-time versus adjustable.",
      impact: `Closing the gap would require ${formatCents(-i.summary.net)} less spending or more income over the same period.`,
    };
  }
  const ef = i.manual.emergencyFundCents, target = i.manual.emergencyFundTargetCents;
  if (target !== null && ef !== null && ef < target) {
    const gap = target - ef;
    const months = i.summary.net > 0 && i.current ? Math.ceil(gap / i.current.net) : null;
    return {
      ruleId: "emergency_fund", basis,
      title: "Build toward your emergency-fund target",
      detail: `You entered a target of ${formatCents(target)} and a current balance of ${formatCents(ef)}.`,
      supporting: [
        { label: "Remaining", value: formatCents(gap) },
        { label: "Net cash flow this period", value: formatCents(i.summary.net) },
      ],
      nextStep: "Set up an automatic transfer to savings right after each paycheck.",
      impact: months && months > 0 && i.current && i.current.net > 0 ? `At last month's surplus (${formatCents(i.current.net)}), about ${months} month(s) to reach the target if all of it were saved.` : null,
    };
  }
  const review = i.recurring.filter((r) => r.review === "worth_reviewing" && r.detection !== "not_recurring");
  if (review.length) {
    const monthly = review.reduce((s, r) => s + r.monthlyEquivalentCents, 0);
    return {
      ruleId: "review_recurring", basis,
      title: "Review the recurring expenses you flagged",
      detail: `You marked ${review.length} recurring expense(s) as "Worth reviewing": ${review.map((r) => r.merchant).join(", ")}.`,
      supporting: [{ label: "Monthly equivalent", value: formatCents(monthly) }, { label: "Estimated annual", value: formatCents(monthly * 12) }],
      nextStep: "Decide whether to keep, downgrade, or cancel each one.",
      impact: `Up to ${formatCents(monthly)} per month if all were cancelled.`,
    };
  }
  if (i.current && i.previous && i.currentDiscretionary !== null && i.previousDiscretionary !== null && i.previousDiscretionary > 0) {
    const change = i.currentDiscretionary - i.previousDiscretionary;
    if (change > i.previousDiscretionary * 0.1) {
      return {
        ruleId: "discretionary_increase", basis,
        title: "Discretionary spending went up",
        detail: `Dining, shopping, and entertainment rose from ${formatCents(i.previousDiscretionary)} in ${monthLabel(i.previous.month)} to ${formatCents(i.currentDiscretionary)} in ${monthLabel(i.current.month)}.`,
        supporting: [{ label: "Increase", value: formatCents(change) }],
        nextStep: "Look through those categories for purchases you'd skip next time.",
        impact: `Returning to the prior month's level would free about ${formatCents(change)} per month.`,
      };
    }
  }
  const suggested = i.summary.net > 0 ? Math.round((i.summary.net * 0.5) / 100) * 100 : null;
  return {
    ruleId: "savings_target", basis,
    title: "Set a savings target",
    detail: `You had positive cash flow of ${formatCents(i.summary.net)} (${formatPct(i.summary.surplusRate)} of income) during ${i.periodLabel}.`,
    supporting: [
      { label: "Net cash flow", value: formatCents(i.summary.net) },
      { label: "Already moved to savings", value: formatCents(i.summary.savingsTransfers) },
    ],
    nextStep: "Choose a goal and an amount to set aside each month in the Savings planner.",
    impact: suggested ? `For example, saving half of this surplus would be ${formatCents(suggested)} per period.` : null,
  };
}
