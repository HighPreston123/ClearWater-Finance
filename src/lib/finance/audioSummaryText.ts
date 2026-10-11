import type { CashFlowSummary } from "@/types/finance";
import type { ScoreResult } from "./score";
import type { PrimaryRecommendation } from "./recommendations";
import { formatCentsShort, formatPct, monthLabel } from "@/lib/format";

export interface AudioSummaryInput {
  periodLabel: string;
  summary: CashFlowSummary;
  score: ScoreResult;
  recurringCount: number;
  recurringMonthlyCents: number;
  investmentsTotal: string | null; // already formatted; null when no accounts
  investmentsPartial: boolean;
  recommendation: PrimaryRecommendation;
}

/**
 * Builds the spoken script only from figures already computed on the Overview page.
 * No new math beyond formatting; risk is stated as not yet calculated.
 */
export function buildAudioSummaryText(p: AudioSummaryInput): string {
  const s = p.summary;
  if (s.transactionCount === 0) {
    return `Here's your financial overview for ${p.periodLabel}. There are no transactions in this period yet, so there's nothing to summarize. Import a bank file or add transactions manually, and your summary will appear here.`;
  }
  const parts: string[] = [];
  parts.push(`Here's your financial overview for ${p.periodLabel}.`);
  parts.push(`You brought in ${formatCentsShort(s.income)} and spent ${formatCentsShort(s.spending)}.`);
  parts.push(
    s.net >= 0
      ? `That leaves a positive net cash flow of ${formatCentsShort(s.net)}${s.surplusRate !== null ? `, an estimated surplus rate of ${formatPct(s.surplusRate)}` : ""}.`
      : `That means you spent ${formatCentsShort(-s.net)} more than you earned in this period.`,
  );
  if (s.savingsTransfers > 0 || s.investmentContributions > 0) {
    parts.push(`You also moved ${formatCentsShort(s.savingsTransfers)} to savings and contributed ${formatCentsShort(s.investmentContributions)} to investments. Those are transfers, not spending.`);
  }
  if (p.score.status === "ok") {
    parts.push(`Your historical cash-flow score for ${monthLabel(p.score.month, true)} is ${p.score.score} out of 100, rated ${p.score.label}.`);
  } else {
    parts.push(`A cash-flow score isn't available yet: ${p.score.message}`);
  }
  if (p.recurringCount > 0) {
    parts.push(`We found ${p.recurringCount} likely recurring ${p.recurringCount === 1 ? "charge" : "charges"}, costing about ${formatCentsShort(p.recurringMonthlyCents)} a month.`);
  }
  if (p.investmentsTotal) {
    parts.push(`Your tracked investments total ${p.investmentsTotal}${p.investmentsPartial ? ", though some holdings don't have a valuation yet" : ""}.`);
  }
  parts.push(`Your main suggestion: ${p.recommendation.title}. ${p.recommendation.nextStep}`);
  parts.push("Future risk isn't calculated yet, so this summary covers your past activity only.");
  return parts.join(" ");
}
