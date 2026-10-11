import type { CashFlowSummary, RecurringSeries } from "@/types/finance";
import type { ScoreResult } from "./score";
import type { PrimaryRecommendation } from "./recommendations";
import type { RiskAssessment } from "@/types/risk";

/**
 * Structured, already-computed results handed to a future AI explainer.
 * The AI may explain these; it must not recompute figures, invent risk ratings,
 * or produce a competing primary recommendation.
 */
export interface InsightContext {
  periodLabel: string;
  summary: CashFlowSummary;
  score: ScoreResult;
  recurring: Pick<RecurringSeries, "merchant" | "frequency" | "monthlyEquivalentCents" | "review">[];
  primaryRecommendation: PrimaryRecommendation;
  risk: Pick<RiskAssessment, "status" | "message">;
  rules: string[];
}

export function buildInsightContext(p: Omit<InsightContext, "rules" | "recurring"> & { recurring: RecurringSeries[] }): InsightContext {
  return {
    ...p,
    recurring: p.recurring.map(({ merchant, frequency, monthlyEquivalentCents, review }) => ({ merchant, frequency, monthlyEquivalentCents, review })),
    rules: [
      "Explain the provided numbers only; do not compute new financial figures.",
      "Do not provide risk ratings; future risk is not implemented.",
      "Do not recommend a different primary action.",
    ],
  };
}
