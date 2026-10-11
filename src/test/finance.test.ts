import { describe, expect, it } from "vitest";
import { SAMPLE_TRANSACTIONS } from "@/data/sampleTransactions";
import { computeHistoricalScore } from "@/lib/finance/score";
import { summarize, filterByRange } from "@/lib/finance/metrics";
import { detectRecurring } from "@/lib/finance/recurring";
import { multiplyToMicros } from "@/lib/investments/valuation";
import { notImplementedRiskEngine } from "@/lib/risk/riskEngine";

describe("finance", () => {
  it("has 60+ transactions", () => expect(SAMPLE_TRANSACTIONS.length).toBeGreaterThanOrEqual(60));
  it("August is negative, transfers excluded", () => {
    const s = summarize(filterByRange(SAMPLE_TRANSACTIONS, { start: "2026-08-01", end: "2026-08-31" }));
    expect(s.net).toBeLessThan(0);
    expect(s.investmentContributions).toBe(20000);
  });
  it("score reconciles", () => {
    const r = computeHistoricalScore(SAMPLE_TRANSACTIONS, { start: "2026-09-01", end: "2026-09-30" });
    expect(r.status).toBe("ok");
    if (r.status === "ok") expect(r.score).toBe(r.factors.reduce((s, f) => s + f.earned, 0));
  });
  it("limited history normalizes", () => {
    const r = computeHistoricalScore(SAMPLE_TRANSACTIONS, { start: "2026-07-01", end: "2026-07-31" });
    expect(r.status === "ok" && r.limitedHistory && r.score).toBe(100);
  });
  it("detects weekly + variable monthly", () => {
    const s = detectRecurring(SAMPLE_TRANSACTIONS, {});
    expect(s.find((x) => x.merchant.includes("Metro"))?.frequency).toBe("weekly");
    expect(s.find((x) => x.merchant.includes("Power"))).toBeTruthy();
  });
  it("decimal math", () => expect(multiplyToMicros("20.125", "286.12")).toBe(5758165000n));
  it("risk engine not implemented", () => {
    const a = notImplementedRiskEngine.assess({ generatedAt: "x", coverage: [] } as never);
    expect(a.status).toBe("not_implemented");
    expect(a.overall).toBeNull();
  });
});
