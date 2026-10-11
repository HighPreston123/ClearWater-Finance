import type { Holding, InvestmentAccount } from "@/types/investments";

/** Clearly labeled sample data. Prices and values are illustrative only. */
export const SAMPLE_ACCOUNTS: InvestmentAccount[] = [
  { id: "inv-brokerage-1", name: "Everyday Brokerage", type: "taxable_brokerage", institution: "Sample Brokerage Co.", currency: "USD", cashCents: 41250, valuationTimestamp: "2026-10-09T20:00:00Z", source: "sample" },
  { id: "inv-brokerage-2", name: "Robo Starter Account", type: "taxable_brokerage", institution: "Sample Robo Advisor", currency: "USD", cashCents: 1580, valuationTimestamp: "2026-10-09T20:00:00Z", source: "sample" },
  { id: "inv-401k-1", name: "Employer 401(k)", type: "401k", institution: "Sample Retirement Plan", currency: "USD", cashCents: 0, valuationTimestamp: "2026-09-30T20:00:00Z", source: "sample" },
  { id: "inv-roth-1", name: "Roth IRA", type: "roth_ira", institution: "Sample Brokerage Co.", currency: "USD", cashCents: 12500, valuationTimestamp: "2026-10-09T20:00:00Z", source: "sample" },
  { id: "inv-hsa-1", name: "HSA Investments", type: "hsa", institution: "Sample HSA Bank", currency: "USD", cashCents: 0, valuationTimestamp: "2026-10-09T20:00:00Z", source: "sample" },
];

export const SAMPLE_HOLDINGS: Holding[] = [
  { id: "h-001", accountId: "inv-brokerage-1", symbol: "AAPL", name: "Apple Inc.", assetClass: "stock", quantity: "12.5", latestPrice: "228.40", priceTimestamp: "2026-10-09T20:00:00Z", costBasisCents: 240000, sector: "Technology", source: "sample" },
  { id: "h-002", accountId: "inv-brokerage-1", symbol: "VTI", name: "Total US Stock Market ETF", assetClass: "etf", quantity: "20.125", latestPrice: "286.12", priceTimestamp: "2026-10-09T20:00:00Z", underlyingExposure: "US equities (broad market)", source: "sample" },
  { id: "h-003", accountId: "inv-brokerage-1", symbol: "BND", name: "Total Bond Market ETF", assetClass: "etf", quantity: "15", latestPrice: "72.85", priceTimestamp: "2026-10-09T20:00:00Z", underlyingExposure: "US investment-grade bonds", costBasisCents: 112500, source: "sample" },
  { id: "h-004", accountId: "inv-brokerage-2", symbol: "XYZQ", name: "Unclassified sample fund", assetClass: "unknown", quantity: "8.3317", latestPrice: "41.07", priceTimestamp: "2026-10-09T20:00:00Z", source: "sample" },
  { id: "h-005", accountId: "inv-401k-1", symbol: null, externalSecurityId: "PLAN-TD2060", name: "Target Date 2060 Fund", assetClass: "mutual_fund", quantity: "310.442", latestPrice: null, priceTimestamp: null, suppliedValueCents: 1425000, suppliedValueDate: "2026-09-30", underlyingExposure: "Mixed stocks and bonds (glide path)", source: "sample" },
  { id: "h-006", accountId: "inv-roth-1", symbol: "VXUS", name: "Total International Stock ETF", assetClass: "etf", quantity: "40.3317", latestPrice: "64.21", priceTimestamp: "2026-10-09T20:00:00Z", underlyingExposure: "Non-US equities", source: "sample" },
  { id: "h-007", accountId: "inv-roth-1", symbol: "MSFT", name: "Microsoft Corp.", assetClass: "stock", quantity: "3.25", latestPrice: "431.10", priceTimestamp: "2026-09-15T20:00:00Z", sector: "Technology", source: "sample" },
  { id: "h-008", accountId: "inv-hsa-1", symbol: "HSAMM", name: "HSA Money Market", assetClass: "cash", quantity: "1820.55", latestPrice: "1.00", priceTimestamp: "2026-10-09T20:00:00Z", source: "sample" },
  { id: "h-009", accountId: "inv-hsa-1", symbol: null, externalSecurityId: "PRIV-REIT-01", name: "Private real estate interest", assetClass: "other", quantity: "1", latestPrice: null, priceTimestamp: null, suppliedValueCents: null, suppliedValueDate: null, source: "sample" },
];
