import { withOwner, readOwnerState, writeState } from "@/lib/tiger.server";
import { afterTransactionsChanged, getAnalytics } from "@/lib/analytics.server";
import { deleteOwnerTigerData } from "@/lib/account.server";
import { SAMPLE_TRANSACTIONS } from "@/data/sampleTransactions";
import { SAMPLE_ACCOUNTS, SAMPLE_HOLDINGS } from "@/data/samplePortfolio";
const owner = crypto.randomUUID();
const t = async <T>(label: string, f: () => Promise<T>) => { const s = performance.now(); const r = await f(); console.log(label.padEnd(30), Math.round(performance.now() - s), "ms"); return r; };
const base = { version: 1 as const, manual: {}, savings: { subscriptionsPct: 0, diningPct: 0, shoppingPct: 0 }, range: null, transactionSource: "sample" as const };
try {
  const w = await t("full save (txns+holdings)", () => withOwner(owner, (tx) => writeState(tx, owner, { ...base, transactions: SAMPLE_TRANSACTIONS, recurringOverrides: {}, accounts: SAMPLE_ACCOUNTS as never, holdings: SAMPLE_HOLDINGS as never })));
  console.log("  transactionsChanged:", w.transactionsChanged);
  await t("analytics refresh + rescore", () => afterTransactionsChanged(owner));
  const st = await t("load state", () => readOwnerState(owner));
  console.log("  loaded txns/holdings:", st?.transactions.length, st?.holdings.length, "savings", JSON.stringify(st?.savings));
  for (let i = 0; i < 2; i++) { const w2 = await t("settings-only save", () => withOwner(owner, (tx) => writeState(tx, owner, { ...base, savings: { subscriptionsPct: 10 + i, diningPct: 0, shoppingPct: 0 } }))); console.log("  transactionsChanged:", w2.transactionsChanged); }
  for (let i = 0; i < 2; i++) { const a = await t("get analytics", () => getAnalytics(owner)); console.log("  source", a.source, "reconciled", a.reconciled, "months", a.months.length, "scores", a.scoreHistory.current.length); }
  for (let i = 0; i < 2; i++) await t("load state", () => readOwnerState(owner));
} catch (e) { console.log("FAIL", (e as Error).message); }
finally { await deleteOwnerTigerData(owner).then(() => console.log("cleanup ok"), (e) => console.log("cleanup FAIL", e.message)); }
