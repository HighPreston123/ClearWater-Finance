import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Users } from "lucide-react";
import { GlassCard, CardTitle, Note, StatusBadge } from "@/components/common/Glass";
import { useDerived } from "@/store/useDerived";
import { getResilienceComparison } from "@/lib/reference.functions";
import { MIN_MEANINGFUL, percentileOf } from "@/lib/risk/profileResilience";

export const comparisonQuery = { queryKey: ["resilience-comparison", "v1"], queryFn: () => getResilienceComparison(), staleTime: 10 * 60_000 };

export function ResilienceComparisonCard() {
  const { risk } = useDerived();
  const q = useQuery(comparisonQuery);
  const r = risk.resilience;
  const mine = r?.score ?? null;
  const res = q.data;

  return (
    <GlassCard>
      <CardTitle right={<StatusBadge tone="info">Anonymized</StatusBadge>}>
        <Users className="h-4 w-4 text-primary" aria-hidden /> How you compare
      </CardTitle>
      {q.isLoading && <p className="text-sm text-muted-foreground">Loading comparison group…</p>}
      {res && res.status !== "ok" && <Note>{"message" in res ? res.message : "Comparison is unavailable."}</Note>}
      {res?.status === "ok" && (() => {
        const s = res.data;
        const pct = mine !== null ? percentileOf(mine, s.sorted) : null;
        const peak = Math.max(1, ...s.histogram.map((h) => h.count));
        return (
          <div className="space-y-4">
            {mine === null ? (
              <Note>Your Future Resilience Score isn't available yet, so we can't place you in the group. Add your Future risk inputs to see where you land.</Note>
            ) : (
              <p className="text-sm">
                Your score is <strong>{mine}</strong> out of 100{s.average !== null && <> — {mine >= s.average ? "higher than" : "below"} the group average of <strong>{s.average}</strong></>}.
                {pct !== null && <> That's roughly the <strong>{pct}th percentile</strong>, so you're in the {pct >= 50 ? `top ${Math.max(1, 100 - pct)}%` : `bottom ${Math.max(1, pct)}%`} of the comparison group.</>}
              </p>
            )}
            {s.scored < MIN_MEANINGFUL && <Note>Fewer than {MIN_MEANINGFUL} comparison accounts have enough data — this comparison may not be meaningful.</Note>}
            <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
              {[["Group average", s.average], ["Median", s.median], ["Lowest", s.min], ["Highest", s.max]].map(([l, v]) => (
                <div key={l as string} className="rounded-2xl border bg-card p-3"><p className="text-xs text-muted-foreground">{l}</p><p className="text-lg font-bold tabular-nums">{v ?? "—"}</p></div>
              ))}
            </div>
            <div>
              <p className="mb-2 text-xs text-muted-foreground">Accounts in each score range{mine !== null && " — your range is highlighted"}</p>
              <div className="flex h-32 items-end gap-1" role="img" aria-label="Score distribution of the comparison group">
                {s.histogram.map((h) => {
                  const isMine = mine !== null && mine >= h.from && mine <= h.to;
                  return (
                    <div key={h.from} className="flex flex-1 flex-col items-center gap-1">
                      <span className="text-[10px] tabular-nums text-muted-foreground">{h.count}</span>
                      <div className={`w-full rounded-t ${isMine ? "bg-primary" : "bg-muted-foreground/30"}`} style={{ height: `${(h.count / peak) * 90}px` }} />
                      <span className={`text-[10px] ${isMine ? "font-bold text-primary" : "text-muted-foreground"}`}>{h.from}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-xs text-muted-foreground"><th className="py-1">Pillar</th><th>You</th><th>Group average</th><th>Difference</th></tr></thead>
                <tbody>
                  {(r?.pillars ?? []).map((p) => {
                    const g = s.pillarAverages[p.id];
                    const you = p.score === null ? null : Math.round(p.score);
                    const diff = you !== null && g !== null ? Math.round(you - g) : null;
                    return (
                      <tr key={p.id} className="border-t">
                        <td className="py-1.5">{p.label}</td>
                        <td className="tabular-nums">{you ?? "Not scored"}</td>
                        <td className="tabular-nums">{g === null ? "Not scored" : Math.round(g)}</td>
                        <td className="tabular-nums">{diff === null ? "—" : `${diff > 0 ? "+" : ""}${diff}`}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Note>
              Comparison group: {s.total} fictional sample profiles scored with the same {s.version} methodology ({s.scored} had enough data, {s.insufficient} didn't). Only totals are shown — no names or individual records.{" "}
              <Link to="/methodology" className="font-semibold text-primary hover:underline">How the score works</Link>
            </Note>
          </div>
        );
      })()}
    </GlassCard>
  );
}
