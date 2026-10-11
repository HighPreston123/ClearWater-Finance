import { Link } from "@tanstack/react-router";
import { Users } from "lucide-react";
import { GlassCard, CardTitle, Note, StatusBadge } from "@/components/common/Glass";
import { Badge } from "@/components/ui/badge";
import { useAdvisorRecommendation } from "./useAdvisorRecommendation";
import type { AdvisorRecord } from "@/lib/reference.server";
import type { PersonalMatch } from "@/lib/advisors/personalMatch";

function primaryOf(a: AdvisorRecord) { return a.categories.find((c) => c.role === "primary")?.label ?? a.title; }

function MatchRow({ a, m, labels, big, onView }: { a: AdvisorRecord; m: PersonalMatch; labels: Record<string, string>; big?: boolean; onView?: (id: string) => void }) {
  return (
    <div className="space-y-2 rounded-lg border border-border/50 p-3">
      <div className="flex flex-wrap items-baseline gap-2">
        <p className={big ? "font-display text-xl font-bold" : "text-sm font-semibold"}>{a.fullName}</p>
        <span className="text-xs text-muted-foreground">{primaryOf(a)}</span>
      </div>
      <p className="text-sm">{m.why}</p>
      {m.coveredNeeds.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {m.coveredNeeds.map((c) => <StatusBadge key={c} tone="ok">{labels[c] ?? c}</StatusBadge>)}
        </div>
      )}
      {big && a.strengths.length > 0 && <p className="text-xs text-muted-foreground">Key strengths: {a.strengths.slice(0, 3).join(", ")}</p>}
      {onView
        ? <button type="button" onClick={() => onView(a.id)} className="text-sm font-semibold text-primary hover:underline">View advisor</button>
        : <Link to="/advisors" hash={`advisor-${a.id}`} className="text-sm font-semibold text-primary hover:underline">View advisor</Link>}
    </div>
  );
}

/** "Your Recommended Advisor" — primary pick plus other advisors who may help. */
export function RecommendedAdvisor({ compact, onView }: { compact?: boolean; onView?: (id: string) => void }) {
  const { advisors, assessment, rec, loading, error } = useAdvisorRecommendation();
  const byId = new Map((advisors ?? []).map((a) => [a.id, a]));
  const labels = assessment?.labels ?? {};
  return (
    <GlassCard>
      <CardTitle right={rec?.status === "ready" && rec.exact ? <StatusBadge tone="ok">Recommended for you</StatusBadge> : undefined}>
        <Users className="h-4 w-4 text-primary" aria-hidden /> Your recommended advisor
      </CardTitle>
      {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {error && <p className="text-sm">Advisor recommendations are unavailable right now. You can still browse the directory.</p>}
      {rec?.status === "quiz_needed" && (
        <p className="text-sm">Finish the Getting to Know You quiz so we can suggest an advisor who fits your goals. <Link to="/onboarding" className="font-semibold text-primary hover:underline">Continue the quiz</Link></p>
      )}
      {rec?.status === "pending" && (
        <p className="text-sm">Your personalized advisor recommendation is being prepared. We'll suggest an advisor once your areas of focus are ready — meanwhile, feel free to browse everyone.</p>
      )}
      {rec?.status === "ready" && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Your current focus:</span>
            {rec.needs.map((c) => <StatusBadge key={c} tone="info">{labels[c] ?? c}</StatusBadge>)}
          </div>
          {!rec.exact && <Note>No advisor specializes exactly in your current focus yet. These are the closest people available.</Note>}
          {rec.best && byId.get(rec.best.advisorId) && <MatchRow big a={byId.get(rec.best.advisorId)!} m={rec.best} labels={labels} onView={onView} />}
          {!compact && rec.others.length > 0 && (
            <>
              <p className="pt-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Other advisors who may help</p>
              <div className="grid gap-3 md:grid-cols-2">
                {rec.others.map((m) => byId.get(m.advisorId) && <MatchRow key={m.advisorId} a={byId.get(m.advisorId)!} m={m} labels={labels} onView={onView} />)}
              </div>
            </>
          )}
          {compact && <Link to="/advisors" className="inline-block text-sm font-semibold text-primary hover:underline">See other advisors who may help</Link>}
        </div>
      )}
      <Note>Fictional demo advisors. Nothing is booked or shared automatically.</Note>
    </GlassCard>
  );
}

export { Badge };
