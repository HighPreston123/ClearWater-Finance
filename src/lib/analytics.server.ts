/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Transaction } from "@/types/finance";
import { check, type Db } from "./db.server";
import { compareCategories, lastTwoComplete, toPeriods, whatChanged, type BucketRow, type CategoryComparison, type TrendPeriod } from "./finance/trends";
import { assessAllMonths, isReconstructed, SCORE_METHODOLOGY_VERSION, SCORE_TYPE } from "./finance/scoreHistory";
import type { ScoreFactor } from "./finance/score";

/** Server-only analytics. Every function takes the caller's client (RLS scopes all rows to the verified owner). */

export interface ScoreRevision {
  id: string;
  periodStart: string;
  periodEnd: string;
  score: number | null;
  status: "ok" | "insufficient_data";
  factors: ScoreFactor[];
  metrics: Record<string, string | number | boolean | null>;
  methodologyVersion: string;
  fingerprint: string;
  reconstructed: boolean;
  calculatedAt: string;
  lastConfirmedAt: string;
}

export interface AnalyticsResult {
  empty: boolean;
  bounds: { start: string; end: string } | null;
  includesSample: boolean;
  /** Non-USD currencies are not combined with USD (no conversion method defined). */
  excludedCurrencies: string[];
  source: "daily_summary";
  /** Daily-summary totals equal a direct aggregation of the transactions table. */
  reconciled: boolean | null;
  months: TrendPeriod[];
  weeks: TrendPeriod[];
  comparison: { current: TrendPeriod; previous: TrendPeriod | null; categories: CategoryComparison[]; statements: string[] } | null;
  weekComparison: { current: TrendPeriod; previous: TrendPeriod | null } | null;
  scoreHistory: { current: ScoreRevision[]; revisions: ScoreRevision[] };
  dataUpdatedAt: string | null;
  generatedAt: string;
}

const rowsToBuckets = (rows: any[]): BucketRow[] =>
  rows.map((r) => ({ bucket: r.b, income: Number(r.income ?? 0), spending: Number(r.spending ?? 0), transfers: Number(r.transfers ?? 0), txnCount: Number(r.n ?? 0) }));

export async function getAnalytics(db: Db): Promise<AnalyticsResult> {
  if (!/^[a-z_]+$/.test(SCORE_TYPE)) throw new Error("bad score type");
  const D = /^\d{4}-\d{2}-\d{2}$/;
  // One call, one snapshot: bounds, score history, direct monthly totals, and the daily-summary buckets (owner-scoped by RLS).
  const head = check(await db.rpc("fin_analytics", { p_score_type: SCORE_TYPE }), "analytics") as any;
  const source: AnalyticsResult["source"] = "daily_summary";
  {
    const b = head?.b ?? {};
    const history = mapScoreHistory(head?.history ?? []);
    const generatedAt = new Date().toISOString();
    if (!b?.s) {
      return { empty: true, bounds: null, includesSample: false, excludedCurrencies: [], source, reconciled: null,
        months: [], weeks: [], comparison: null, weekComparison: null, scoreHistory: { current: [], revisions: history.revisions }, dataUpdatedAt: null, generatedAt };
    }
    const bounds = { start: b.s as string, end: b.e as string };
    if (!D.test(bounds.start) || !D.test(bounds.end)) throw new Error("bad analytics bounds");
    // Periods no longer complete in the dataset (e.g. after removing data) drop out of the main timeline.
    history.current = history.current.filter((r) => r.periodStart >= bounds.start && r.periodEnd <= bounds.end);
    const direct: any[] = head.direct ?? [];
    const monthly: any[] = head.monthly ?? [];
    const weekly: any[] = head.weekly ?? [];
    const cats: any[] = head.cats ?? [];

    const months = toPeriods(rowsToBuckets(monthly), "month", bounds);
    const weeks = toPeriods(rowsToBuckets(weekly), "week", bounds);
    const key = (r: BucketRow) => `${r.bucket}|${r.income}|${r.spending}|${r.transfers}|${r.txnCount}`;
    const reconciled = rowsToBuckets(direct).map(key).join() === rowsToBuckets(monthly).map(key).join();

    const pair = lastTwoComplete(months, "month");
    let comparison: AnalyticsResult["comparison"] = null;
    if (pair) {
      const catMap = (bucket: string | undefined) => new Map(cats.filter((c) => c.b === bucket).map((c) => [c.category as string, Number(c.cents)]));
      const categories = compareCategories(catMap(pair.current.bucket), catMap(pair.previous?.bucket));
      comparison = { ...pair, categories, statements: pair.previous ? whatChanged(pair.current, pair.previous, categories) : [] };
    }
    const wk = lastTwoComplete(weeks, "week");
    return {
      empty: false, bounds, includesSample: Boolean(b.sample), excludedCurrencies: b.other ?? [], source, reconciled,
      months, weeks, comparison, weekComparison: wk, scoreHistory: history,
      dataUpdatedAt: b.upd ? new Date(b.upd).toISOString() : null, generatedAt,
    };
  }
}

