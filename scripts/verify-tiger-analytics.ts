// End-to-end verification against TigerData using two throwaway users. Usage: bun scripts/verify-tiger-analytics.ts
import postgres from "postgres";
import { withOwner, writeState, refreshOwnerAnalytics } from "@/lib/tiger.server";
import { getAnalytics, recalculateScores, afterTransactionsChanged, loadDemo, resetDemo } from "@/lib/analytics.server";
import { SAMPLE_TRANSACTIONS } from "@/data/sampleTransactions";
import { EMPTY_MANUAL_INPUTS } from "@/lib/risk/buildFinancialSnapshot";
import { summarize } from "@/lib/finance/metrics";
import type { PersistedState } from "@/services/storage/storageAdapter";

const A = crypto.randomUUID(), B = crypto.randomUUID();
let fails = 0;
const ok = (name: string, cond: boolean, extra = "") => { console.log(`${cond ? "PASS" : "FAIL"} ${name} ${extra}`); if (!cond) fails++; };
const state = (txns = SAMPLE_TRANSACTIONS): PersistedState => ({ version: 1, transactions: txns, recurringOverrides: {}, accounts: [], holdings: [],
  manual: EMPTY_MANUAL_INPUTS, savings: { subscriptionsPct: 25, diningPct: 20, shoppingPct: 15 }, range: null, transactionSource: "sample" });
const save = async (o: string, s: PersistedState) => { await withOwner(o, (tx) => writeState(tx, o, s)); await afterTransactionsChanged(o); };

