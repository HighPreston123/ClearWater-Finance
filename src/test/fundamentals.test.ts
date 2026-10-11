import { describe, expect, it } from "vitest";
import { extractFundamentals } from "@/lib/risk/fundamentals";

const facts = (gaap: Record<string, number | { latest: number; prior: number }>) => {
  const out: Record<string, { units: { USD: { end: string; form: string; val: number }[] } }> = {};
  for (const [tag, v] of Object.entries(gaap)) {
    const points = typeof v === "number"
      ? [{ end: "2025-09-30", form: "10-K", val: v }]
      : [
          { end: "2024-09-30", form: "10-K", val: v.prior },
          { end: "2025-09-30", form: "10-K", val: v.latest },
        ];
    out[tag] = { units: { USD: points } };
  }
  return { entityName: "Example Corp", facts: { "us-gaap": out } };
};

describe("extractFundamentals", () => {
  it("computes all metrics from complete data", () => {
    const m = extractFundamentals(facts({
      Revenues: { latest: 400, prior: 320 },
      OperatingIncomeLoss: 100,
      NetCashProvidedByUsedInOperatingActivities: 120,
      PaymentsToAcquirePropertyPlantAndEquipment: 30,
      LongTermDebt: 50,
      StockholdersEquity: 200,
      InterestExpense: 10,
      AssetsCurrent: 150,
      LiabilitiesCurrent: 75,
    }));
    expect(m.revenue).toBe(400);
    expect(m.revenueGrowth).toBeCloseTo(0.25);
    expect(m.operatingMargin).toBeCloseTo(0.25);
    expect(m.freeCashFlow).toBe(90);
    expect(m.fcfMargin).toBeCloseTo(0.225);
    expect(m.debtToEquity).toBeCloseTo(0.25);
    expect(m.interestCoverage).toBeCloseTo(10);
    expect(m.currentRatio).toBeCloseTo(2);
    expect(m.unavailable).toEqual([]);
  });

  it("marks growth not meaningful when prior revenue is zero or negative", () => {
    const m = extractFundamentals(facts({ Revenues: { latest: 100, prior: 0 } }));
    expect(m.revenueGrowth).toBeNull();
    expect(m.unavailable).toContain("revenueGrowth");
  });

  it("marks debt-to-equity not meaningful with negative equity", () => {
    const m = extractFundamentals(facts({ LongTermDebt: 50, StockholdersEquity: -10 }));
    expect(m.debtToEquity).toBeNull();
    expect(m.unavailable).toContain("debtToEquity");
  });

  it("returns nulls, never zeros, when tags are missing", () => {
    const m = extractFundamentals({ entityName: "Empty Inc", facts: { "us-gaap": {} } });
    expect(m.revenue).toBeNull();
    expect(m.freeCashFlow).toBeNull();
    expect(m.currentRatio).toBeNull();
    expect(m.unavailable.length).toBeGreaterThan(0);
  });
});
