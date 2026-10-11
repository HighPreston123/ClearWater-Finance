import { useMemo } from "react";
import { useFinanceStore } from "./FinanceStore";
import { filterByRange, summarize, monthlySummaries, spendingByCategory, summaryForMonth, discretionaryTotal } from "@/lib/finance/metrics";
import { detectRecurring, activeSeries, monthlyRecurringCost } from "@/lib/finance/recurring";
import { computeHistoricalScore } from "@/lib/finance/score";
import { completeMonthsInRange, datasetCompleteMonths, monthKey, prevMonth } from "@/lib/finance/dates";
import { primaryRecommendation } from "@/lib/finance/recommendations";
import { valuePortfolio } from "@/lib/investments/valuation";
import { buildFinancialSnapshot } from "@/lib/risk/buildFinancialSnapshot";
import { activeRiskEngine } from "@/lib/risk/riskEngine";
import { composeWellnessScore } from "@/lib/risk/composeWellnessScore";
import { profileImprovementActions } from "@/lib/finance/profileImprovementActions";
import { formatDate, monthLabel } from "@/lib/format";
import type { DateRange } from "@/types/finance";

export function rangeLabel(r: DateRange) {
  const m = r.start.slice(0, 7);
  if (r.start === `${m}-01` && monthKey(r.end) === m && Number(r.end.slice(8)) >= 28) return monthLabel(m, true);
  return `${formatDate(r.start)} – ${formatDate(r.end)}`;
}

/**
 * Module-level single-entry memo keyed by argument identity. The store keeps unchanged slices by
 * reference, so every page reuses the same results instead of recomputing on each mount.
 * The underlying functions are unchanged, so outputs are identical.
 */
function memo<A extends unknown[], R>(fn: (...args: A) => R): (...args: A) => R {
  let last: { args: A; result: R } | null = null;
  return (...args: A) => {
    if (last && last.args.length === args.length && last.args.every((a, i) => Object.is(a, args[i]))) return last.result;
    const result = fn(...args);
    last = { args, result };
    return result;
  };
}

/** All-history derivations: depend only on the transaction list (and overrides), not the date range. */
const allHistory = memo((all: ReturnType<typeof useFinanceStore>["transactions"]) => ({
  allMonths: monthlySummaries(all),
  completeMonths: datasetCompleteMonths(all),
}));
const recurringFor = memo((all: ReturnType<typeof useFinanceStore>["transactions"], overrides: ReturnType<typeof useFinanceStore>["recurringOverrides"]) => {
  const recurring = detectRecurring(all, overrides);
  return { recurring, activeRecurring: activeSeries(recurring), recurringMonthly: monthlyRecurringCost(recurring) };
});

/** Date-range derivations. */
const rangeDerived = memo((all: ReturnType<typeof useFinanceStore>["transactions"], range: DateRange) => {
  const inRange = filterByRange(all, range);
  const completeInRange = completeMonthsInRange(all, range);
  const completeMonths = allHistory(all).completeMonths;
  const current = completeInRange.length ? summaryForMonth(all, completeInRange[completeInRange.length - 1]!) : null;
  const prevKey = current ? prevMonth(current.month) : null;
  const previous = prevKey && completeMonths.includes(prevKey) ? summaryForMonth(all, prevKey) : null;
  const disc = (m: string | undefined) => (m ? discretionaryTotal(all.filter((t) => monthKey(t.date) === m)) : null);
  return {
    inRange,
    summary: summarize(inRange),
    byCategory: spendingByCategory(inRange),
    months: monthlySummaries(inRange),
    score: computeHistoricalScore(all, range),
    completeInRange, current, previous,
    currentDiscretionary: disc(current?.month), previousDiscretionary: disc(previous?.month),
    label: rangeLabel(range),
  };
});

const portfolioFor = memo((accounts: ReturnType<typeof useFinanceStore>["accounts"], holdings: ReturnType<typeof useFinanceStore>["holdings"]) =>
  valuePortfolio(accounts, holdings, new Date()));

/** Portfolio valuation only — Investments doesn't need transaction scores or recurring detection. */
export function usePortfolio() {
  const { accounts, holdings } = useFinanceStore();
  return portfolioFor(accounts, holdings);
}

/** All derived numbers come from the same transaction list and range, so totals and charts agree. */
export function useDerived() {
  const s = useFinanceStore();
  return useMemo(() => {
    const now = new Date();
    const all = s.transactions;
    const { allMonths } = allHistory(all);
    const { recurring, activeRecurring, recurringMonthly } = recurringFor(all, s.recurringOverrides);
    const r = rangeDerived(all, s.range);
    const recommendation = primaryRecommendation({
      periodLabel: r.label, summary: r.summary, current: r.current, previous: r.previous,
      currentDiscretionary: r.currentDiscretionary, previousDiscretionary: r.previousDiscretionary,
      recurring, manual: s.manual,
    });
    const portfolio = portfolioFor(s.accounts, s.holdings);
    const snapshot = buildFinancialSnapshot({ selectedRange: r.summary, months: allMonths, recurring, manual: s.manual, accounts: s.accounts, holdings: s.holdings, now });
    const risk = activeRiskEngine.assess(snapshot);
    const wellness = composeWellnessScore(r.score, risk);
    const actions = profileImprovementActions(all, r.score, risk);
    return {
      all, inRange: r.inRange, summary: r.summary, byCategory: r.byCategory, months: r.months, allMonths, recurring,
      activeRecurring, recurringMonthly,
      score: r.score, recommendation, portfolio, snapshot, risk, wellness, actions, label: r.label, completeInRange: r.completeInRange,
    };
  }, [s.transactions, s.range, s.recurringOverrides, s.manual, s.accounts, s.holdings]);
}
