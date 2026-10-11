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

/** All derived numbers come from the same transaction list and range, so totals and charts agree. */
export function useDerived() {
  const s = useFinanceStore();
  return useMemo(() => {
    const now = new Date();
    const all = s.transactions;
    const inRange = filterByRange(all, s.range);
    const summary = summarize(inRange);
    const byCategory = spendingByCategory(inRange);
    const months = monthlySummaries(inRange);
    const allMonths = monthlySummaries(all);
    const recurring = detectRecurring(all, s.recurringOverrides);
    const score = computeHistoricalScore(all, s.range);
    const completeInRange = completeMonthsInRange(all, s.range);
    const current = completeInRange.length ? summaryForMonth(all, completeInRange[completeInRange.length - 1]!) : null;
    const prevKey = current ? prevMonth(current.month) : null;
    const previous = prevKey && datasetCompleteMonths(all).includes(prevKey) ? summaryForMonth(all, prevKey) : null;
    const disc = (m: string | undefined) => (m ? discretionaryTotal(all.filter((t) => monthKey(t.date) === m)) : null);
    const label = rangeLabel(s.range);
    const recommendation = primaryRecommendation({
      periodLabel: label, summary, current, previous,
      currentDiscretionary: disc(current?.month), previousDiscretionary: disc(previous?.month),
      recurring, manual: s.manual,
    });
    const portfolio = valuePortfolio(s.accounts, s.holdings, now);
    const snapshot = buildFinancialSnapshot({ selectedRange: summary, months: allMonths, recurring, manual: s.manual, accounts: s.accounts, holdings: s.holdings, now });
    const risk = activeRiskEngine.assess(snapshot);
    const wellness = composeWellnessScore(score, risk);
    const actions = profileImprovementActions(all, score, risk);
    return {
      all, inRange, summary, byCategory, months, allMonths, recurring,
      activeRecurring: activeSeries(recurring), recurringMonthly: monthlyRecurringCost(recurring),
      score, recommendation, portfolio, snapshot, risk, wellness, actions, label, completeInRange,
    };
  }, [s.transactions, s.range, s.recurringOverrides, s.manual, s.accounts, s.holdings]);
}
