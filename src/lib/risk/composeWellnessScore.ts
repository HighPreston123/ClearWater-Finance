import type { ScoreResult } from "@/lib/finance/score";
import type { RiskAssessment, WellnessComposition } from "@/types/risk";

/**
 * Overall wellness = f(historical cash-flow score, future-risk assessment).
 * The combination formula is undefined until the team specifies it.
 * Never substitutes zero or "low risk" for a missing assessment.
 */
export function composeWellnessScore(_historical: ScoreResult, risk: RiskAssessment): WellnessComposition {
  if (risk.status !== "ready") {
    return { status: "not_available", message: "Not yet available", reason: "Future-risk methodology pending; combination formula not defined." };
  }
  return { status: "not_available", message: "Not yet available", reason: "Combination formula not defined." };
}
