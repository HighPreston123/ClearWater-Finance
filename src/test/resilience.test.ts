import { describe, expect, it } from "vitest";
import { computeResilience, curve, CURVES } from "@/lib/risk/resilience";
import { EMPTY_MANUAL_INPUTS } from "@/lib/risk/buildFinancialSnapshot";
import type { FinancialSnapshot } from "@/types/risk";

const month = (m: string, income: number, spending: number) => ({ month: m, income, spending, net: income - spending, surplusRate: null, savingsTransfers: 0, investmentContributions: 0, otherTransfers: 0, transactionCount: 10 });
const snap = (over: Partial<FinancialSnapshot> = {}): FinancialSnapshot => ({
  generatedAt: "2026-10-11T00:00:00Z",
  cashFlow: { selectedRange: month("x", 0, 0), months: [] },
  recurring: [],
  manual: { ...EMPTY_MANUAL_INPUTS, emergencyFundCents: 5_000_000, emergencyFundTargetCents: 10_000_000, updatedAt: "2026-10-01T00:00:00Z",
    debts: [{ id: "a", name: "A", balanceCents: 3_000_000, aprPercent: 3.5, minPaymentCents: null }, { id: "b", name: "B", balanceCents: 1_500_000, aprPercent: 4.1, minPaymentCents: null }] },
  investments: { accounts: [], holdings: [{} as never], totalValueMicros: String(112_775 * 1e6), partial: false },
  marketHistory: null, coverage: [], ...over,
});

describe("Future Resilience Score v1", () => {
  it("runway curve follows the published anchors", () => {
    expect(curve(3, CURVES.runway)).toBe(60);
    expect(curve(9, CURVES.runway)).toBe(100);
    expect(curve(7.5, CURVES.runway)).toBeCloseTo(95);
  });
  it("liquidity pillar matches the worked example (81.9 at $6,500 essentials)", () => {
    const r = computeResilience({ snapshot: snap(), surveyAnswers: { s06_essential_expenses: "s06_d" } });
    expect(r.pillars.find((p) => p.id === "liquidity")!.score).toBeCloseTo(81.9, 0);
  });
  it("debt pillar matches the worked example (98.9) with payments unknown", () => {
    const r = computeResilience({ snapshot: snap(), surveyAnswers: { s06_essential_expenses: "s06_d" } });
    expect(r.pillars.find((p) => p.id === "debt")!.score).toBeCloseTo(98.9, 0);
  });
  it("runway under 1 month caps the score at 40 (G1)", () => {
    const s = snap({ manual: { ...snap().manual, emergencyFundCents: 100_000, debtsConfirmedNone: true, debts: [] } });
    const r = computeResilience({ snapshot: s, surveyAnswers: { s06_essential_expenses: "s06_d" } });
    expect(r.gate?.id).toBe("G1");
    expect(r.score).toBeLessThanOrEqual(40);
  });
  it("shows no number when scored pillars carry under 60% of the weight", () => {
    const r = computeResilience({ snapshot: snap({ manual: EMPTY_MANUAL_INPUTS, investments: { accounts: [], holdings: [], totalValueMicros: "0", partial: false } }) });
    expect(r.status).toBe("insufficient_data");
    expect(r.score).toBeNull();
  });
  it("shrinks short cash-flow history toward 50", () => {
    const months = [month("2026-06", 100, 50), month("2026-07", 100, 50), month("2026-08", 100, 50)];
    const r = computeResilience({ snapshot: snap({ cashFlow: { selectedRange: months[0]!, months } }) });
    const p2 = r.pillars.find((p) => p.id === "cashflow")!.score!;
    expect(p2).toBeLessThan(100);
    expect(p2).toBeGreaterThan(50);
  });
});
