import { useEffect, useState } from "react";
import { GlassCard, StatusBadge } from "@/components/common/Glass";
import { Badge } from "@/components/ui/badge";
import { FOCUS_LABELS, type AdvisorProfile } from "@/types/advisors";
import { getAdvisorProvider } from "@/services/advisors/advisorProvider";
import { listAdvisorRecords } from "@/lib/reference.functions";
import type { AdvisorRecord } from "@/lib/reference.server";

const FORMAT: Record<string, string> = { virtual: "Virtual", in_person: "In person", hybrid: "Hybrid" };

export function AdvisorDirectory() {
  const [records, setRecords] = useState<AdvisorRecord[] | null>(null);
  const [fallback, setFallback] = useState<AdvisorProfile[] | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    // Persisted directory first; legacy providers only if the database is unreachable.
    listAdvisorRecords().then(async (r) => {
      if (r.status === "ok" && r.data.length) return setRecords(r.data);
      const n = await getAdvisorProvider("nessie").listAdvisors();
      if (n.status === "ok" && n.data.length) return setFallback(n.data);
      const s = await getAdvisorProvider("sample").listAdvisors();
      if (s.status === "ok") setFallback(s.data);
      else setMsg(s.message);
    }).catch(() => setMsg("Advisor directory is unavailable right now."));
  }, []);
  if (msg) return <p className="text-sm">{msg}</p>;
  if (records) {
    return (
      <ul className="grid gap-4 md:grid-cols-2">
        {records.filter((a) => a.isActive).map((a) => (
          <li key={a.id}>
            <GlassCard as="article" className="h-full">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="font-display text-lg font-bold">{a.fullName}</h3>
                  <p className="text-xs text-muted-foreground">{a.title}</p>
                </div>
                {a.isFictional && <StatusBadge tone="pending">Fictional demo profile</StatusBadge>}
              </div>
              <p className="mt-2 text-sm">{a.biography}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {a.categories.map((c) => (
                  <Badge key={c.code} variant={c.role === "primary" ? "default" : "secondary"} className="rounded-full">{c.label}</Badge>
                ))}
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                {a.experience} · Style: {a.advisoryStyle} · Format: {a.meetingFormat ? FORMAT[a.meetingFormat] : "Unknown"}
              </p>
              {a.bestSuitedFor.length > 0 && <p className="mt-1 text-xs text-muted-foreground">Best for: {a.bestSuitedFor.join(", ")}</p>}
              <p className="mt-1 text-xs text-muted-foreground">Not a verified professional. No credentials implied.</p>
            </GlassCard>
          </li>
        ))}
      </ul>
    );
  }
  if (!fallback) return <p className="text-sm text-muted-foreground">Loading directory…</p>;
  return (
    <ul className="grid gap-4 md:grid-cols-2">
      {fallback.map((a) => (
        <li key={a.id}>
          <GlassCard as="article" className="h-full">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h3 className="font-display text-lg font-bold">{a.name}</h3>
              {a.isFictional && <StatusBadge tone="pending">Fictional demo profile</StatusBadge>}
            </div>
            <p className="mt-1 text-sm">{a.description}</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {a.focusAreas.map((f) => <Badge key={f} variant="secondary" className="rounded-full">{FOCUS_LABELS[f]}</Badge>)}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">Supports: {a.supportedNeeds.join(", ")} · Format: {a.meetingFormat ?? "Unknown"} · Source: {a.source}</p>
            <p className="mt-1 text-xs text-muted-foreground">Not a verified professional. No credentials implied.</p>
          </GlassCard>
        </li>
      ))}
    </ul>
  );
}
