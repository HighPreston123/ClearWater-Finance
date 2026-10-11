import { useEffect, useState } from "react";
import { GlassCard, CardTitle, Note } from "@/components/common/Glass";
import { getReferenceDiagnostics } from "@/lib/reference.functions";
import type { ReferenceDiagnostics as D } from "@/lib/reference.server";

/** Developer check of the background advisor + comparison data. Shows counts only — no scores. */
export function ReferenceDiagnostics() {
  const [d, setD] = useState<D | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    getReferenceDiagnostics().then((r) => (r.status === "ok" ? setD(r.data) : setMsg(r.message))).catch(() => setMsg("Diagnostics are unavailable right now."));
  }, []);
  const rows: [string, string][] = d ? [
    ["Advisors", String(d.advisorCount)],
    ["Comparison profiles", String(d.profileCount)],
    ["Profiles with a calculated score", d.profilesWithScore ? String(d.profilesWithScore) : "None yet (assessment pending)"],
    ["Profiles with categories", d.profilesWithCategories ? String(d.profilesWithCategories) : "None yet (assigned by future assessment)"],
    ["Profiles with eligible advisors", String(d.profilesWithMatches)],
  ] : [];
  return (
    <GlassCard>
      <CardTitle>Comparison data check</CardTitle>
      {msg && <p className="text-sm">{msg}</p>}
      {!d && !msg && <p className="text-sm text-muted-foreground">Checking…</p>}
      {d && (
        <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-sm">
          {rows.flatMap(([k, v]) => [<dt key={k} className="text-muted-foreground">{k}</dt>, <dd key={k + "v"} className="text-right font-medium">{v}</dd>])}
        </dl>
      )}
      <Note>Fictional background profiles used for future score comparisons. They are not shown as customers.</Note>
    </GlassCard>
  );
}
