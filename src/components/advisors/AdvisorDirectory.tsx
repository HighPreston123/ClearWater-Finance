import { useEffect, useState } from "react";
import { GlassCard, StatusBadge } from "@/components/common/Glass";
import { Badge } from "@/components/ui/badge";
import { FOCUS_LABELS, type AdvisorProfile } from "@/types/advisors";
import { getAdvisorProvider } from "@/services/advisors/advisorProvider";
import { listAdvisorRecords } from "@/lib/reference.functions";
import type { AdvisorRecord } from "@/lib/reference.server";

const FORMAT: Record<string, string> = { virtual: "Virtual", in_person: "In person", hybrid: "Hybrid" };

// Reference data: kept for the whole session so revisiting Advisors is instant.
let directoryCache: Promise<AdvisorRecord[] | null> | null = null;
const loadDirectory = () =>
  (directoryCache ??= listAdvisorRecords()
    .then((r) => (r.status === "ok" && r.data.length ? r.data : null))
    .catch((e) => { directoryCache = null; throw e; }));

export function AdvisorDirectory() {
  const [records, setRecords] = useState<AdvisorRecord[] | null>(null);
  const [fallback, setFallback] = useState<AdvisorProfile[] | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    // Persisted directory first; legacy providers only if the database is unreachable.
    loadDirectory().then(async (data) => {
      if (data) return setRecords(data);
      directoryCache = null;
      const n = await getAdvisorProvider("nessie").listAdvisors();
      if (n.status === "ok" && n.data.length) return setFallback(n.data);
      const s = await getAdvisorProvider("sample").listAdvisors();
      if (s.status === "ok") setFallback(s.data);
      else setMsg(s.message);
    }).catch(() => setMsg("Advisor directory is unavailable right now."));
  }, []);
  if (msg) return <p className="text-sm">{msg}</p>;
  if (records) return <PersonalDirectory records={records} />;
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
