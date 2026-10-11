/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Transaction } from "@/types/finance";
import { withOwner, ownerSnapshot, refreshOwnerAnalytics } from "./tiger.server";
import { compareCategories, lastTwoComplete, toPeriods, whatChanged, type BucketRow, type CategoryComparison, type TrendPeriod } from "./finance/trends";
import { assessAllMonths, isReconstructed, SCORE_METHODOLOGY_VERSION, SCORE_TYPE } from "./finance/scoreHistory";
import type { ScoreFactor } from "./finance/score";

/** Server-only analytics over TigerData. Every function takes the VERIFIED owner id. */

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
  source: "continuous_aggregate" | "direct_sql";
  /** Continuous-aggregate totals equal a direct aggregation of fin.transactions. */
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

const BUCKET_COLS = (dateCol: string, width: string, n: string) => `to_char(time_bucket(INTERVAL '${width}', ${dateCol}),'YYYY-MM-DD') AS b,
    sum(amount_cents) FILTER (WHERE txn_type = 'income') AS income, sum(amount_cents) FILTER (WHERE txn_type = 'expense') AS spending,
    sum(amount_cents) FILTER (WHERE txn_type = 'transfer') AS transfers, ${n} AS n`;
const rowsJson = (inner: string) => `COALESCE((SELECT jsonb_agg(to_jsonb(q) ORDER BY q.b) FROM (${inner}) q), '[]')`;

