import { describe, it, expect } from "vitest";
import { buildInsightPayload } from "./payload";

const base = {
  periodLabel: "May 2026",
  summary: { income: 500000, spending: 320000, net: 180000, surplusRate: 36, savingsTransfers: 10000, investmentContributions: 5000, otherTransfers: 99, transactionCount: 42 },
  recurringCount: 3, recurringMonthlyCents: 12000, investmentsCents: null, investmentsPartial: false,
  score: { status: "ok", score: 81, label: "Strong", limitedHistory: false },
  wellness: { status: "no_data", message: "Needs more info" },
  recommendation: { title: "T", detail: "D", nextStep: "N" },
};
describe("insight payload", () => {
  it("passes through actual figures and drops unrelated fields", () => {
    const p = buildInsightPayload(base);
    expect(p.incomeCents).toBe(500000);
    expect(p.netCents).toBe(180000);
    expect(p.historicalScore).toEqual({ value: 81, label: "Strong", limitedHistory: false });
    expect(JSON.stringify(p)).not.toContain("otherTransfers");
  });
  it("marks missing data as unavailable instead of zero", () => {
    const p = buildInsightPayload(base);
    expect(p.futureResilience).toEqual({ unavailable: "Needs more info" });
    expect(p.trackedInvestmentsCents).toBeNull();
  });
});
