import type { FinancialSnapshot, RiskAssessment, RiskContext, RiskEngine } from "@/types/risk";
import { computeResilience, resilienceActions, resilienceScenarios, RESILIENCE_VERSION } from "@/lib/risk/resilience";

export const RISK_NOT_IMPLEMENTED_MESSAGE =
  "Future-risk analysis is awaiting the team's methodology. No risk assessment has been calculated.";

/** Kept for reference/tests: returns "not_implemented" and NO numeric score. */
export const notImplementedRiskEngine: RiskEngine = {
  methodologyVersion: null,
  assess(snapshot: FinancialSnapshot): RiskAssessment {
    return {
      status: "not_implemented", methodologyVersion: null, inputTimestamp: snapshot.generatedAt, dataCoverage: snapshot.coverage,
      message: RISK_NOT_IMPLEMENTED_MESSAGE, overall: null, categories: [], assumptions: [], limitations: [], scenarios: [], potentialActions: [],
    };
  },
};

/** Future Resilience Score — Methodology v1. */
export const resilienceRiskEngine: RiskEngine = {
  methodologyVersion: RESILIENCE_VERSION,
  assess(snapshot: FinancialSnapshot, ctx: RiskContext = {}): RiskAssessment {
    const input = { snapshot, ...ctx };
    const r = computeResilience(input);
    const base = { methodologyVersion: RESILIENCE_VERSION, inputTimestamp: snapshot.generatedAt, dataCoverage: snapshot.coverage, resilience: r };
    const categories = r.pillars.map((p) => ({
      categoryId: p.id, label: p.label, contribution: p.score === null ? null : { score: p.score, weight: p.effectiveWeight, points: p.points, pointsLost: p.pointsLost },
      evidence: p.subMetrics.filter((m) => m.weight > 0).map((m) => `${m.label}: ${m.value}${m.basis === "approximate" ? " (approximate)" : ""}`),
    }));
    const limitations = [...r.flags, ...r.unknowns.map((u) => `Unknown — ${u}`)];
    if (r.status !== "ready") {
      return { ...base, status: "insufficient_data", message: `Insufficient data: scored pillars cover ${Math.round(r.scoredWeight * 100)}% of the weight (60% needed).`, overall: null, categories, assumptions: r.assumptions, limitations, scenarios: [], potentialActions: [] };
    }
    const scenarios = resilienceScenarios(input, r).map((s) => ({ id: s.id, label: s.label, result: s }));
    const potentialActions = resilienceActions(input, r).map((a) => `${a.label} (+${a.gain} points)`);
    return {
      ...base, status: "ready",
      message: `Future Resilience Score ${r.score}/100 (${r.band}), confidence ${r.confidence}${r.gate ? `, capped by ${r.gate.id} ${r.gate.label}` : ""}.`,
      overall: { value: r.score, label: r.band ?? "Ready", scaleDescription: "0–100, higher is more resilient" },
      categories, assumptions: r.assumptions, limitations, scenarios, potentialActions,
    };
  },
};

/** Swap this binding to change methodology without touching UI or transaction math. */
export const activeRiskEngine: RiskEngine = resilienceRiskEngine;
