import type { FinancialSnapshot, RiskAssessment, RiskEngine } from "@/types/risk";

export const RISK_NOT_IMPLEMENTED_MESSAGE =
  "Future-risk analysis is awaiting the team's methodology. No risk assessment has been calculated.";

/**
 * Placeholder engine. Returns "not_implemented" and NO numeric score.
 * Replace with a real engine implementing RiskEngine — see docs/RISK_METHODOLOGY_TODO.md.
 */
export const notImplementedRiskEngine: RiskEngine = {
  methodologyVersion: null,
  assess(snapshot: FinancialSnapshot): RiskAssessment {
    return {
      status: "not_implemented",
      methodologyVersion: null,
      inputTimestamp: snapshot.generatedAt,
      dataCoverage: snapshot.coverage,
      message: RISK_NOT_IMPLEMENTED_MESSAGE,
      overall: null,
      categories: [],
      assumptions: [],
      limitations: [],
      scenarios: [],
      potentialActions: [],
    };
  },
};

/** Swap this binding to change methodology without touching UI or transaction math. */
export const activeRiskEngine: RiskEngine = notImplementedRiskEngine;
