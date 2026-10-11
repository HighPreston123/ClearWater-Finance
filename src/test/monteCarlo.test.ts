import { describe, expect, it } from "vitest";
import { missingMonteCarloInputs, runMonteCarlo, type MonteCarloInputs } from "@/lib/risk/monteCarlo";

const base: MonteCarloInputs = {
  currentAge: 40,
  retirementAge: 65,
  horizonAge: 90,
  initialBalance: 500_000,
  annualContribution: 20_000,
  annualRetirementSpending: 60_000,
  annualDependableIncome: 30_000,
  meanReturn: 0.04,
  volatility: 0.15,
  feeRate: 0.005,
  df: 5,
  paths: 2000,
  seed: 42,
};

describe("runMonteCarlo", () => {
  it("is reproducible for the same seed and inputs", () => {
    const a = runMonteCarlo(base);
    const b = runMonteCarlo(base);
    expect(a.depletionProbability).toBe(b.depletionProbability);
    expect(a.medianEndingBalance).toBe(b.medianEndingBalance);
  });

  it("reports probabilities between 0 and 1 with ordered percentiles", () => {
    const r = runMonteCarlo(base);
    for (const p of [r.depletionProbability, r.essentialCoverageProbability, r.goalProbability]) {
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(1);
    }
    expect(r.p10EndingBalance).toBeLessThanOrEqual(r.medianEndingBalance);
    expect(r.medianEndingBalance).toBeLessThanOrEqual(r.p90EndingBalance);
  });

  it("depletes with certainty when spending vastly exceeds resources", () => {
    const r = runMonteCarlo({ ...base, initialBalance: 10_000, annualContribution: 0, annualRetirementSpending: 200_000, annualDependableIncome: 0, retirementAge: 41 });
    expect(r.depletionProbability).toBe(1);
    expect(r.essentialCoverageProbability).toBe(0);
    expect(r.medianDepletionAge).not.toBeNull();
  });

  it("never depletes when dependable income covers all spending", () => {
    const r = runMonteCarlo({ ...base, annualRetirementSpending: 20_000, annualDependableIncome: 50_000 });
    expect(r.depletionProbability).toBe(0);
    expect(r.medianDepletionAge).toBeNull();
  });

  it("stress scenarios never beat the baseline on every dimension by construction", () => {
    const r = runMonteCarlo(base);
    const lowLongRun = r.scenarios.find((s) => s.id === "low_long_run")!;
    expect(lowLongRun.depletionProbability).toBeGreaterThanOrEqual(r.depletionProbability - 0.15); // same direction, allowing sampling noise
    expect(r.sensitivities).toHaveLength(4);
    expect(r.scenarios).toHaveLength(6);
  });
});

describe("missingMonteCarloInputs", () => {
  it("flags missing required inputs instead of treating them as zero", () => {
    expect(missingMonteCarloInputs({})).toEqual(["currentAge", "retirementAge", "horizonAge", "initialBalance", "annualRetirementSpending"]);
    expect(missingMonteCarloInputs(base)).toEqual([]);
  });
});
