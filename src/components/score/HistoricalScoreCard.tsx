import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { ScoreResult } from "@/lib/finance/score";
import { SCORE_DISCLAIMER, SCORE_LABELS, SCORE_SCOPE } from "@/lib/finance/score";
import { GlassCard, CardTitle, Note, StatusBadge } from "@/components/common/Glass";
import { InfoTip } from "@/components/common/InfoTip";
import { monthLabel } from "@/lib/format";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

function Scale({ score }: { score: number }) {
  return (
    <div aria-hidden className="mt-3">
      <div className="relative flex h-3 overflow-hidden rounded-full">
        {SCORE_LABELS.map((l, i) => {
          const prev = i ? SCORE_LABELS[i - 1]!.max : 0;
          return <div key={l.label} style={{ width: `${((l.max - prev) / 1000) * 100}%`, background: `var(--score-${l.tone})` }} />;
        })}
      </div>
      <div className="relative h-3">
        <div className="absolute -top-1 h-4 w-1 -translate-x-1/2 rounded-full bg-foreground" style={{ left: `${score / 10}%` }} />
      </div>
    </div>
  );
}

export function HistoricalScoreCard({ score, compact = false }: { score: ScoreResult; compact?: boolean }) {
  const [open, setOpen] = useState(!compact);
  return (
    <GlassCard>
      <CardTitle info={<InfoTip title="Historical cash-flow score" means="A 0–1,000 educational summary of how your recorded income compared with spending." calc="Up to 700 points for the latest complete month's surplus rate, plus up to 300 for how many of the two prior complete months had nonnegative cash flow." excludes="Future risk, investment risk, debt, savings balances, and the number of subscriptions." />}>
        Historical cash-flow score
      </CardTitle>
      {score.status !== "ok" ? (
        <p className="text-lg font-semibold text-muted-foreground">{score.message}</p>
      ) : (
        <>
          <div className="flex flex-wrap items-end gap-3">
            <span className="font-display text-5xl font-extrabold tabular-nums text-foreground">{score.score}</span>
            <span className="pb-1 text-muted-foreground">/ 1,000</span>
            <StatusBadge tone="info">{score.label}</StatusBadge>
            {score.limitedHistory && <StatusBadge tone="pending">Limited history</StatusBadge>}
          </div>
          <p className="text-sm text-muted-foreground">Scored month: {monthLabel(score.month, true)} (latest complete calendar month in range)</p>
          <Scale score={score.score} />
          <Collapsible open={open} onOpenChange={setOpen}>
            <CollapsibleTrigger className="mt-2 flex items-center gap-1 text-sm font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded">
              Why this score? <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-3 space-y-3">
              {score.factors.map((f) => (
                <div key={f.id} className="rounded-2xl border bg-card p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-display font-bold">{f.name}</h3>
                    {f.unavailable ? <StatusBadge tone="off">Unavailable</StatusBadge> : (
                      <span className="text-sm tabular-nums">
                        <b>{f.earned}</b> earned · {f.deducted} deducted · {f.available} available
                      </span>
                    )}
                  </div>
                  {f.normalized && (
                    <p className="mt-1 text-sm">Normalized to 1,000: <b>{f.normalized.earned}</b> earned · {f.normalized.deducted} deducted (raw {f.earned}/{f.available}).</p>
                  )}
                  <ul className="mt-2 grid gap-x-4 text-sm sm:grid-cols-2">
                    {f.supporting.map((s) => <li key={s.label} className="flex justify-between gap-2"><span className="text-muted-foreground">{s.label}</span><span className="tabular-nums font-semibold">{s.value}</span></li>)}
                  </ul>
                  <p className="mt-2 text-sm"><span className="font-semibold">Threshold applied:</span> {f.threshold}</p>
                  <p className="mt-1 text-sm"><span className="font-semibold">What would improve it:</span> {f.improve}</p>
                </div>
              ))}
              <p className="text-sm font-semibold tabular-nums">
                {score.normalized
                  ? `Total: ${score.factors[0]!.normalized!.earned} (raw ${score.rawScore} of ${score.rawAvailable}, normalized to 1,000)`
                  : `Total: ${score.factors.map((f) => f.earned).join(" + ")} = ${score.score} of 1,000`}
              </p>
              <Note>Historical stability improves through future months of consistent cash flow; current spending changes cannot rewrite prior months. Thresholds are product assumptions, not validated financial standards.</Note>
            </CollapsibleContent>
          </Collapsible>
        </>
      )}
      <Note>{SCORE_SCOPE}</Note>
      <Note>{SCORE_DISCLAIMER}</Note>
    </GlassCard>
  );
}
