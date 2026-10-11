import { describe, it, expect } from "vitest";
import { scoreProfile, aggregate, percentileOf } from "@/lib/risk/profileResilience";
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
});
