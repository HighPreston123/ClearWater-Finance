import type { ScoreResult } from "./score";
import type { RiskAssessment } from "@/types/risk";
import type { Transaction } from "@/types/finance";
import { summaryForMonth } from "./metrics";
import { formatCents, monthLabel } from "@/lib/format";

export interface ProfileImprovementAction {
  factorId: string;
  source: "historical_score" | "future_risk";
  issue: string;
  supporting: { label: string; value: string }[];
  historicalDeduction: number | null;
  /** Only when supplied by the future-risk engine. */
  riskContribution: unknown | null;
  nextStep: string;
  howItHelps: string;
}

/** Built only from structured score results; no invented penalties or guarantees. */
export function profileImprovementActions(all: Transaction[], score: ScoreResult, _risk: RiskAssessment): ProfileImprovementAction[] {
  if (score.status !== "ok") return [];
  const out: ProfileImprovementAction[] = [];
  for (const f of score.factors) {
    if (f.unavailable || f.deducted <= 0) continue;
    if (f.id === "cash_flow_margin") {
      const s = summaryForMonth(all, score.month);
      out.push({
        factorId: f.id, source: "historical_score",
        issue: s.net < 0
          ? `Your expenses exceeded your income by ${formatCents(-s.net)} during ${monthLabel(score.month, true)}. This reduced your historical cash-flow score.`
          : `Your surplus in ${monthLabel(score.month, true)} was below the top tier, which reduced your historical cash-flow score.`,
        supporting: f.supporting, historicalDeduction: f.deducted, riskContribution: null,
        nextStep: "Review your largest adjustable expenses to identify ways to widen the gap between income and spending.",
        howItHelps: "A higher surplus rate in a future month moves the margin factor into a higher tier.",
      });
    } else {
      const negatives = f.supporting.filter((x) => x.value.includes("negative"));
      out.push({
        factorId: f.id, source: "historical_score",
        issue: `${negatives.map((n) => n.label).join(" and ")} had negative cash flow. This reduced your historical cash-flow score.`,
        supporting: f.supporting, historicalDeduction: f.deducted, riskContribution: null,
        nextStep: "Aim for nonnegative cash flow in each upcoming month; plan large one-time purchases ahead.",
        howItHelps: "Past months can't change, but as new nonnegative months replace older ones, this factor recovers.",
      });
    }
  }
  return out;
}
