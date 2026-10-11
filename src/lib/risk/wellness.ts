import type { PortfolioRiskResult } from "@/lib/risk/portfolioRisk";
import type { MonteCarloResult } from "@/lib/risk/monteCarlo";
import type { FundamentalMetrics } from "@/lib/risk/fundamentals";
import { bandValue, type SurveyAnswers, type TargetProfile } from "@/lib/risk/survey";

/**
 * Financial wellness score (0–100) combining the four risk-assessment pillars.
 * Transparent heuristic: every pillar is scored 0–100 from measurable inputs,
 * weights are renormalized over the pillars that have data, and a pillar with
 * no data is null — never silently treated as zero or "fine".
 * This is an educational estimate, not financial advice.
 */

export interface WellnessPillar {
  id: "portfolio" | "retirement" | "fundamentals" | "foundations";
  label: string;
  weight: number;
  /** 0–100, or null when the inputs needed are missing. */
  score: number | null;
  detail: string;
}

export interface WellnessScore {
  /** 0–100, or null when no pillar has data. */
  overall: number | null;
  pillars: WellnessPillar[];
  /** Human-readable note on which pillars were missing. */
  missing: string[];
}

const clamp = (x: number, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, x));

const VOL_MIDPOINT: Record<NonNullable<TargetProfile["preferredVolatility"]>, number> = {
  very_low: 0.05,
  low: 0.1,
  moderate: 0.18,
  high: 0.28,
  very_high: 0.4,
};

/** Portfolio risk alignment: actual volatility/drawdown vs the target profile, plus concentration. */
export function scorePortfolioPillar(risk: PortfolioRiskResult | null, target: TargetProfile | null): WellnessPillar {
  const base = { id: "portfolio" as const, label: "Portfolio risk alignment", weight: 0.3 };
  if (!risk || risk.status !== "ready") return { ...base, score: null, detail: "Run the portfolio risk calculation first." };
  const parts: number[] = [];

  if (risk.annualVolatility !== null) {
    const targetVol = target?.preferredVolatility ? VOL_MIDPOINT[target.preferredVolatility] : null;
    if (targetVol !== null) {
      // Full marks at or below target; decays to 0 at 2.5× target.
      parts.push(clamp(100 * (1 - Math.max(0, risk.annualVolatility - targetVol) / (1.5 * targetVol))));
    } else {
      // No stated preference: absolute scale, 0% vol → 100, 45%+ → 0.
      parts.push(clamp(100 * (1 - risk.annualVolatility / 0.45)));
    }
  }
  if (risk.maxDrawdown !== null) {
    const dd = Math.abs(risk.maxDrawdown);
    const limit = target?.maxTolerableLoss ?? null;
    if (limit !== null && limit > 0) {
      parts.push(clamp(100 * (1 - Math.max(0, dd - limit) / limit)));
    } else if (limit === 0) {
      parts.push(dd === 0 ? 100 : 0);
    } else {
      parts.push(clamp(100 * (1 - dd / 0.6)));
    }
  }
  // Concentration: HHI 0 (fully spread) → 100, HHI 1 (single holding) → 0.
  parts.push(clamp(100 * (1 - risk.concentration.hhi)));

  if (!parts.length) return { ...base, score: null, detail: "Not enough price history to score." };
  const score = Math.round(parts.reduce((a, b) => a + b, 0) / parts.length);
  return {
    ...base,
    score,
    detail: `Volatility ${risk.annualVolatility !== null ? `${(risk.annualVolatility * 100).toFixed(1)}%` : "unknown"}, max drawdown ${risk.maxDrawdown !== null ? `${(risk.maxDrawdown * 100).toFixed(1)}%` : "unknown"}, largest holding ${(risk.concentration.largestWeight * 100).toFixed(0)}% of portfolio.`,
  };
}

/** Retirement readiness from the Monte Carlo simulation. */
export function scoreRetirementPillar(mc: MonteCarloResult | null): WellnessPillar {
  const base = { id: "retirement" as const, label: "Retirement readiness", weight: 0.3 };
  if (!mc) return { ...base, score: null, detail: "Run the retirement simulation first." };
  const score = Math.round(clamp(100 * (0.6 * (1 - mc.depletionProbability) + 0.4 * mc.essentialCoverageProbability)));
  return {
    ...base,
    score,
    detail: `${(mc.depletionProbability * 100).toFixed(1)}% chance of running out of money; essentials covered in ${(mc.essentialCoverageProbability * 100).toFixed(0)}% of simulated futures.`,
  };
}

