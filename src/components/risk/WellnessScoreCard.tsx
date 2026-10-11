import { useMemo } from "react";
import { useRiskResults } from "@/lib/risk/resultsStore";
import { composeWellness } from "@/lib/risk/wellness";
import { GlassCard, Note } from "@/components/common/Glass";

function tone(score: number | null): string {
  if (score === null) return "text-muted-foreground";
  if (score >= 70) return "text-emerald-500";
  if (score >= 40) return "text-amber-500";
  return "text-red-500";
}

export function WellnessScoreCard() {
  const results = useRiskResults();
  const wellness = useMemo(() => composeWellness(results), [results]);

  return (
    <GlassCard className="space-y-4 p-6">
      <div>
        <h2 className="text-lg font-semibold">Financial wellness score</h2>
        <p className="text-sm text-muted-foreground">
          Combines the four sections below into one 0–100 estimate. It updates as you run each section on this page.
          This is an educational heuristic, not financial advice.
        </p>
      </div>

      {wellness.overall === null ? (
        <Note>No score yet — complete the survey and run the sections below. Missing sections are never counted as zero.</Note>
      ) : (
        <div className="flex items-end gap-3">
          <p className={`text-5xl font-bold tabular-nums ${tone(wellness.overall)}`}>{wellness.overall}</p>
          <p className="pb-1 text-sm text-muted-foreground">/ 100</p>
        </div>
      )}

      <div className="space-y-3">
        {wellness.pillars.map((p) => (
          <div key={p.id} className="space-y-1">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-sm font-medium">{p.label}</p>
              <p className={`text-sm tabular-nums ${tone(p.score)}`}>{p.score === null ? "No data" : `${p.score}/100`}</p>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              {p.score !== null && (
                <div
                  className={`h-full rounded-full ${p.score >= 70 ? "bg-emerald-500" : p.score >= 40 ? "bg-amber-500" : "bg-red-500"}`}
                  style={{ width: `${p.score}%` }}
                />
              )}
            </div>
            <p className="text-xs text-muted-foreground">{p.detail}</p>
          </div>
        ))}
      </div>

      {wellness.missing.length > 0 && wellness.overall !== null && (
        <Note>Not yet included: {wellness.missing.join(", ")}. The score reweights across the sections that have data.</Note>
      )}
    </GlassCard>
  );
}