function mapScoreHistory(rows: any[]) {
  const revisions: ScoreRevision[] = rows.map((r: any) => ({
    id: r.id, periodStart: r.ps, periodEnd: r.pe, score: r.score, status: r.status, factors: r.factors, metrics: r.metrics,
    methodologyVersion: r.methodology_version, fingerprint: r.input_fingerprint, reconstructed: r.reconstructed,
    calculatedAt: new Date(r.calculated_at).toISOString(), lastConfirmedAt: new Date(r.last_confirmed_at).toISOString(),
  }));
  // Current = most recently confirmed revision per period; only for periods still complete in the dataset.
  const latest = new Map<string, ScoreRevision>();
  for (const r of revisions) latest.set(r.periodStart, r);
  return { current: [...latest.values()], revisions };
}

async function sha256(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

/** Recalculates every complete month with the existing formula. Identical inputs never create a new row. */
export async function recalculateScores(db: Db): Promise<{ assessed: number }> {
  const rows = (check(await db.rpc("fin_score_inputs"), "score_inputs") as any[]) ?? [];
  const txns = rows.map((t) => ({ id: t.id, date: t.d, merchant: t.merchant, amount: Number(t.amount_cents), type: t.txn_type, category: t.category,
    categorySource: t.category_source, description: t.description, accountId: t.account_id })) as Transaction[];
  const now = new Date();
  const assessments = assessAllMonths(txns);
  const payload = [];
  for (const a of assessments) {
    payload.push({ score_type: SCORE_TYPE, period_start: a.periodStart, period_end: a.periodEnd, score: a.score, status: a.status,
      factors: a.factors, metrics: a.metrics, methodology_version: SCORE_METHODOLOGY_VERSION,
      input_fingerprint: await sha256(a.fingerprintInput), reconstructed: isReconstructed(a.periodEnd, now) });
  }
  if (payload.length) check(await db.rpc("fin_record_scores", { p: payload as any }), "record_scores");
  return { assessed: assessments.length };
}

/** After a successful save: rescore (later months depend on earlier ones). Summaries are computed live, so nothing to refresh. */
export async function afterTransactionsChanged(db: Db) {
  await recalculateScores(db);
}

// ---------------- Demonstration dataset (explicitly labeled, idempotent, separately resettable) ----------------
export const DEMO_MONTH = "2026-06";
const DEMO_ROWS: [day: number, merchant: string, dollars: number, type: "income" | "expense" | "transfer", category: string][] = [
  [1, "Demo Employer Payroll", 2600, "income", "Income"],
  [1, "Demo Apartments", 1800, "expense", "Housing"],
  [3, "Demo Grocer", 120, "expense", "Groceries"],
  [5, "Demo Bistro", 45, "expense", "Dining"],
  [8, "Demo Power & Water", 140, "expense", "Utilities"],
  [10, "Demo Grocer", 118, "expense", "Groceries"],
  [12, "Demo Streaming", 15, "expense", "Subscriptions"],
  [12, "Demo Taqueria", 38, "expense", "Dining"],
  [14, "Demo Transit", 40, "expense", "Transportation"],
  [15, "Demo Employer Payroll", 2600, "income", "Income"],
  [15, "Transfer to Savings (demo)", 300, "transfer", "Savings"],
  [17, "Demo Grocer", 126, "expense", "Groceries"],
  [19, "Demo Bistro", 52, "expense", "Dining"],
  [21, "Demo Outfitters", 85, "expense", "Shopping"],
  [24, "Demo Grocer", 115, "expense", "Groceries"],
  [26, "Demo Cinema", 30, "expense", "Entertainment"],
  [28, "Demo Transit", 40, "expense", "Transportation"],
  [30, "Demo Music", 10, "expense", "Subscriptions"],
];

export async function loadDemo(db: Db, owner: string): Promise<{ inserted: number }> {
  const settings = check(await db.from("fin_user_settings").select("user_id").eq("user_id", owner).maybeSingle(), "demo_settings");
  if (!settings) throw new Error("Open the app once so your account is set up before loading the demo.");
  const rows = DEMO_ROWS.map(([day, merchant, dollars, type, category], i) => {
    const id = `demo-${DEMO_MONTH}-${String(i + 1).padStart(2, "0")}`;
    return {
      user_id: owner, id, txn_date: `${DEMO_MONTH}-${String(day).padStart(2, "0")}`, merchant, amount_cents: dollars * 100, txn_type: type,
      category, category_source: "rule", description: "Demonstration data — not personal", account_id: "acct-checking",
      linked_account_id: type === "transfer" ? "acct-savings" : null, source: "demo", external_id: id, is_sample: true,
    };
  });
  const res = check(await db.from("fin_transactions").upsert(rows, { onConflict: "user_id,id", ignoreDuplicates: true }).select("id"), "demo_load") ?? [];
  await afterTransactionsChanged(db);
  return { inserted: res.length };
}

export async function resetDemo(db: Db, owner: string): Promise<{ removed: number }> {
  const res = check(await db.from("fin_transactions").delete().eq("user_id", owner).eq("source", "demo").select("id"), "demo_reset") ?? [];
  await afterTransactionsChanged(db);
  return { removed: res.length };
}
