import { AudioSummaryControls } from "@/components/integrations/AudioSummaryControls";
import { recurringAudioText } from "@/lib/finance/pageAudioText";
import { createFileRoute } from "@tanstack/react-router";
import { useFinanceStore } from "@/store/FinanceStore";
import { useDerived } from "@/store/useDerived";
import { PageHeader, GlassCard, Note, StatusBadge } from "@/components/common/Glass";
import { CsvMiniLink } from "@/components/common/CsvHelp";
import { Metric } from "@/components/common/Metric";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCents } from "@/lib/format";
import type { RecurringDetection, RecurringReview } from "@/types/finance";

export const Route = createFileRoute("/_authenticated/recurring")({
  head: () => ({
    meta: [
      { title: "Recurring expenses — Clearwater" },
      { name: "description", content: "Likely recurring charges with monthly and annual cost estimates." },
      { property: "og:title", content: "Recurring expenses — Clearwater" },
      { property: "og:description", content: "Likely recurring charges with monthly and annual cost estimates." },
    ],
  }),
  component: Recurring,
});

function Recurring() {
  const { setRecurringOverride } = useFinanceStore();
  const d = useDerived();
  const recurringIds = new Set(d.activeRecurring.flatMap((r) => r.transactionIds));
  const other = d.all.filter((t) => t.type === "expense" && !recurringIds.has(t.id));
  return (
    <div className="space-y-6">
      <PageHeader title="Recurring expenses" subtitle="Detection uses all available transaction history, not just the selected range." right={<div className="flex flex-col items-end gap-2"><AudioSummaryControls text={recurringAudioText({ series: d.activeRecurring, monthlyCents: d.recurringMonthly })} /><CsvMiniLink section="csv-transactions" label="Import transactions CSV" /></div>} />
      <div className="grid gap-4 sm:grid-cols-3">
        <Metric label="Recurring series" value={String(d.activeRecurring.length)} sub="Counts series, not payments" />
        <Metric label="Monthly equivalent" value={formatCents(d.recurringMonthly)} sub="Weekly × 52 ÷ 12" />
        <Metric label="Estimated annual" value={formatCents(d.recurringMonthly * 12)} />
      </div>
      <ul className="grid gap-4 lg:grid-cols-2">
        {d.recurring.map((r) => (
          <li key={r.key}>
            <GlassCard className={r.detection === "not_recurring" ? "opacity-60" : ""}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="font-display text-lg font-bold">{r.merchant}</h3>
                  <p className="text-xs text-muted-foreground">{r.category} · {r.frequency} · {r.paymentCount} matching payments</p>
                </div>
                <div className="text-right">
                  <p className="font-display text-xl font-extrabold tabular-nums">{formatCents(r.estimatedCents)}</p>
                  <p className="text-xs text-muted-foreground">{formatCents(r.monthlyEquivalentCents)}/mo · {formatCents(r.annualCostCents)}/yr</p>
                </div>
              </div>
              <p className="mt-2 text-sm">{r.explanation}</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <label className="text-xs font-semibold">Detection status
                  <Select value={r.detection} onValueChange={(v) => setRecurringOverride(r.key, { detection: v as RecurringDetection })}>
                    <SelectTrigger className="mt-1 bg-card"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="likely">Likely recurring</SelectItem><SelectItem value="confirmed">Confirmed recurring</SelectItem><SelectItem value="not_recurring">Not recurring</SelectItem></SelectContent>
                  </Select>
                </label>
                <label className="text-xs font-semibold">Your review
                  <Select value={r.review} onValueChange={(v) => setRecurringOverride(r.key, { review: v as RecurringReview })}>
                    <SelectTrigger className="mt-1 bg-card"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="unconfirmed">Unconfirmed</SelectItem><SelectItem value="essential">Essential & intentional</SelectItem><SelectItem value="worth_reviewing">Worth reviewing</SelectItem></SelectContent>
                  </Select>
                </label>
              </div>
              {r.review === "essential" && <div className="mt-2"><StatusBadge tone="ok">Essential & intentional</StatusBadge></div>}
            </GlassCard>
          </li>
        ))}
      </ul>
      <GlassCard>
        <h2 className="font-display font-bold">Other spending</h2>
        <p className="text-sm">{other.length} charges totaling {formatCents(other.reduce((s, t) => s + t.amount, 0))} across all history didn't match a recurring pattern.</p>
        <Note>Some of these may be recurring expenses the detector missed. Not every subscription is unnecessary — review labels are your call.</Note>
      </GlassCard>
    </div>
  );
}
