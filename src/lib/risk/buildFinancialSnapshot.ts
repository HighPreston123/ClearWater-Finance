import type { CashFlowSummary, MonthSummary, RecurringSeries } from "@/types/finance";
import type { Holding, InvestmentAccount } from "@/types/investments";
import type { FinancialSnapshot, InputCoverageItem, ManualFinancialInputs } from "@/types/risk";
import { valuePortfolio } from "@/lib/investments/valuation";

const STALE_MANUAL_DAYS = 90;

/** Summary of the latest auto-fetched Alpaca daily-bar history (from the portfolio risk run). */
export interface MarketCoverage { status: "ready" | "insufficient_data"; observations: number; window: { start: string; end: string } | null; missingSymbols: string[] }

function marketItem(m: MarketCoverage | null | undefined): InputCoverageItem {
  const base = { id: "market", category: "Historical market data" } as const;
  if (!m) return { ...base, availability: "missing", detail: "Loads automatically from Alpaca when you have priced holdings" };
  if (m.status !== "ready" || !m.observations) return { ...base, availability: "missing", detail: "Not enough daily price history for your holdings" };
  const miss = m.missingSymbols.length ? `; no history for ${m.missingSymbols.join(", ")}` : "";
  return { ...base, availability: m.missingSymbols.length ? "stale" : "available", detail: `${m.observations} trading days${m.window ? ` (${m.window.start} → ${m.window.end})` : ""}${miss}` };
}

export const EMPTY_MANUAL_INPUTS: ManualFinancialInputs = {
  emergencyFundCents: null,
  emergencyFundTargetCents: null,
  cashReserves: [],
  debts: [],
  debtsConfirmedNone: false,
  obligations: [],
  goals: [],
  timeHorizonYears: null,
  riskComfort: "unknown",
  updatedAt: null,
};

export function computeCoverage(p: {
  months: MonthSummary[];
  recurring: RecurringSeries[];
  manual: ManualFinancialInputs;
  holdings: Holding[];
  portfolioPartial: boolean;
  portfolioStale: number;
  now?: Date | undefined;
  market?: MarketCoverage | null | undefined;
}): InputCoverageItem[] {
  const now = p.now ?? new Date();
  const manualStale = p.manual.updatedAt ? now.getTime() - Date.parse(p.manual.updatedAt) > STALE_MANUAL_DAYS * 86_400_000 : false;
  const man = (has: boolean): InputCoverageItem["availability"] => (has ? (manualStale ? "stale" : "manual") : "missing");
  const incomeMonths = p.months.filter((m) => m.income > 0).length;
  return [
    { id: "income", category: "Income amount, variability, and history", availability: incomeMonths ? "available" : "missing", detail: `${incomeMonths} month(s) with recorded income` },
    { id: "spending", category: "Spending by category and change over time", availability: p.months.length ? "available" : "missing", detail: `${p.months.length} month(s) of transactions` },
    { id: "recurring", category: "Recurring commitments", availability: p.recurring.length ? "available" : "missing", detail: `${p.recurring.length} detected series` },
    { id: "deficits", category: "Cash-flow deficits", availability: p.months.length ? "available" : "missing", detail: `${p.months.filter((m) => m.net < 0).length} month(s) with negative cash flow` },
    { id: "reserves", category: "Available cash and emergency reserves", availability: man(p.manual.emergencyFundCents !== null || p.manual.cashReserves.some((r) => r.amountCents !== null)), detail: "Transactions alone cannot establish account balances" },
    { id: "debt", category: "Debt balances, rates, and payments", availability: man(p.manual.debts.length > 0 || p.manual.debtsConfirmedNone), detail: p.manual.debtsConfirmedNone ? "User confirmed no debt" : `${p.manual.debts.length} debt(s) entered` },
    { id: "goals", category: "Savings goals and upcoming large expenses", availability: man(p.manual.goals.length > 0 || p.manual.obligations.length > 0), detail: `${p.manual.goals.length} goal(s), ${p.manual.obligations.length} obligation(s)` },
    { id: "holdings", category: "Investment accounts and holdings", availability: p.holdings.length ? (p.portfolioStale ? "stale" : "available") : "missing", detail: `${p.holdings.length} holding(s)${p.portfolioPartial ? ", some unvalued" : ""}${p.portfolioStale ? `, ${p.portfolioStale} stale` : ""}` },
    { id: "concentration", category: "Portfolio concentration and asset exposure", availability: p.holdings.length ? "available" : "missing", detail: "Derived from holdings; underlying fund exposure is partially classified" },
    marketItem(p.market),
    { id: "horizon", category: "Time horizon and risk comfort", availability: man(p.manual.timeHorizonYears !== null || p.manual.riskComfort !== "unknown"), detail: `Horizon: ${p.manual.timeHorizonYears ?? "Unknown"}; comfort: ${p.manual.riskComfort}` },
  ];
}

export function buildFinancialSnapshot(p: {
  selectedRange: CashFlowSummary;
  months: MonthSummary[];
  recurring: RecurringSeries[];
  manual: ManualFinancialInputs;
  accounts: InvestmentAccount[];
  holdings: Holding[];
  now?: Date | undefined;
  market?: MarketCoverage | null | undefined;
}): FinancialSnapshot {
  const pv = valuePortfolio(p.accounts, p.holdings, p.now);
  return {
    generatedAt: (p.now ?? new Date()).toISOString(),
    cashFlow: { selectedRange: p.selectedRange, months: p.months },
    recurring: p.recurring,
    manual: p.manual,
    investments: { accounts: p.accounts, holdings: p.holdings, totalValueMicros: pv.totalMicros.toString(), partial: pv.partial },
    marketHistory: null,
    coverage: computeCoverage({ months: p.months, recurring: p.recurring, manual: p.manual, holdings: p.holdings, portfolioPartial: pv.partial, portfolioStale: pv.staleCount, now: p.now, market: p.market }),
  };
}
