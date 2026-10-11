import { describe, it, expect } from "vitest";
import { scoreProfile, aggregate, percentileOf, scoreProfileFoundations, scoreProfilesWithFoundations } from "@/lib/risk/profileResilience";
const base = { id: "x", annualIncomeCents: 12_000_000, monthlySpendingCents: 500_000, savingsCents: 3_000_000, debtCents: 0, debtBreakdown: {}, investmentsCents: 10_000_000 };
describe("comparison profiles", () => {
  it("scores within 0–100 and strong beats weak", () => {
    const hi = scoreProfile(base), lo = scoreProfile({ ...base, savingsCents: 0, monthlySpendingCents: 1_200_000, debtCents: 5_000_000, debtBreakdown: { credit_card_cents: 5_000_000 }, investmentsCents: 0 });
    for (const r of [hi, lo]) if (r.score !== null) expect(r.score).toBeGreaterThanOrEqual(0), expect(r.score).toBeLessThanOrEqual(100);
    expect((hi.score ?? 0)).toBeGreaterThan(lo.score ?? 0);
  });
  it("handles zero income, nulls and huge values without throwing", () => {
    for (const p of [{ ...base, annualIncomeCents: 0 }, { ...base, savingsCents: null, monthlySpendingCents: null }, { ...base, savingsCents: 1e15, investmentsCents: 1e15 }]) {
      const r = scoreProfile(p); if (r.score !== null) expect(r.score).toBeLessThanOrEqual(100);
    }
  });
  it("aggregates are deterministic and percentile is correct", () => {
    const rs = Array.from({ length: 150 }, (_, i) => scoreProfile({ ...base, savingsCents: i * 50_000 }));
    expect(aggregate(rs)).toEqual(aggregate(rs));
    expect(aggregate(rs).total).toBe(150);
    expect(percentileOf(50, [10, 20, 50, 80])).toBe(63);
    expect(percentileOf(5, [])).toBeNull();
  });
  it("scores foundations with the same formula as the survey path", () => {
    // $12k annual income, $5,000 monthly spending, $30,000 savings, no debt.
    // Cushion 6 months → 100, no debt → 100, savings rate (1000-5000)/1000 → clamped 100.
    expect(scoreProfileFoundations(base)).toBe(100);
    // $0 savings, $12,000 monthly spending, $60,000 debt: cushion 0, debt band d → 40, negative rate → 0.
    expect(scoreProfileFoundations({ ...base, savingsCents: 0, monthlySpendingCents: 1_200_000, debtCents: 6_000_000 })).toBe(13);
    // Everything unknown → unknown, never zero.
    expect(scoreProfileFoundations({ ...base, savingsCents: null, monthlySpendingCents: null, annualIncomeCents: null, debtCents: null })).toBeNull();
  });
  it("aggregates foundations deterministically and counts only scored profiles", () => {
    const inputs = Array.from({ length: 150 }, (_, i) => ({ ...base, savingsCents: i * 50_000 }));
    const a = scoreProfilesWithFoundations(inputs), b = scoreProfilesWithFoundations(inputs);
    expect(a.foundations).toEqual(b.foundations);
    expect(a.foundations.scored).toBe(150);
    expect(a.foundations.average).not.toBeNull();
    const withUnknowns = [...inputs, { ...base, savingsCents: null, monthlySpendingCents: null, annualIncomeCents: null, debtCents: null }];
    expect(scoreProfilesWithFoundations(withUnknowns).foundations.scored).toBe(150);
  });
});
