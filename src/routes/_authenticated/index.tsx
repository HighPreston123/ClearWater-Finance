import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ChevronDown } from "lucide-react";
import { useDerived } from "@/store/useDerived";
import { useFinanceStore } from "@/store/FinanceStore";
import { PageHeader, GlassCard, CardTitle, Note, StatusBadge } from "@/components/common/Glass";
import { CsvMiniLink } from "@/components/common/CsvHelp";
import { Metric } from "@/components/common/Metric";
import { InfoTip } from "@/components/common/InfoTip";
import { HistoricalScoreCard } from "@/components/score/HistoricalScoreCard";
import { PrimaryRecommendationCard } from "@/components/score/PrimaryRecommendationCard";
import { FutureRiskPanel } from "@/components/risk/FutureRiskPanel";
import { SpendingDonut } from "@/components/charts/SpendingDonut";
import { TigerAnalyticsPanel } from "@/components/analytics/TigerAnalyticsPanel";
import { AIInsightsPanel } from "@/components/integrations/AIInsightsPanel";
import { AudioSummaryControls } from "@/components/integrations/AudioSummaryControls";
import { AdvisorMatchCard } from "@/components/advisors/AdvisorMatchCard";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { matchAdvisor } from "@/lib/advisors/matchAdvisor";
import { SAMPLE_ADVISORS } from "@/data/sampleAdvisors";
import { formatCents, formatMicros, formatPct } from "@/lib/format";
import { buildAudioSummaryText } from "@/lib/finance/audioSummaryText";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Overview — Clearwater Financial Wellness" },
      { name: "description", content: "Income, spending, cash-flow score, recurring costs, and investments at a glance." },
      { property: "og:title", content: "Overview — Clearwater Financial Wellness" },
      { property: "og:description", content: "Income, spending, cash-flow score, recurring costs, and investments at a glance." },
    ],
  }),
  component: Overview,
});