export async function getAnalytics(owner: string): Promise<AnalyticsResult> {
  // Values below are inlined as validated literals: a parameterized statement costs an extra describe round trip
  // with prepare: false (pooler mode). owner is a UUID from the verified session; dates come from the DB and are checked.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(owner)) throw new Error("Unauthorized: invalid owner");
  if (!/^[a-z_]+$/.test(SCORE_TYPE)) throw new Error("bad score type");
  const D = /^\d{4}-\d{2}-\d{2}$/;
  const own = `user_id = '${owner}'`;
  // Statement A: bounds, score history, and the direct monthly aggregation of the authoritative table.
  const headSql = `SELECT
      (SELECT to_jsonb(x) FROM (SELECT to_char(min(txn_date),'YYYY-MM-DD') AS s, to_char(max(txn_date),'YYYY-MM-DD') AS e,
        bool_or(is_sample) AS sample, array_remove(array_agg(DISTINCT CASE WHEN currency <> 'USD' THEN currency END), NULL) AS other,
        max(updated_at) AS upd FROM fin.transactions WHERE ${own}) x) AS b,
      COALESCE((SELECT jsonb_agg(jsonb_build_object('id', id::text, 'ps', to_char(period_start,'YYYY-MM-DD'), 'pe', to_char(period_end,'YYYY-MM-DD'),
        'score', score, 'status', status, 'factors', factors, 'metrics', metrics, 'methodology_version', methodology_version,
        'input_fingerprint', input_fingerprint, 'reconstructed', reconstructed, 'calculated_at', calculated_at, 'last_confirmed_at', last_confirmed_at)
        ORDER BY period_start, last_confirmed_at)
        FROM fin.wellness_score_history WHERE ${own} AND score_type = '${SCORE_TYPE}'), '[]') AS history,
      ${rowsJson(`SELECT ${BUCKET_COLS("txn_date", "1 month", "count(*)")} FROM fin.transactions WHERE ${own} AND currency = 'USD' GROUP BY 1`)} AS direct`;
  // Statement B: the owner-scoped continuous aggregate over the data's own bounds, read once and bucketed three ways.
  const aggSql = `WITH d AS MATERIALIZED (
      SELECT * FROM fin.owner_daily_activity(
        (SELECT min(txn_date) FROM fin.transactions WHERE ${own}), (SELECT max(txn_date) FROM fin.transactions WHERE ${own}))
      WHERE currency = 'USD')
    SELECT ${rowsJson(`SELECT ${BUCKET_COLS("day", "1 month", "sum(txn_count)")} FROM d GROUP BY 1`)} AS monthly,
           ${rowsJson(`SELECT ${BUCKET_COLS("day", "1 week", "sum(txn_count)")} FROM d GROUP BY 1`)} AS weekly,
           COALESCE((SELECT jsonb_agg(to_jsonb(q)) FROM (SELECT to_char(time_bucket(INTERVAL '1 month', day),'YYYY-MM-DD') AS b, category, sum(amount_cents) AS cents
             FROM d WHERE txn_type = 'expense' GROUP BY 1, 2) q), '[]') AS cats`;
  // Fallback when the aggregate is unavailable: the same buckets straight from the authoritative table.
  const directSql = `SELECT
      ${rowsJson(`SELECT ${BUCKET_COLS("txn_date", "1 week", "count(*)")} FROM fin.transactions WHERE ${own} AND currency = 'USD' GROUP BY 1`)} AS weekly,
      COALESCE((SELECT jsonb_agg(to_jsonb(q)) FROM (SELECT to_char(time_bucket(INTERVAL '1 month', txn_date),'YYYY-MM-DD') AS b, category, sum(amount_cents) AS cents
        FROM fin.transactions WHERE ${own} AND currency = 'USD' AND txn_type = 'expense' GROUP BY 1, 2) q), '[]') AS cats`;

  let source: AnalyticsResult["source"] = "continuous_aggregate";
  let head: any, agg: any;
  try {
    [head, agg] = await ownerSnapshot(owner, [headSql, aggSql]); // one round trip, one snapshot
  } catch (e) {
    console.error("[analytics] aggregate unavailable, using direct SQL", (e as Error).message);
    source = "direct_sql";
    [head, agg] = await ownerSnapshot(owner, [headSql, directSql]);
  }
  {
    const b = head?.b ?? {};
    const history = mapScoreHistory(head?.history ?? []);
    const generatedAt = new Date().toISOString();
    if (!b?.s) {
      return { empty: true, bounds: null, includesSample: false, excludedCurrencies: [], source: "continuous_aggregate", reconciled: null,
        months: [], weeks: [], comparison: null, weekComparison: null, scoreHistory: { current: [], revisions: history.revisions }, dataUpdatedAt: null, generatedAt };
    }
    const bounds = { start: b.s as string, end: b.e as string };
    if (!D.test(bounds.start) || !D.test(bounds.end)) throw new Error("bad analytics bounds");
    // Periods no longer complete in the dataset (e.g. after removing data) drop out of the main timeline.
    history.current = history.current.filter((r) => r.periodStart >= bounds.start && r.periodEnd <= bounds.end);
    const direct: any[] = head.direct;
    const monthly: any[] = source === "direct_sql" ? direct : agg?.monthly ?? [];
    const weekly: any[] = agg?.weekly ?? [];
    const cats: any[] = agg?.cats ?? [];

    const months = toPeriods(rowsToBuckets(monthly), "month", bounds);
    const weeks = toPeriods(rowsToBuckets(weekly), "week", bounds);
    const key = (r: BucketRow) => `${r.bucket}|${r.income}|${r.spending}|${r.transfers}|${r.txnCount}`;
    const reconciled = source === "continuous_aggregate" ? rowsToBuckets(direct).map(key).join() === rowsToBuckets(monthly).map(key).join() : null;

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
export async function recalculateScores(owner: string): Promise<{ assessed: number }> {
  return withOwner(owner, async (tx) => {
    const rows = await tx<any[]>`SELECT id, to_char(txn_date,'YYYY-MM-DD') AS d, merchant, amount_cents, txn_type, category, category_source,
      description, account_id FROM fin.transactions WHERE user_id = ${owner} AND currency = 'USD'`;
    const txns = rows.map((t) => ({ id: t.id, date: t.d, merchant: t.merchant, amount: Number(t.amount_cents), type: t.txn_type, category: t.category,
      categorySource: t.category_source, description: t.description, accountId: t.account_id })) as Transaction[];
    const now = new Date();
    const assessments = assessAllMonths(txns);
    for (const a of assessments) {
      const fp = await sha256(a.fingerprintInput);
      await tx`INSERT INTO fin.wellness_score_history (user_id, score_type, period_start, period_end, score, status, factors, metrics,
          methodology_version, input_fingerprint, reconstructed)
        VALUES (${owner}, ${SCORE_TYPE}, ${a.periodStart}, ${a.periodEnd}, ${a.score}, ${a.status}, ${tx.json(a.factors as never)},
          ${tx.json(a.metrics as never)}, ${SCORE_METHODOLOGY_VERSION}, ${fp}, ${isReconstructed(a.periodEnd, now)})
        ON CONFLICT (user_id, score_type, period_start, methodology_version, input_fingerprint)
        DO UPDATE SET last_confirmed_at = now()`;
    }
    return { assessed: assessments.length };
  });
}

/** After a successful save: refresh affected aggregate days, then rescore (later months depend on earlier ones). */
export async function afterTransactionsChanged(owner: string, full = false) {
  await refreshOwnerAnalytics(owner, full);
  await recalculateScores(owner);
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

export async function loadDemo(owner: string): Promise<{ inserted: number }> {
  const inserted = await withOwner(owner, async (tx) => {
    const [settings] = await tx<any[]>`SELECT 1 FROM fin.user_settings WHERE user_id = ${owner}`;
    if (!settings) throw new Error("Open the app once so your account is set up before loading the demo.");
    const rows = DEMO_ROWS.map(([day, merchant, dollars, type, category], i) => {
      const id = `demo-${DEMO_MONTH}-${String(i + 1).padStart(2, "0")}`;
      return {
        user_id: owner, id, txn_date: `${DEMO_MONTH}-${String(day).padStart(2, "0")}`, merchant, amount_cents: dollars * 100, txn_type: type,
        category, category_source: "rule", description: "Demonstration data — not personal", account_id: "acct-checking",
        linked_account_id: type === "transfer" ? "acct-savings" : null, source: "demo", external_id: id, is_sample: true,
      };
    });
    const res = await tx`INSERT INTO fin.transactions ${tx(rows)} ON CONFLICT DO NOTHING RETURNING id`;
    return res.length;
  });
  await afterTransactionsChanged(owner);
  return { inserted };
}

export async function resetDemo(owner: string): Promise<{ removed: number }> {
  const removed = await withOwner(owner, async (tx) => (await tx`DELETE FROM fin.transactions WHERE user_id = ${owner} AND source = 'demo' RETURNING id`).length);
  await afterTransactionsChanged(owner);
  return { removed };
}
