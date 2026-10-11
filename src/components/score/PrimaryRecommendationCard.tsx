import { Lightbulb } from "lucide-react";
import type { PrimaryRecommendation } from "@/lib/finance/recommendations";
import { GlassCard, Kv, StatusBadge } from "@/components/common/Glass";

export function PrimaryRecommendationCard({ rec }: { rec: PrimaryRecommendation }) {
  return (
    <GlassCard className="border-2 border-leaf/50">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-success"><Lightbulb className="h-4 w-4" aria-hidden /> Primary recommendation</p>
        <StatusBadge tone="ok">{rec.basis}</StatusBadge>
      </div>
      <h2 className="font-display text-xl font-extrabold">{rec.title}</h2>
      <p className="mt-1 text-sm">{rec.detail}</p>
      <div className="mt-3"><Kv items={rec.supporting} /></div>
      <p className="mt-3 text-sm"><span className="font-semibold">Next step:</span> {rec.nextStep}</p>
      {rec.impact && <p className="mt-1 text-sm"><span className="font-semibold">Estimated impact:</span> {rec.impact}</p>}
    </GlassCard>
  );
}