/** Fundamentals health: average per-holding quality signals; skips missing metrics. */
export function scoreFundamentalsPillar(fundamentals: FundamentalMetrics[] | null): WellnessPillar {
  const base = { id: "fundamentals" as const, label: "Company fundamentals", weight: 0.2 };
  if (!fundamentals || !fundamentals.length) return { ...base, score: null, detail: "Load company fundamentals first." };
  const perHolding: number[] = [];
  for (const f of fundamentals) {
    const parts: number[] = [];
    if (f.revenueGrowth !== null) parts.push(clamp(50 + f.revenueGrowth * 250)); // +20% growth → 100, −20% → 0
    if (f.operatingMargin !== null) parts.push(clamp(50 + f.operatingMargin * 150));
    if (f.fcfMargin !== null) parts.push(clamp(50 + f.fcfMargin * 200));
    if (f.interestCoverage !== null) parts.push(clamp((f.interestCoverage / 8) * 100));
    if (f.currentRatio !== null) parts.push(clamp((f.currentRatio / 2.5) * 100));
    if (f.debtToEquity !== null) parts.push(clamp(100 * (1 - f.debtToEquity / 3)));
    if (parts.length) perHolding.push(parts.reduce((a, b) => a + b, 0) / parts.length);
  }
  if (!perHolding.length) return { ...base, score: null, detail: "No usable fundamentals in the latest filings." };
  const score = Math.round(perHolding.reduce((a, b) => a + b, 0) / perHolding.length);
  return { ...base, score, detail: `Average across ${perHolding.length} holding(s) with usable filing data.` };
}

/** Financial foundations from the survey: emergency cushion, debt load, savings rate, dependable income. */
export function scoreFoundationsPillar(answers: SurveyAnswers | null): WellnessPillar {
  const base = { id: "foundations" as const, label: "Financial foundations", weight: 0.2 };
  if (!answers || !Object.keys(answers).length) return { ...base, score: null, detail: "Complete the financial assessment survey first." };
  const parts: number[] = [];

  const savings = bandValue("s08_liquid_savings", answers["s08_liquid_savings"]);
  const essential = bandValue("s06_essential_expenses", answers["s06_essential_expenses"]);
  if (savings !== null && essential !== null && essential > 0) {
    const months = savings / essential;
    parts.push(clamp((months / 6) * 100)); // 6+ months of essentials → 100
  }
  const debtAnswer = answers["s09_total_debt"];
  if (debtAnswer) {
    const debtScore: Record<string, number> = { s09_a: 100, s09_b: 85, s09_c: 65, s09_d: 40, s09_e: 15 };
    const v = debtScore[debtAnswer];
    if (v !== undefined) parts.push(v);
  }
  const income = bandValue("s05_gross_income", answers["s05_gross_income"]);
  const discretionary = bandValue("s07_discretionary_spending", answers["s07_discretionary_spending"]);
  if (income !== null && essential !== null && discretionary !== null && income > 0) {
    const monthlyIncome = income / 12;
    const savingsRate = (monthlyIncome - essential - discretionary) / monthlyIncome;
    parts.push(clamp((savingsRate / 0.2) * 100)); // 20%+ savings rate → 100
  }
  const dependable = answers["s10_dependable_income"];
  if (dependable) {
    const v = { s10_a: 30, s10_b: 70, s10_c: 100 }[dependable];
    if (v !== undefined) parts.push(v);
  }

  if (!parts.length) return { ...base, score: null, detail: "Survey answers were too incomplete to score." };
  const score = Math.round(parts.reduce((a, b) => a + b, 0) / parts.length);
  return { ...base, score, detail: "Based on your savings cushion, debt, savings rate, and dependable income." };
}

export function composeWellness(input: {
  portfolioRisk: PortfolioRiskResult | null;
  targetProfile: TargetProfile | null;
  monteCarlo: MonteCarloResult | null;
  fundamentals: FundamentalMetrics[] | null;
  surveyAnswers: SurveyAnswers | null;
}): WellnessScore {
  const pillars: WellnessPillar[] = [
    scorePortfolioPillar(input.portfolioRisk, input.targetProfile),
    scoreRetirementPillar(input.monteCarlo),
    scoreFundamentalsPillar(input.fundamentals),
    scoreFoundationsPillar(input.surveyAnswers),
  ];
  const available = pillars.filter((p) => p.score !== null);
  const missing = pillars.filter((p) => p.score === null).map((p) => p.label);
  if (!available.length) return { overall: null, pillars, missing };
  const totalWeight = available.reduce((a, p) => a + p.weight, 0);
  const overall = Math.round(available.reduce((a, p) => a + (p.score as number) * (p.weight / totalWeight), 0));
  return { overall, pillars, missing };
}
