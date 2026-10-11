import { Link } from "@tanstack/react-router";
import { ShieldQuestion } from "lucide-react";
import type { RiskAssessment } from "@/types/risk";
import { GlassCard, CardTitle, StatusBadge, Note } from "@/components/common/Glass";
import { InfoTip } from "@/components/common/InfoTip";
import { useFinanceStore } from "@/store/FinanceStore";

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
        info={<InfoTip title="Future risk" means="A forward-looking view of risk across your whole financial situation, including investments." calc="Not calculated yet. The methodology will be defined by the team." excludes="Everything — no risk rating exists until the methodology is implemented." />}
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
  const sections = ["Overall risk assessment", "Category-level contributions", "Supporting evidence", "Assumptions", "Missing-data limitations", "Scenario results", "Potential actions"];
  return (
    <GlassCard>
      <CardTitle>Future result sections</CardTitle>
      <p className="mb-3 text-sm text-muted-foreground">These will populate once the risk methodology is implemented. Nothing below is a real result.</p>
      <ul className="grid gap-2 sm:grid-cols-2">
        {sections.map((s) => (
          <li key={s} className="rounded-2xl border border-dashed bg-card/60 p-3">
            <p className="text-sm font-semibold">{s}</p>
            <p className="text-xs text-muted-foreground">Not calculated</p>
          </li>
        ))}
      </ul>
    </GlassCard>
  );
}