const admin = postgres(process.env.TIGER_DATABASE_URL!, { ssl: "require", max: 1, onnotice: () => {} });
try {
  await save(A, state());
  let a = await getAnalytics(A);
  ok("aggregate source used", a.source === "continuous_aggregate");
  ok("aggregate reconciles with source transactions", a.reconciled === true);
  const jul = a.months.find((m) => m.bucket === "2026-07-01")!;
  const local = summarize(SAMPLE_TRANSACTIONS.filter((t) => t.date.startsWith("2026-07")));
  ok("July income/spending equal app formula (transfers excluded)", jul.income === local.income && jul.spending === local.spending, `${jul.income}/${jul.spending}`);
  ok("transfers tracked separately", jul.transfers === local.savingsTransfers + local.investmentContributions + local.otherTransfers);
  ok("October flagged partial", a.months.find((m) => m.bucket === "2026-10-01")?.complete === false);
  ok("statements produced", (a.comparison?.statements.length ?? 0) > 0, JSON.stringify(a.comparison?.statements.slice(0, 2)));

  // Category edit
  const t0 = SAMPLE_TRANSACTIONS.find((t) => t.type === "expense" && t.date.startsWith("2026-09"))!;
  let txns = SAMPLE_TRANSACTIONS.map((t) => (t.id === t0.id ? { ...t, category: "Entertainment" as const, categorySource: "manual" as const } : t));
  await save(A, state(txns));
  a = await getAnalytics(A);
  ok("category edit reconciles", a.reconciled === true);
  // Date change into an older (already materialized) month
  txns = txns.map((t) => (t.id === t0.id ? { ...t, date: "2026-07-15" } : t));
  await save(A, state(txns));
  a = await getAnalytics(A);
  const jul2 = a.months.find((m) => m.bucket === "2026-07-01")!;
  ok("date change refreshes old and new months", a.reconciled === true && jul2.spending === jul.spending + t0.amount);
  // Deletion
  txns = txns.filter((t) => t.id !== t0.id);
  await save(A, state(txns));
  a = await getAnalytics(A);
  ok("deletion reconciles", a.reconciled === true && a.months.find((m) => m.bucket === "2026-07-01")!.spending === jul.spending);

  // Score dedupe
  const count = async () => Number((await admin`SELECT count(*) FROM fin.wellness_score_history WHERE user_id = ${A}`)[0]!.count);
  const c1 = await count(); await recalculateScores(A); await recalculateScores(A);
  ok("rescoring same data creates no duplicates", (await count()) === c1, `rows=${c1}`);
  ok("one current assessment per period", new Set(a.scoreHistory.current.map((r) => r.periodStart)).size === a.scoreHistory.current.length);
  ok("reconstructed label: Jul/Aug yes, Sep (scored within the following month) no", a.scoreHistory.current.every((r) => r.reconstructed === (r.periodStart < "2026-09-01")));

  // Historical demo import
  const julyBefore = a.scoreHistory.current.find((r) => r.periodStart === "2026-07-01");
  const d1 = await loadDemo(A), d2 = await loadDemo(A);
  ok("demo import idempotent", d1.inserted === 18 && d2.inserted === 0, `${d1.inserted}/${d2.inserted}`);
  a = await getAnalytics(A);
  ok("historical import refreshed June", a.reconciled === true && a.months[0]!.bucket === "2026-06-01" && a.months[0]!.complete);
  const julyAfter = a.scoreHistory.current.find((r) => r.periodStart === "2026-07-01");
  ok("later month rescored as new revision", julyAfter?.id !== julyBefore?.id, `${julyBefore?.score} -> ${julyAfter?.score}`);
  const rr = await resetDemo(A);
  a = await getAnalytics(A);
  ok("demo reset removes only demo rows", rr.removed === 18 && a.reconciled === true && a.months[0]!.bucket === "2026-07-01");
  ok("after reset, July current revision reverts", a.scoreHistory.current.find((r) => r.periodStart === "2026-07-01")?.id === julyBefore?.id);

  // Zero baseline: B has no Dining in month 1, some in month 2
  const mk = (id: string, date: string, amount: number, type: "income" | "expense", category: string) =>
    ({ id, date, merchant: "x", amount, type, category, categorySource: "rule", description: "", accountId: "c" }) as never;
  await save(B, { ...state([mk("b1", "2026-01-01", 100000, "income", "Income"), mk("b2", "2026-02-01", 100000, "income", "Income"), mk("b3", "2026-02-10", 6000, "expense", "Dining"), mk("b4", "2026-03-01", 1, "expense", "Other")]), transactionSource: "csv" });
  const b = await getAnalytics(B);
  const dining = b.comparison?.categories.find((c) => c.category === "Dining");
  ok("zero baseline gives $ change without %", dining?.change.pct === null && dining.change.delta === 6000, JSON.stringify(b.comparison?.statements));
  ok("B is not sample", b.includesSample === false);

  // Isolation
  ok("B sees none of A's months", !b.months.some((m) => m.bucket === "2026-07-01"));
  const leak = await withOwner(B, async (tx) => ({
    txns: (await tx`SELECT count(*) FROM fin.transactions WHERE user_id = ${A}`)[0]!.count,
    agg: (await tx`SELECT count(*) FROM fin.owner_daily_activity('2000-01-01','2100-01-01') WHERE true`)[0]!.count,
    scores: (await tx`SELECT count(*) FROM fin.wellness_score_history WHERE user_id = ${A}`)[0]!.count,
    profiles: (await tx`SELECT count(*) FROM fin.user_profiles`)[0]!.count,
  }));
  ok("RLS hides A's rows from B", Number(leak.txns) === 0 && Number(leak.scores) === 0 && Number(leak.profiles) === 0, JSON.stringify(leak));
  const direct = await withOwner(B, (tx) => tx`SELECT 1 FROM fin.daily_activity LIMIT 1`).then(() => "allowed", () => "denied");
  ok("fin_app cannot read aggregate directly", direct === "denied");
  await refreshOwnerAnalytics(A, true);
} finally {
  for (const u of [A, B]) {
    await admin`DELETE FROM fin.wellness_score_history WHERE user_id = ${u}`;
    await admin`DELETE FROM fin.transactions WHERE user_id = ${u}`;
    await admin`DELETE FROM fin.user_settings WHERE user_id = ${u}`;
    await admin`DELETE FROM fin.analytics_dirty_days WHERE user_id = ${u}`;
  }
  await admin`CALL refresh_continuous_aggregate('fin.daily_activity', NULL, NULL)`;
  await admin.end();
  console.log(fails ? `${fails} FAILED` : "ALL PASSED");
  process.exit(fails ? 1 : 0);
}
