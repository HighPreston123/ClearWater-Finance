import type { CashFlowSummary, RecurringSeries } from "@/types/finance";
import type { RiskAssessment } from "@/types/risk";
import type { PrimaryRecommendation } from "./recommendations";
import { formatCentsShort } from "@/lib/format";

/** Spoken scripts for each page, built only from figures the page already shows. No new math. */

export function transactionsAudioText(p: { periodLabel: string; summary: CashFlowSummary; shown: number; total: number }): string {
  if (p.total === 0) return `There are no transactions for ${p.periodLabel} yet. Import a bank file in Settings or add one manually.`;
  return `This is your transactions page for ${p.periodLabel}. It shows ${p.shown} of ${p.total} transactions. Income was ${formatCentsShort(p.summary.income)} and spending was ${formatCentsShort(p.summary.spending)}.`;
}

export function recurringAudioText(p: { series: RecurringSeries[]; monthlyCents: number }): string {
  if (p.series.length === 0) return "No recurring charges were found yet. Detection needs at least three similar, regularly spaced payments from the same merchant.";
  const top = [...p.series].sort((a, b) => b.monthlyEquivalentCents - a.monthlyEquivalentCents).slice(0, 3)
    .map((s) => `${s.merchant} at about ${formatCentsShort(s.monthlyEquivalentCents)} a month`);
  return `We found ${p.series.length} likely recurring ${p.series.length === 1 ? "charge" : "charges"}, costing about ${formatCentsShort(p.monthlyCents)} a month, or ${formatCentsShort(p.monthlyCents * 12)} a year. The largest ${top.length === 1 ? "is" : "are"} ${top.join(", ")}.`;
}

export function savingsAudioText(p: { recommendation: PrimaryRecommendation }): string {
  return `This is your savings planner. You can try spending reduction scenarios and set emergency fund and savings goals. Your main suggestion: ${p.recommendation.title}. ${p.recommendation.nextStep}`;
}

export function investmentsAudioText(p: { accountCount: number; holdingCount: number; total: string; partial: boolean }): string {
  if (p.accountCount === 0) return "You haven't added any investment accounts yet. Import a holdings file in Settings to see them here.";
  return `You have ${p.accountCount} investment ${p.accountCount === 1 ? "account" : "accounts"} with ${p.holdingCount} ${p.holdingCount === 1 ? "holding" : "holdings"}, totaling ${p.total}${p.partial ? ". Some holdings don't have a valuation yet, so this total is partial" : ""}.`;
}

export function riskAudioText(p: { risk: RiskAssessment }): string {
  const r = p.risk;
  const parts = ["This is your future risk page."];
  if (r.overall) parts.push(`Your Future Resilience Score is ${String(r.overall.value)}, rated ${r.overall.label}.`);
  else if (r.message) parts.push(r.message);
  if (r.potentialActions.length) parts.push(`A suggested next step: ${r.potentialActions[0]}`);
  return parts.join(" ");
}

export const ADVISORS_AUDIO_TEXT = "This is the advisor directory. The top section shows advisors whose specialties fit the areas you're focusing on. Below that, you can search and filter every advisor by specialty, and open a profile to learn more.";

export const SETTINGS_AUDIO_TEXT = "This is your settings page. Here you can connect data, import transactions, holdings and future risk inputs from CSV files, and manage your account security, including two-factor authentication.";
