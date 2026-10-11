import type { ScoreResult } from "@/lib/finance/score";
import type { RiskAssessment, WellnessComposition } from "@/types/risk";

/**
 * Overall score on the dashboard. Team decision: show the Future Resilience Score
 * alongside the existing wellness score (they are not merged). Never substitutes
 * zero or "low risk" for a missing assessment.
 */
export function composeWellnessScore(_historical: ScoreResult, risk: RiskAssessment): WellnessComposition {
  if (risk.status !== "ready" || !risk.resilience || risk.resilience.score === null) {
    return { status: "not_available", message: "Not yet available", reason: risk.message };
  }
  return { status: "ok", value: risk.resilience.score, label: `${risk.resilience.band} · ${risk.resilience.confidence} confidence`, methodologyVersion: risk.methodologyVersion ?? "" };
}
