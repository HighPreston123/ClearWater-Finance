import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getAdvisorMatches, type AdvisorMatchResponse } from "@/lib/advisors.functions";
import { CardTitle, GlassCard, Note, StatusBadge } from "@/components/common/Glass";
import { Button } from "@/components/ui/button";

const FORMAT_LABELS: Record<string, string> = { virtual: "Virtual", in_person: "In person", hybrid: "Hybrid" };

export function AdvisorMatchCard() {
  const run = useServerFn(getAdvisorMatches);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [res, setRes] = useState<AdvisorMatchResponse | null>(null);

  const go = async () => {
    setBusy(true); setErr(null);
    try {
      setRes(await run());
    } catch { setErr("Could not load advisor matches."); }
    finally { setBusy(false); }
  };

  return (
    <GlassCard>
      <CardTitle right={<Button size="sm" onClick={go} disabled={busy}>{busy ? "Matching…" : res ? "Refresh matches" : "Find matching advisors"}</Button>}>
        Advisor matching
      </CardTitle>
      <p className="mb-4 text-sm text-muted-foreground">
        Matches your assessment survey to advisor specialties using the shared category framework. All advisors in
        this directory are fictional demo profiles.
      </p>
      {err && <Note>{err}</Note>}
      {res?.status === "no_survey" && <Note>Complete the financial assessment survey above first — matching is based on your answers.</Note>}
      {res?.status === "no_matches" && <Note>No advisors share focus areas with your current survey answers.</Note>}
      {res && res.status === "ok" && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-1.5">
            <span className="text-xs text-muted-foreground">Your focus areas:</span>
            {res.userCategories.map((c) => (
              <StatusBadge key={c} tone="info">{res.categoryLabels[c] ?? c}</StatusBadge>
            ))}
          </div>
          {res.matches.map((m) => (
            <div key={m.advisor.id} className="space-y-1.5 rounded-lg border border-border/50 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium">{m.advisor.fullName}</p>
                <span className="text-xs text-muted-foreground">{m.advisor.title}</span>
                {m.advisor.meetingFormat && <StatusBadge tone="off">{FORMAT_LABELS[m.advisor.meetingFormat] ?? m.advisor.meetingFormat}</StatusBadge>}
              </div>
              <p className="text-xs text-muted-foreground">{m.advisor.experience}</p>
              <div className="flex flex-wrap gap-1.5">
                {m.sharedCategories.map((c) => (
                  <StatusBadge key={c} tone="ok">{res.categoryLabels[c] ?? c}</StatusBadge>
                ))}
              </div>
              {m.advisor.certifications.length > 0 && (
                <p className="text-xs text-muted-foreground">Certifications: {m.advisor.certifications.join(", ")}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </GlassCard>
  );
}
