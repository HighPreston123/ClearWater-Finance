import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { getAnalytics, refreshAnalysis, demoAction } from "@/lib/analytics.functions";
import type { AnalyticsResult, ScoreRevision } from "@/lib/analytics.server";
import { useFinanceStore } from "@/store/FinanceStore";
import { GlassCard, CardTitle, Note, StatusBadge } from "@/components/common/Glass";
import { InfoTip } from "@/components/common/InfoTip";
import { Button } from "@/components/ui/button";
import { formatCents, formatCentsShort, formatTimestamp, monthLabel } from "@/lib/format";
import { RECONSTRUCTED_LABEL } from "@/lib/finance/scoreHistory";
import { SCORE_SCOPE } from "@/lib/finance/score";
import { cn } from "@/lib/utils";

const KEY = ["tiger-analytics"];

export function TigerAnalyticsPanel() {
  const { syncStatus, retrySync, userId } = useFinanceStore();
  const qc = useQueryClient();
  const ready = syncStatus === "synced" || syncStatus === "saving" || syncStatus === "save_error";
  const q = useQuery({ queryKey: [...KEY, userId], queryFn: () => getAnalytics(), enabled: ready && !!userId, retry: 1, staleTime: 60_000 });

  const refresh = useMutation({
    mutationFn: () => refreshAnalysis(),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: KEY }); toast.success("Analysis refreshed from TigerData"); },
    onError: (e) => toast.error(`Refresh failed: ${(e as Error).message}`),
  });
  const demo = useMutation({
    mutationFn: (action: "load" | "reset") => demoAction({ data: { action } }),
    onSuccess: (r, action) => {
      retrySync(); // pull the saved transaction list so the rest of the app matches the database
      void qc.invalidateQueries({ queryKey: KEY });
      toast.success(action === "load" ? `Demo month saved to TigerData (${r.changed} new transactions)` : `Removed ${r.changed} demo transactions`);
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const d = q.data;
  return (
    <section aria-labelledby="tiger-trends" className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 id="tiger-trends" className="font-display text-2xl font-extrabold tracking-tight">Spending trends & score history</h2>
          <p className="text-sm text-muted-foreground">
            Calculated in the database from your saved transactions.{" "}
            {d ? <>Last updated {formatTimestamp(d.generatedAt)}{d.dataUpdatedAt ? ` · data changed ${formatTimestamp(d.dataUpdatedAt)}` : ""}.</> : null}
          </p>
        </div>
        <Button variant="outline" onClick={() => refresh.mutate()} disabled={!ready || refresh.isPending} className="rounded-full">
          <RefreshCw className={cn("mr-2 h-4 w-4", refresh.isPending && "animate-spin")} /> Refresh analysis
        </Button>
      </div>

      {!ready || q.isLoading ? (
        <GlassCard><p className="text-sm text-muted-foreground">{syncStatus === "load_error" ? "Your saved data couldn't be loaded, so analysis is paused." : "Loading analysis from the database…"}</p></GlassCard>
      ) : q.isError ? (
        <GlassCard>
          <p className="text-sm text-destructive">Couldn't load analysis: {(q.error as Error).message}</p>
          <Button size="sm" variant="outline" className="mt-3 rounded-full" onClick={() => q.refetch()}>Try again</Button>
        </GlassCard>
      ) : d ? (
        <Body d={d} />
      ) : null}

      <GlassCard>
        <CardTitle info={<InfoTip title="Demonstration data" means="A labeled sample month (June 2026) you can add and remove." calc="Saved to the database, summaries refreshed, scores recalculated with the existing formula." excludes="Your personal transactions — reset only removes demo rows." />}>Demonstration</CardTitle>
        <p className="text-sm text-muted-foreground">Adds 18 clearly labeled sample transactions for June 2026, including one savings transfer (excluded from spending). Adding it twice never duplicates rows.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" className="rounded-full" disabled={!ready || demo.isPending} onClick={() => demo.mutate("load")}>Add demo month</Button>
          <Button size="sm" variant="outline" className="rounded-full" disabled={!ready || demo.isPending} onClick={() => demo.mutate("reset")}>Reset demo data</Button>
        </div>
      </GlassCard>
    </section>
  );
}

const pctText = (p: number | null) => (p === null ? "no % (was $0)" : `${p > 0 ? "+" : ""}${p.toFixed(0)}%`);
const signed = (c: number) => `${c > 0 ? "+" : c < 0 ? "−" : ""}${formatCents(Math.abs(c))}`;

function Body({ d }: { d: AnalyticsResult }) {
  const [view, setView] = useState<"month" | "week">("month");
  if (d.empty) {
    return <GlassCard><p className="text-sm text-muted-foreground">No transactions saved yet. Import a CSV in Settings or add the demo month below.</p></GlassCard>;
  }
  const periods = view === "month" ? d.months : d.weeks.slice(-16);
  const chart = periods.map((p) => ({
    label: `${view === "month" ? monthLabel(p.bucket.slice(0, 7)) : p.bucket.slice(5)}${p.complete ? "" : " (partial)"}`,
    Income: p.income, Spending: p.spending, Net: p.net,
  }));
  const c = d.comparison;

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {d.includesSample && <StatusBadge tone="pending">Includes sample/demo data</StatusBadge>}
        <StatusBadge tone="info">{d.source === "continuous_aggregate" ? "TimescaleDB daily aggregate" : "Direct SQL (aggregate unavailable)"}</StatusBadge>
        {d.reconciled === true && <StatusBadge tone="ok">Matches source transactions</StatusBadge>}
        {d.reconciled === false && <StatusBadge tone="warn">Summary out of date — press Refresh analysis</StatusBadge>}
        {d.excludedCurrencies.length > 0 && <StatusBadge tone="warn">Excluded non-USD: {d.excludedCurrencies.join(", ")}</StatusBadge>}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <GlassCard>
          <CardTitle right={
            <div className="flex gap-1" role="group" aria-label="Period">
              {(["month", "week"] as const).map((v) => (
                <Button key={v} size="sm" variant={view === v ? "default" : "ghost"} className="h-7 rounded-full px-3" onClick={() => setView(v)} aria-pressed={view === v}>{v === "month" ? "Monthly" : "Weekly"}</Button>
              ))}
            </div>
          }>Income vs. spending</CardTitle>
          <div className="h-72">
            <ResponsiveContainer>
              <BarChart data={chart}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="label" stroke="var(--muted-foreground)" fontSize={11} />
                <YAxis tickFormatter={(v) => formatCentsShort(v)} stroke="var(--muted-foreground)" fontSize={12} width={70} />
                <Tooltip formatter={(v: number) => formatCents(v)} />
                <Legend />
                <Bar dataKey="Income" fill="var(--chart-2)" radius={[8, 8, 0, 0]} isAnimationActive={false} />
                <Bar dataKey="Spending" fill="var(--chart-1)" radius={[8, 8, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <Note>Calendar {view === "month" ? "months" : "weeks (Monday start)"}. Partial periods are labeled. Transfers are excluded from income and spending.</Note>
          {view === "week" && d.weekComparison?.previous && (
            <p className="mt-2 text-sm">Last complete week: spending {formatCents(d.weekComparison.current.spending)} ({signed(d.weekComparison.current.spending - d.weekComparison.previous.spending)} vs. prior week), net {formatCents(d.weekComparison.current.net)}.</p>
          )}
        </GlassCard>

        <GlassCard>
          <CardTitle>What changed?</CardTitle>
          {!c ? <p className="text-sm text-muted-foreground">No complete month yet to compare.</p> : !c.previous ? (
            <p className="text-sm text-muted-foreground">{monthLabel(c.current.bucket.slice(0, 7), true)} is the first complete month — there's no previous complete month to compare with.</p>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">{monthLabel(c.current.bucket.slice(0, 7), true)} compared with {monthLabel(c.previous.bucket.slice(0, 7), true)} (complete months).</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{c.statements.map((s) => <li key={s}>{s}</li>)}</ul>
            </>
          )}
        </GlassCard>
      </div>

      {c && (
        <GlassCard>
          <CardTitle>Spending by category — {monthLabel(c.current.bucket.slice(0, 7), true)}{c.previous ? ` vs. ${monthLabel(c.previous.bucket.slice(0, 7), true)}` : ""}</CardTitle>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground"><tr><th className="py-1">Category</th><th className="text-right">Previous</th><th className="text-right">Current</th><th className="text-right">Change</th></tr></thead>
              <tbody>
                {c.categories.map((r) => (
                  <tr key={r.category} className="border-t">
                    <td className="py-1.5">{r.category}</td>
                    <td className="text-right tabular-nums">{c.previous ? formatCents(r.previous) : "—"}</td>
                    <td className="text-right tabular-nums">{formatCents(r.current)}</td>
                    <td className="text-right tabular-nums">{c.previous ? `${signed(r.change.delta)} · ${pctText(r.change.pct)}` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlassCard>
      )}

      <ScoreTimeline current={d.scoreHistory.current} revisions={d.scoreHistory.revisions} />
    </>
  );
}

function ScoreTimeline({ current, revisions }: { current: ScoreRevision[]; revisions: ScoreRevision[] }) {
  const [sel, setSel] = useState<string | null>(null);
  const selected = current.find((r) => r.periodStart === sel) ?? current[current.length - 1] ?? null;
  const data = current.map((r) => ({ period: r.periodStart, label: monthLabel(r.periodStart.slice(0, 7)), Score: r.score }));
  const prev = useMemo(() => {
    if (!selected) return null;
    const i = current.findIndex((r) => r.id === selected.id);
    return i > 0 ? current[i - 1]! : null;
  }, [current, selected]);
  const periodRevs = selected ? revisions.filter((r) => r.periodStart === selected.periodStart) : [];

  return (
    <GlassCard>
      <CardTitle info={<InfoTip title="Historical cash-flow score history" means="One current assessment per complete month, stored in the database." calc="The existing cash-flow score formula, rerun for each month. Identical data never creates a duplicate entry; changed data creates a new revision." excludes="Future risk — not calculated until its methodology is implemented." />}>Historical cash-flow score timeline</CardTitle>
      {!current.length ? <p className="text-sm text-muted-foreground">No complete months scored yet.</p> : (
        <>
          <div className="h-56">
            <ResponsiveContainer>
              <LineChart data={data} onClick={(e) => { const p = (e as { activePayload?: { payload: { period: string } }[] })?.activePayload?.[0]?.payload; if (p) setSel(p.period); }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="label" stroke="var(--muted-foreground)" fontSize={12} />
                <YAxis domain={[0, 1000]} stroke="var(--muted-foreground)" fontSize={12} width={45} />
                <Tooltip />
                <Line type="monotone" dataKey="Score" stroke="var(--primary)" strokeWidth={2} dot={{ r: 5 }} activeDot={{ r: 7 }} connectNulls={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Select a scored month">
            {current.map((r) => (
              <Button key={r.id} size="sm" variant={selected?.id === r.id ? "default" : "outline"} className="h-7 rounded-full px-3" onClick={() => setSel(r.periodStart)} aria-pressed={selected?.id === r.id}>
                {monthLabel(r.periodStart.slice(0, 7))}: {r.score ?? "—"}
              </Button>
            ))}
          </div>
          {selected && <Details r={selected} prev={prev} revisions={periodRevs} />}
        </>
      )}
      <Note>{SCORE_SCOPE}</Note>
    </GlassCard>
  );
}

function Details({ r, prev, revisions }: { r: ScoreRevision; prev: ScoreRevision | null; revisions: ScoreRevision[] }) {
  const comparable = prev && prev.methodologyVersion === r.methodologyVersion && prev.status === "ok" && r.status === "ok";
  return (
    <div className="mt-4 rounded-2xl border bg-card p-4 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-display text-lg font-bold">{monthLabel(r.periodStart.slice(0, 7), true)}: {r.score ?? "No score"}</p>
        {r.status === "insufficient_data" && <StatusBadge tone="off">Insufficient data</StatusBadge>}
        {r.reconstructed && <StatusBadge tone="info">{RECONSTRUCTED_LABEL}</StatusBadge>}
        <StatusBadge tone="off">Method {r.methodologyVersion}</StatusBadge>
      </div>
      {r.status === "insufficient_data" && <p className="mt-1 text-muted-foreground">{String(r.metrics["reason"] ?? "Not enough data to score this month.")}</p>}
      {prev && !comparable && prev.methodologyVersion !== r.methodologyVersion && <p className="mt-1 text-muted-foreground">Previous month used a different methodology ({prev.methodologyVersion}); scores aren't compared.</p>}
      {comparable && (
        <p className="mt-1">Compared with {monthLabel(prev.periodStart.slice(0, 7), true)}: {r.score! - prev.score! >= 0 ? "+" : ""}{r.score! - prev.score!} points.</p>
      )}
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        {r.factors.map((f) => {
          const pf = comparable ? prev.factors.find((x) => x.id === f.id) : undefined;
          return (
            <div key={f.id} className="rounded-xl border p-3">
              <p className="font-semibold">{f.name}</p>
              <p className="text-muted-foreground">{f.unavailable ? "Unavailable" : `${f.earned} of ${f.available} points`}{pf && !pf.unavailable && !f.unavailable ? ` (${f.earned - pf.earned >= 0 ? "+" : ""}${f.earned - pf.earned} vs. previous)` : ""}</p>
              <ul className="mt-1 text-xs text-muted-foreground">{f.supporting.map((s) => <li key={s.label}>{s.label}: {s.value}</li>)}</ul>
            </div>
          );
        })}
      </div>
      {revisions.length > 1 && (
        <details className="mt-3">
          <summary className="cursor-pointer text-muted-foreground">{revisions.length} revisions for this month</summary>
          <ul className="mt-2 space-y-1 text-xs">
            {revisions.map((v) => (
              <li key={v.id}>{v.id === r.id ? "Current · " : ""}Score {v.score ?? "—"} · first calculated {formatTimestamp(v.calculatedAt)} · last confirmed {formatTimestamp(v.lastConfirmedAt)} · inputs {v.fingerprint.slice(0, 8)}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
