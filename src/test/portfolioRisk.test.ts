import { describe, expect, it } from "vitest";
import { annualizedVolatility, computePortfolioRisk, concentration, dailyReturns, historicalVaR, maxDrawdown } from "@/lib/risk/portfolioRisk";

const series = (symbol: string, f: (i: number) => number, n = 60) => ({
  symbol,
  points: Array.from({ length: n }, (_, i) => ({ date: new Date(Date.UTC(2026, 0, 1 + i)).toISOString(), close: f(i) })),
});

describe("portfolio risk (spec §5)", () => {
  it("uses simple daily returns", () => {
    const d = dailyReturns([100, 110, 99]); expect(d[0]).toBeCloseTo(0.1, 12); expect(d[1]).toBeCloseTo(-0.1, 12);
  });
  it("annualizes volatility with √252", () => {
    const r = [0.01, -0.01, 0.01, -0.01];
    const sd = Math.sqrt(4 * 0.0001 / 3);
    expect(annualizedVolatility(r)).toBeCloseTo(sd * Math.sqrt(252), 10);
  });
  it("max drawdown is min of value/peak - 1", () => {
    expect(maxDrawdown([100, 120, 90, 130])).toBeCloseTo(-0.25, 10);
  });
  it("HHI = Σ w²", () => {
    expect(concentration([0.5, 0.5]).hhi).toBeCloseTo(0.5, 10);
  });
  it("95% VaR is the worst 5% loss", () => {
    const r = Array.from({ length: 100 }, (_, i) => (i - 50) / 1000);
    const v = historicalVaR(r, 0.95)!;
    expect(v.var).toBeCloseTo(0.046, 10);
    expect(v.cvar).toBeCloseTo(0.048, 10);
  });
  it("risk shares sum to 1 and too-short history yields no numbers", () => {
    const a = series("A", (i) => 100 * (1 + 0.02 * Math.sin(i)));
    const b = series("B", (i) => 50 * (1 + 0.01 * Math.cos(i * 1.3)));
    const res = computePortfolioRisk([{ symbol: "A", marketValue: 600 }, { symbol: "B", marketValue: 400 }], [a, b]);
    expect(res.status).toBe("ready");
    const sum = res.holdings.reduce((s, h) => s + (h.riskShare ?? 0), 0);
    expect(sum).toBeCloseTo(1, 6);
    const short = computePortfolioRisk([{ symbol: "A", marketValue: 1 }], [series("A", (i) => 100 + i, 10)]);
    expect(short.status).toBe("insufficient_data");
    expect(short.annualVolatility).toBeNull();
  });
});