function Overview() {
  const d = useDerived();
  const { manual } = useFinanceStore();
  const navigate = useNavigate();
  const s = d.summary;
  const match = matchAdvisor({ score: d.score, risk: d.risk, goals: manual.goals, preferences: {}, advisors: SAMPLE_ADVISORS, negativeFactors: d.actions });
  const { accounts } = useFinanceStore();
  const audioText = buildAudioSummaryText({
    periodLabel: d.label, summary: s, score: d.score,
    recurringCount: d.activeRecurring.length, recurringMonthlyCents: d.recurringMonthly,
    investmentsTotal: accounts.length ? formatMicros(d.portfolio.totalMicros) : null,
    investmentsPartial: d.portfolio.partial, recommendation: d.recommendation,
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Overview" subtitle={`Transaction metrics for ${d.label}.`} right={<AudioSummaryControls text={audioText} />} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Income" value={formatCents(s.income)} info={<InfoTip title="Income" means="Money you received." calc="Sum of income transactions in the selected range." excludes="Transfers between your accounts and unrealized investment gains." />} />
        <Metric label="Spending" value={formatCents(s.spending)} info={<InfoTip title="Spending" means="Money that left your tracked accounts for purchases and bills." calc="Sum of expense transactions in the selected range." excludes="Savings transfers and investment contributions — those move money between your own accounts." />} />
        <Metric label="Net cash flow" value={formatCents(s.net)} tone={s.net < 0 ? "neg" : "pos"} info={<InfoTip title="Net cash flow" means="Whether more came in than went out." calc="Income minus spending." excludes="Account balances. Positive cash flow doesn't establish a savings-account balance." />} sub="Doesn't establish a savings balance." />
        <Metric label="Estimated surplus rate" value={formatPct(s.surplusRate)} info={<InfoTip title="Surplus rate" means="Share of income left after spending." calc="Net cash flow ÷ income × 100. Unavailable when income is zero." excludes="Transfers and investment gains." />} />
        <Metric label="Moved to savings" value={formatCents(s.savingsTransfers)} sub="Transfer — not counted as spending" />
        <Metric label="Investment contributions" value={formatCents(s.investmentContributions)} sub="Transfer — not spending, not new wealth" />
        <Metric label="Likely recurring series" value={String(d.activeRecurring.length)} sub={`≈ ${formatCents(d.recurringMonthly)}/month · uses all history`} info={<InfoTip title="Recurring expenses" means="Charges that repeat weekly or monthly." calc="Grouped by merchant; at least 3 payments at regular intervals and similar amounts. Counts series, not payments." excludes="Selected date range — detection always uses all available history." />} />
        <Metric label="Tracked investments" value={formatMicros(d.portfolio.totalMicros)} sub={<>{d.portfolio.partial ? <StatusBadge tone="warn">Partial total</StatusBadge> : null} As of displayed valuation dates</>} info={<InfoTip title="Tracked investment value" means="Current value of accounts you've added." calc="Valued holdings plus account cash, using each holding's latest price or supplied value." excludes="Holdings without a valuation, and any performance history." />} />
      </div>

      <PrimaryRecommendationCard rec={d.recommendation} />

      <div className="grid gap-6 lg:grid-cols-2">
        <HistoricalScoreCard score={d.score} compact />
        <div className="space-y-6">
          <GlassCard>
            <CardTitle info={<InfoTip title="Future Resilience Score" means="How close you are to your goals and how well you would survive a shock, 0–100." calc="Five weighted pillars (liquidity 25%, cash flow 20%, debt 15%, goals & retirement 25%, portfolio 15%), capped by survival gates." excludes="Company fundamentals. Unknown inputs are never counted as zero; they lower confidence instead." />}>Future Resilience Score</CardTitle>
            {d.wellness.status === "ok" ? (
              <>
                <p className="font-display text-4xl font-extrabold text-foreground">{String(d.wellness.value)}<span className="text-base text-muted-foreground"> / 100</span></p>
                <Note>{d.wellness.label}. Shown alongside your financial wellness score on the Future risk page.</Note>
              </>
            ) : (
              <>
                <p className="font-display text-2xl font-extrabold text-muted-foreground">{d.wellness.message}</p>
                <Note>{d.wellness.reason}</Note>
              </>
            )}
          </GlassCard>
          <FutureRiskPanel risk={d.risk} compact />
        </div>
      </div>

      <GlassCard>
        <Collapsible>
          <CollapsibleTrigger className="flex w-full items-center justify-between rounded font-display font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            What is affecting your profile? <ChevronDown className="h-4 w-4" />
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-3 space-y-3">
            {d.actions.length === 0 ? <p className="text-sm text-muted-foreground">No historical-score deductions to explain for this period.</p> : d.actions.map((a) => (
              <div key={a.factorId} className="rounded-2xl border bg-card p-4 text-sm">
                <StatusBadge tone="info">From historical score</StatusBadge>
                <p className="mt-2 font-semibold">{a.issue}</p>
                {a.historicalDeduction !== null && <p className="text-muted-foreground">Deduction: {a.historicalDeduction} points</p>}
                <p className="mt-1"><b>Next step:</b> {a.nextStep}</p>
                <p className="text-muted-foreground">{a.howItHelps}</p>
              </div>
            ))}
            <Note>Future-risk factors will appear here once that methodology exists.</Note>
          </CollapsibleContent>
        </Collapsible>
      </GlassCard>

      <GlassCard>
        <CardTitle>Spending by category</CardTitle>
        <SpendingDonut data={d.byCategory} onSelect={(c) => navigate({ to: "/transactions", search: { category: c } })} />
        <Note>Select a category to see its transactions. Reflects the selected date range.</Note>
      </GlassCard>

      <TigerAnalyticsPanel />

      <div className="grid gap-6 lg:grid-cols-2">
        <AIInsightsPanel />
        <AdvisorMatchCard match={match} />
      </div>
    </div>
  );
}
