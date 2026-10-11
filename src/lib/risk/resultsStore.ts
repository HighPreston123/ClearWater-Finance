import { useSyncExternalStore } from "react";
import type { PortfolioRiskResult } from "@/lib/risk/portfolioRisk";
import type { MonteCarloResult } from "@/lib/risk/monteCarlo";
import type { FundamentalMetrics } from "@/lib/risk/fundamentals";
import type { SurveyAnswers, TargetProfile } from "@/lib/risk/survey";

/**
 * Tiny in-memory store letting the Risk page cards share their latest results
 * so the wellness score can combine them. Session-only; nothing is persisted
 * here (each card owns its own persistence).
 */
export interface RiskResults {
  portfolioRisk: PortfolioRiskResult | null;
  targetProfile: TargetProfile | null;
  surveyAnswers: SurveyAnswers | null;
  monteCarlo: MonteCarloResult | null;
  fundamentals: FundamentalMetrics[] | null;
}

let state: RiskResults = {
  portfolioRisk: null,
  targetProfile: null,
  surveyAnswers: null,
  monteCarlo: null,
  fundamentals: null,
};

const listeners = new Set<() => void>();

export function publishRiskResult<K extends keyof RiskResults>(key: K, value: RiskResults[K]) {
  if (state[key] === value) return;
  state = { ...state, [key]: value };
  for (const l of listeners) l();
}

export function useRiskResults(): RiskResults {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
  );
}
