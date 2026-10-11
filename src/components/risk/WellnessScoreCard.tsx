import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRiskResults } from "@/lib/risk/resultsStore";
import { composeWellness } from "@/lib/risk/wellness";
import { MIN_MEANINGFUL } from "@/lib/risk/profileResilience";
import { GlassCard, Note } from "@/components/common/Glass";
import { comparisonQuery } from "./ResilienceComparisonCard";

function tone(score: number | null): string {
  if (score === null) return "text-muted-foreground";
  if (score >= 70) return "text-emerald-500";
  if (score >= 40) return "text-amber-500";
  return "text-red-500";
}

export function WellnessScoreCard() {
  const results = useRiskResults();
  const wellness = useMemo(() => composeWellness(results), [results]);
  const comparison = useQuery(comparisonQuery);
  const foundations = useMemo(() => wellness.pillars.find((p) => p.id === "foundations") ?? null, [wellness]);
  const cmp = comparison.data?.status === "ok" ? comparison.data.data : null;
  const groupAvg = cmp?.foundations?.average ?? null;
  const groupScored = cmp?.foundations?.scored ?? 0;

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

      {groupAvg !== null && groupScored >= MIN_MEANINGFUL && (
        <div className="space-y-2 rounded-xl border p-4">
          <p className="text-sm font-medium">How you compare</p>
          {wellness.overall !== null ? (
            <p className="text-sm text-muted-foreground">
              Your wellness score is <span className={`font-semibold tabular-nums ${tone(wellness.overall)}`}>{wellness.overall}</span> — the 100 sample
              profiles average <span className="font-semibold text-foreground tabular-nums">{Math.round(groupAvg)}</span>.{" "}
              {wellness.overall >= groupAvg ? "You are above" : "You are below"} the group average.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              The 100 sample profiles average a wellness score of <span className="font-semibold text-foreground tabular-nums">{Math.round(groupAvg)}</span>.
            </p>
          )}
          {foundations?.score != null && (
            <p className="text-sm text-muted-foreground">
              On financial foundations — the one pillar the sample group has data for — you score{" "}
              <span className={`font-semibold tabular-nums ${tone(foundations.score)}`}>{foundations.score}</span> vs their average{" "}
              <span className="tabular-nums">{Math.round(groupAvg)}</span>.
            </p>
          )}
          <Note>
            The sample profiles are scored with the same formula, but only on financial foundations: they have no holdings, company filings, or survey answers.
          </Note>
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
