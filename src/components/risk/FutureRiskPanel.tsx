import { Link } from "@tanstack/react-router";
import { ShieldQuestion } from "lucide-react";
import type { RiskAssessment } from "@/types/risk";
import { GlassCard, CardTitle, StatusBadge, Note } from "@/components/common/Glass";
import { InfoTip } from "@/components/common/InfoTip";
import { useFinanceStore } from "@/store/FinanceStore";
import { useDerived } from "@/store/useDerived";

const TONE = { available: "ok", manual: "info", stale: "pending", missing: "off" } as const;

export function FutureRiskStatusBadge({ risk }: { risk: RiskAssessment }) {
  if (risk.status === "not_implemented") return <StatusBadge tone="pending">Methodology pending</StatusBadge>;
  if (risk.status === "insufficient_data") return <StatusBadge tone="pending">Insufficient data</StatusBadge>;
  if (risk.status === "error") return <StatusBadge tone="warn">Error</StatusBadge>;
  return <StatusBadge tone="info">{risk.overall?.label ?? "Ready"}</StatusBadge>;
}

export function FutureRiskPanel({ risk, compact = false }: { risk: RiskAssessment; compact?: boolean }) {
  const { hydrated } = useFinanceStore();
  const counts = risk.dataCoverage.reduce<Record<string, number>>((m, c) => ({ ...m, [c.availability]: (m[c.availability] ?? 0) + 1 }), {});
  return (
    <GlassCard>
      <CardTitle
        info={<InfoTip title="Future risk" means="A forward-looking view of risk across your whole financial situation, including investments." calc="Future Resilience Score v1: five weighted pillars, capped by survival gates, with a confidence label." excludes="Company fundamentals. Unknown inputs are never treated as zero." />}
        right={<FutureRiskStatusBadge risk={risk} />}
      >
        <ShieldQuestion className="h-4 w-4 text-primary" aria-hidden /> Future risk
      </CardTitle>
      <p className="text-sm">{risk.message}</p>
      <p className="mt-2 text-xs text-muted-foreground">
        Inputs: {counts["available"] ?? 0} available · {counts["manual"] ?? 0} manual · {counts["stale"] ?? 0} stale · {counts["missing"] ?? 0} missing
      </p>
      {compact ? (
        <Link to="/risk" className="mt-2 inline-block text-sm font-semibold text-primary hover:underline">View inputs</Link>
      ) : (
        <ul className="mt-4 grid gap-2 md:grid-cols-2">
          {risk.dataCoverage.map((c) => (
            <li key={c.id} className="rounded-2xl border bg-card p-3">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold">{c.category}</p>
                <StatusBadge tone={TONE[c.availability]}>{c.availability}</StatusBadge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{c.detail}</p>
            </li>
          ))}
        </ul>
      )}
      <Note>Methodology version: {risk.methodologyVersion ?? "none"} · Inputs captured {hydrated ? new Date(risk.inputTimestamp).toLocaleString() : "…"}</Note>
    </GlassCard>
  );
}

export function FutureResultSections() {
  const { risk } = useDerived();
  const r = risk.resilience;
  if (!r) return null;
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  const showRange = r.confidence !== "High" && r.range;
  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <section className="rounded-2xl border bg-card p-4">
      <h3 className="mb-2 text-sm font-semibold">{title}</h3>
      <div className="text-sm">{children}</div>
    </section>
  );
  return (
    <GlassCard>
      <CardTitle right={<StatusBadge tone="info">{r.version}</StatusBadge>}>Future Resilience Score — results</CardTitle>
      <div className="grid gap-3 md:grid-cols-2">
        <Section title="Overall risk assessment">
          {r.score === null ? <p>Insufficient data — scored pillars cover {pct(r.scoredWeight)} of the weight (60% needed). No number is shown.</p> : (
            <>
              <p className="font-display text-3xl font-extrabold">{showRange ? `${r.range!.low}–${r.range!.high}` : r.score}<span className="text-sm text-muted-foreground"> / 100</span></p>
              <p className="mt-1">{r.band} · Point score {r.score} · Confidence {r.confidence} ({pct(r.coverage)} of weight on real or approximate data)</p>
              <p className="mt-1 text-xs text-muted-foreground">{r.gate ? `Capped at ${r.gate.cap} by ${r.gate.id} ${r.gate.label}: ${r.gate.reason}` : "No survival gate tripped."}</p>
            </>
          )}
        </Section>
        <Section title="Category-level contributions">
          <ul className="space-y-1">
            {r.pillars.map((p) => (
              <li key={p.id} className="flex justify-between gap-2">
                <span>{p.label} <span className="text-xs text-muted-foreground">({pct(p.weight)})</span></span>
                <span className="tabular-nums">{p.score === null ? "Not scored" : `${p.score} · +${p.points} pts · −${p.pointsLost}`}</span>
              </li>
            ))}
          </ul>
        </Section>
        <Section title="Supporting evidence">
          <ul className="space-y-2">
            {r.pillars.map((p) => (
              <li key={p.id}>
                <p className="text-xs font-semibold">{p.label}</p>
                <ul className="text-xs text-muted-foreground">
                  {p.subMetrics.filter((m) => m.weight > 0).map((m) => <li key={m.id}>{m.label}: {m.value}{m.basis === "approximate" ? " (approximate)" : ""}</li>)}
                </ul>
              </li>
            ))}
          </ul>
        </Section>
        <Section title="Assumptions">
          <ul className="list-disc space-y-1 pl-4 text-xs">{risk.assumptions.map((a) => <li key={a}>{a}</li>)}</ul>
        </Section>
        <Section title="Missing-data limitations">
          {risk.limitations.length === 0 ? <p className="text-xs">No unknown inputs.</p> : (
            <ul className="list-disc space-y-1 pl-4 text-xs">{risk.limitations.map((a) => <li key={a}>{a}</li>)}</ul>
          )}
          {r.range && <p className="mt-2 text-xs text-muted-foreground">Range with unknowns set to 25 / 90: {r.range.low}–{r.range.high}</p>}
        </Section>
        <Section title="Scenario results">
          {risk.scenarios.length === 0 ? <p className="text-xs">Available once a score can be calculated.</p> : (
            <ul className="space-y-1">
              {risk.scenarios.map((s) => {
                const o = s.result as { score: number | null; delta: number | null };
                return <li key={s.id} className="flex justify-between gap-2"><span>{s.label}</span><span className="tabular-nums">{o.score === null ? "Needs essential spending" : `${o.score} (${o.delta! >= 0 ? "+" : ""}${o.delta})`}</span></li>;
              })}
            </ul>
          )}
        </Section>
        <Section title="Potential actions">
          {risk.potentialActions.length === 0 ? <p className="text-xs">No point-gaining actions found from the current inputs.</p> : (
            <ol className="list-decimal space-y-1 pl-4">{risk.potentialActions.map((a) => <li key={a}>{a}</li>)}</ol>
          )}
        </Section>
      </div>
      <Note>Educational estimate, not financial advice. Methodology version {r.version}.</Note>
    </GlassCard>
  );
}
