import type { ReactNode } from "react";
import { GlassCard } from "./Glass";

export function Metric({ label, value, info, sub, tone }: { label: string; value: string; info?: ReactNode; sub?: ReactNode; tone?: "pos" | "neg" }) {
  return (
    <GlassCard className="p-4">
      <p className="flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}{info}</p>
      <p className={`mt-1 font-display text-2xl font-extrabold tabular-nums ${tone === "neg" ? "text-destructive" : tone === "pos" ? "text-success" : "text-foreground"}`}>{value}</p>
      {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
    </GlassCard>
  );
}
