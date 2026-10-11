import { describe, expect, it } from "vitest";
import {
  composeWellness,
  scoreFoundationsCore,
  scoreFoundationsPillar,
  scoreFundamentalsPillar,
  scorePortfolioPillar,
  scoreRetirementPillar,
  surveyDebtBandScore,
  surveyDependableScore,
} from "@/lib/risk/wellness";
import type { PortfolioRiskResult } from "@/lib/risk/portfolioRisk";
import type { MonteCarloResult } from "@/lib/risk/monteCarlo";
import type { FundamentalMetrics } from "@/lib/risk/fundamentals";
import type { TargetProfile } from "@/lib/risk/survey";

const riskResult = (over: Partial<PortfolioRiskResult> = {}): PortfolioRiskResult => ({
  status: "ready",
  reason: null,
  tradingDays: 252,
  observations: 250,
  window: { start: "2025-01-01", end: "2025-12-31" },
  missingSymbols: [],
  annualVolatility: 0.15,
  maxDrawdown: -0.12,
  var: [],
  cvar: [],
  beta: 1,
  benchmarkSymbol: "SPY",
  concentration: { hhi: 0.1, largestWeight: 0.2, top5Weight: 0.6, grossExposure: 1, netExposure: 1 },
  correlations: [],
  holdings: [],
  regularization: { applied: false, shrinkage: 0 },
  calculatedAt: "2026-01-01T00:00:00Z",
  ...over,
});

const target = (over: Partial<TargetProfile> = {}): TargetProfile => ({
  horizonYears: 25,
  planningHorizonAge: 95,
  growthPreference: 0.8,
  preferredVolatility: "moderate",
  liquidityNeed: "low",
  maxTolerableLoss: 0.2,
  unknowns: [],
  ...over,
});

const mcResult = (over: Partial<MonteCarloResult> = {}): MonteCarloResult => ({
  status: "ready",
  paths: 1000,
  years: 40,
  depletionProbability: 0.1,
  essentialCoverageProbability: 0.9,
  medianEndingBalance: 1_000_000,
  p10EndingBalance: 0,
  p90EndingBalance: 3_000_000,
  medianDepletionAge: null,
  goalProbability: 0.95,
  sensitivities: [],
  scenarios: [],
  assumptions: {},
  ...over,
});

const fundamentals = (over: Partial<FundamentalMetrics> = {}): FundamentalMetrics => ({
  companyName: "Example Corp",
  periodEnd: "2025-12-31",
  revenue: 1e9,
  revenueGrowth: 0.1,
  operatingMargin: 0.2,
  freeCashFlow: 1e8,
  fcfMargin: 0.1,
  debtToEquity: 0.5,
  interestCoverage: 10,
  currentRatio: 2,
  unavailable: [],
  ...over,
});

describe("wellness score", () => {
  it("returns null overall when no pillar has data", () => {
    const w = composeWellness({ portfolioRisk: null, targetProfile: null, monteCarlo: null, fundamentals: null, surveyAnswers: null });
    expect(w.overall).toBeNull();
    expect(w.missing).toHaveLength(4);
  });

  it("scores a calm, on-target portfolio highly and a wild one poorly", () => {
    const calm = scorePortfolioPillar(riskResult(), target());
    const wild = scorePortfolioPillar(riskResult({ annualVolatility: 0.5, maxDrawdown: -0.55, concentration: { hhi: 0.9, largestWeight: 0.9, top5Weight: 1, grossExposure: 1, netExposure: 1 } }), target());
    expect(calm.score).not.toBeNull();
    expect(wild.score).not.toBeNull();
    expect(calm.score!).toBeGreaterThan(wild.score!);
    expect(wild.score!).toBeLessThan(30);
  });

  it("scores retirement readiness from depletion probability", () => {
    expect(scoreRetirementPillar(null).score).toBeNull();
    const good = scoreRetirementPillar(mcResult({ depletionProbability: 0, essentialCoverageProbability: 1 }));
    const bad = scoreRetirementPillar(mcResult({ depletionProbability: 0.8, essentialCoverageProbability: 0.3 }));
    expect(good.score).toBe(100);
    expect(bad.score!).toBeLessThan(40);
  });

  it("skips missing fundamentals metrics instead of treating them as zero", () => {
    const sparse = scoreFundamentalsPillar([fundamentals({ revenueGrowth: null, operatingMargin: null, fcfMargin: null, debtToEquity: null, interestCoverage: null, currentRatio: 2 })]);
    expect(sparse.score).toBe(80); // currentRatio 2 / 2.5 * 100
    expect(scoreFundamentalsPillar([]).score).toBeNull();
  });

  it("scores foundations from survey bands and ignores unknown answers", () => {
    const strong = scoreFoundationsPillar({
      s05_gross_income: "s05_d",
      s06_essential_expenses: "s06_b",
      s07_discretionary_spending: "s07_a",
      s08_liquid_savings: "s08_e",
      s09_total_debt: "s09_a",
      s10_dependable_income: "s10_c",
    });
    expect(strong.score!).toBeGreaterThan(80);
    const unknown = scoreFoundationsPillar({ s08_liquid_savings: "s08_f", s09_total_debt: "s09_f" });
    expect(unknown.score).toBeNull();
  });

  it("scoreFoundationsCore gives the same result as the survey path on the same numbers", () => {
    const answers = {
      s05_gross_income: "s05_b", s06_essential_expenses: "s06_b", s08_liquid_savings: "s08_c",
      s09_total_debt: "s09_c", s10_dependable_income: "s10_b",
    };
    const viaSurvey = scoreFoundationsPillar(answers).score;
    const viaCore = scoreFoundationsCore({
      liquidSavings: 12_500, essentialMonthly: 2_250, grossAnnualIncome: 37_500, discretionaryMonthly: null,
      debtBandScore: surveyDebtBandScore("s09_c"), dependableScore: surveyDependableScore("s10_b"),
    });
    expect(viaSurvey).not.toBeNull();
    expect(viaCore).toBe(viaSurvey);
  });

  it("renormalizes weights across available pillars", () => {
    const w = composeWellness({
      portfolioRisk: null,
      targetProfile: null,
      monteCarlo: mcResult({ depletionProbability: 0, essentialCoverageProbability: 1 }), // 100
      fundamentals: null,
      surveyAnswers: { s09_total_debt: "s09_a" }, // 100
    });
    expect(w.overall).toBe(100);
    expect(w.missing).toEqual(["Portfolio risk alignment", "Company fundamentals"]);
  });
});
