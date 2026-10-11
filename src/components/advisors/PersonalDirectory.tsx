import { useEffect, useMemo, useState } from "react";
import { GlassCard, StatusBadge } from "@/components/common/Glass";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import type { AdvisorRecord } from "@/lib/reference.server";
import { relevanceFor } from "@/lib/advisors/personalMatch";
import { RecommendedAdvisor } from "./RecommendedAdvisor";
import { useAdvisorRecommendation } from "./useAdvisorRecommendation";

const FORMAT: Record<string, string> = { virtual: "Virtual", in_person: "In person", hybrid: "Hybrid" };

/** "Recommended for you" + "All advisors" (search, specialty filter, profiles). No advisor is hidden. */
export function PersonalDirectory({ records }: { records: AdvisorRecord[] }) {
  const { assessment } = useAdvisorRecommendation();
  const [query, setQuery] = useState("");
  const [spec, setSpec] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => {
    const id = window.location.hash.match(/^#advisor-(.+)$/)?.[1];
    if (id) setOpen(id);
  }, []);
  const active = records.filter((a) => a.isActive);
  const specialties = useMemo(() => {
    const m = new Map<string, string>();
    active.forEach((a) => a.categories.forEach((c) => m.set(c.code, c.label)));
    return [...m].sort((a, b) => a[1].localeCompare(b[1]));
  }, [active]);
  const q = query.trim().toLowerCase();
  const shown = active.filter((a) =>
    (!spec || a.categories.some((c) => c.code === spec)) &&
    (!q || [a.fullName, a.title, a.biography, ...a.strengths, ...a.categories.map((c) => c.label)].join(" ").toLowerCase().includes(q)));
  const current = active.find((a) => a.id === open) ?? null;
  const rel = current && assessment ? relevanceFor(assessment.outputs, current, assessment.labels) : null;

  return (
    <div className="space-y-6">
      <section aria-labelledby="rec-h" className="space-y-2">
        <h2 id="rec-h" className="font-display text-lg font-bold">Recommended for you</h2>
        <RecommendedAdvisor onView={setOpen} />
      </section>

      <section aria-labelledby="all-h" className="space-y-3">
        <h2 id="all-h" className="font-display text-lg font-bold">All advisors</h2>
        <div className="flex flex-wrap gap-2">
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name or strength" aria-label="Search advisors" className="max-w-xs" />
          <select value={spec} onChange={(e) => setSpec(e.target.value)} aria-label="Filter by specialty"
            className="h-9 rounded-md border border-input bg-background px-3 text-sm">
            <option value="">All specialties</option>
            {specialties.map(([code, label]) => <option key={code} value={code}>{label}</option>)}
          </select>
        </div>
        {!shown.length && <p className="text-sm text-muted-foreground">No advisors match that search.</p>}
        <ul className="grid gap-4 md:grid-cols-2">
          {shown.map((a) => {
            const r = assessment ? relevanceFor(assessment.outputs, a, assessment.labels) : null;
            return (
              <li key={a.id}>
                <GlassCard as="article" className="h-full">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h3 className="font-display text-lg font-bold">{a.fullName}</h3>
                      <p className="text-xs text-muted-foreground">{a.title}</p>
                    </div>
                    {r?.strong ? <StatusBadge tone="ok">Fits your focus</StatusBadge> : a.isFictional && <StatusBadge tone="pending">Fictional demo profile</StatusBadge>}
                  </div>
                  <p className="mt-2 line-clamp-3 text-sm">{a.biography}</p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {a.categories.map((c) => <Badge key={c.code} variant={c.role === "primary" ? "default" : "secondary"} className="rounded-full">{c.label}</Badge>)}
                  </div>
                  <button type="button" onClick={() => setOpen(a.id)} className="mt-3 text-sm font-semibold text-primary hover:underline">View profile</button>
                </GlassCard>
              </li>
            );
          })}
        </ul>
      </section>

      <Dialog open={!!current} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          {current && (
            <>
              <DialogHeader>
                <DialogTitle>{current.fullName}</DialogTitle>
                <DialogDescription>{current.title}</DialogDescription>
              </DialogHeader>
              {rel?.strong
                ? <div className="rounded-lg border border-primary/40 bg-primary/5 p-3 text-sm"><p className="font-semibold">Why this advisor fits</p><p>{rel.why}</p></div>
                : assessment?.outputs.needs.length ? <p className="text-xs text-muted-foreground">Not a direct fit for your current focus, but you're welcome to explore.</p> : null}
              <p className="text-sm">{current.biography}</p>
              <dl className="space-y-2 text-sm">
                <div><dt className="font-semibold">Primary specialty</dt><dd>{current.categories.filter((c) => c.role === "primary").map((c) => c.label).join(", ") || "—"}</dd></div>
                <div><dt className="font-semibold">Also helps with</dt><dd>{current.categories.filter((c) => c.role === "secondary").map((c) => c.label).join(", ") || "—"}</dd></div>
                {current.strengths.length > 0 && <div><dt className="font-semibold">Strengths</dt><dd>{current.strengths.join(", ")}</dd></div>}
                <div><dt className="font-semibold">Advisory style</dt><dd>{current.advisoryStyle}</dd></div>
                {current.bestSuitedFor.length > 0 && <div><dt className="font-semibold">Situations they help with</dt><dd>{current.bestSuitedFor.join(", ")}</dd></div>}
                <div><dt className="font-semibold">Experience</dt><dd>{current.experience} · Format: {current.meetingFormat ? FORMAT[current.meetingFormat] : "Unknown"}</dd></div>
              </dl>
              <p className="text-xs text-muted-foreground">Fictional demo profile. Not a verified professional. No credentials implied.</p>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
