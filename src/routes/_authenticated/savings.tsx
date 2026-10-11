import { createFileRoute } from "@tanstack/react-router";
import { useFinanceStore } from "@/store/FinanceStore";
import { useDerived } from "@/store/useDerived";
import { PageHeader, GlassCard, CardTitle, Note } from "@/components/common/Glass";
import { Slider } from "@/components/ui/slider";
import { EmergencyFundFields, GoalsFields } from "@/components/risk/RiskInputsForm";
import { CsvMiniLink } from "@/components/common/CsvHelp";
import { PrimaryRecommendationCard } from "@/components/score/PrimaryRecommendationCard";
import { computeSavingsScenarios } from "@/lib/finance/savings";
import { datasetCompleteMonths } from "@/lib/finance/dates";
import { formatCents, monthLabel } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/savings")({
  head: () => ({
    meta: [
      { title: "Savings planner — Clearwater" },
      { name: "description", content: "Try reduction scenarios and set emergency-fund and savings goals." },
      { property: "og:title", content: "Savings planner — Clearwater" },
      { property: "og:description", content: "Try reduction scenarios and set emergency-fund and savings goals." },
    ],
  }),
  component: Savings,
});

function Savings() {
  const { savings, setSavings, transactions } = useFinanceStore();
  const d = useDerived();
  const months = d.completeInRange.length ? d.completeInRange : datasetCompleteMonths(transactions);
  const sc = computeSavingsScenarios(transactions, months, savings);
  return (
    <div className="space-y-6">
      <PageHeader title="Savings planner" subtitle={`Baselines average complete months: ${months.map((m) => monthLabel(m)).join(", ")}.`} />
      <PrimaryRecommendationCard rec={d.recommendation} />
      <GlassCard>
        <CardTitle>Reduction scenarios</CardTitle>
        <div className="space-y-5">
          {sc.lines.map((l) => (
            <div key={l.id} className="grid items-center gap-3 md:grid-cols-[10rem_1fr_16rem]">
              <p className="font-semibold">{l.label}</p>
              <div>
                <Slider aria-label={`${l.label} reduction percent`} min={0} max={100} step={5} value={[l.reductionPct]} onValueChange={([v]) => setSavings({ ...savings, [l.id]: v })} />
                <p className="mt-1 text-xs text-muted-foreground">Baseline {formatCents(l.baselineMonthlyCents)}/mo · reduce {l.reductionPct}%</p>
              </div>
              <p className="text-right tabular-nums"><b>{formatCents(l.monthlySavingsCents)}</b>/mo · {formatCents(l.annualSavingsCents)}/yr</p>
            </div>
          ))}
        </div>
        <div className="mt-5 flex justify-between rounded-2xl aero-leaf gloss-highlight p-4 text-primary-foreground">
          <span className="relative font-display font-bold">Combined estimate</span>
          <span className="relative font-display font-extrabold tabular-nums">{formatCents(sc.monthlyTotal)}/mo · {formatCents(sc.annualTotal)}/yr</span>
        </div>
        <Note>Each scenario covers a different category, so the combined total doesn't double-count. Estimates assume baseline spending continues.</Note>
      </GlassCard>
      <div className="grid gap-6 lg:grid-cols-2">
        <GlassCard><CardTitle>Emergency fund</CardTitle><EmergencyFundFields /><Note>Shared with Future risk inputs.</Note></GlassCard>
        <GlassCard><CardTitle>Goals</CardTitle><GoalsFields /><Note>Shared with Future risk inputs.</Note></GlassCard>
      </div>
    </div>
  );
}
