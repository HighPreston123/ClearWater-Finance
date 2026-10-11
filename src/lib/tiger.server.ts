/* eslint-disable @typescript-eslint/no-explicit-any */
import postgres from "postgres";
import type { PersistedState } from "@/services/storage/storageAdapter";
import type { RecurringOverride, Transaction } from "@/types/finance";
import type { Holding, InvestmentAccount } from "@/types/investments";

/**
 * Server-only TigerData access. Every call:
 *  - opens a TLS-required connection (one per request — Worker I/O cannot be shared across requests;
 *    point TIGER_DATABASE_URL at Tiger's connection pooler for pooling),
 *  - runs inside a transaction as least-privilege role fin_app with app.user_id = verified owner,
 *    so Row Level Security enforces ownership in addition to explicit WHERE user_id filters.
 * The owner id must come from the verified session — never from client input.
 */
type Tx = postgres.TransactionSql;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class DatabaseNotConfiguredError extends Error {
  constructor() {
    super("not_configured: TIGER_DATABASE_URL is not set");
  }
}

export async function withOwner<T>(ownerId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  if (!UUID.test(ownerId)) throw new Error("Unauthorized: invalid owner");
  const url = process.env["TIGER_DATABASE_URL"];
  if (!url) throw new DatabaseNotConfiguredError();
  const sql = postgres(url, {
    ssl: "require",
    max: 1,
    prepare: false, // compatible with transaction-mode poolers
    connect_timeout: 10,
    idle_timeout: 5,
    onnotice: () => {},
  });
  try {
    return (await sql.begin(async (tx) => {
      await tx`SET LOCAL ROLE fin_app`;
      await tx`SELECT set_config('app.user_id', ${ownerId}, true)`;
      return fn(tx);
    })) as T;
  } catch (e) {
    // Log without the connection string or row data.
    const err = e as { code?: string; message?: string };
    console.error("[tiger] query failed", err.code ?? "", String(err.message ?? "").replace(/postgres(ql)?:\/\/\S+/g, "[redacted]"));
    throw new Error("Database request failed");
  } finally {
    await sql.end({ timeout: 2 });
  }
}

const n = (v: unknown) => (v === null || v === undefined ? null : Number(v));

export async function readState(tx: Tx, owner: string): Promise<PersistedState | null> {
  const [settings] = await tx<any[]>`SELECT risk_inputs, savings_settings, date_range, transaction_source FROM fin.user_settings WHERE user_id = ${owner}`;
  if (!settings) return null;
  const accts = await tx<any[]>`SELECT * FROM fin.financial_accounts WHERE user_id = ${owner} ORDER BY created_at, id`;
  const holds = await tx<any[]>`SELECT * FROM fin.investment_holdings WHERE user_id = ${owner} ORDER BY id`;
  const txns = await tx<any[]>`SELECT *, to_char(txn_date,'YYYY-MM-DD') AS d FROM fin.transactions WHERE user_id = ${owner} ORDER BY txn_date, id`;
  const ovr = await tx<any[]>`SELECT series_key, detection, review FROM fin.recurring_overrides WHERE user_id = ${owner}`;

  const accounts: InvestmentAccount[] = accts.map((a) => ({
    id: a.id, name: a.name, type: a.account_type, institution: a.institution ?? undefined, currency: "USD",
    cashCents: Number(a.cash_cents), valuationTimestamp: a.valuation_timestamp, source: a.source,
  }));
  const holdings: Holding[] = holds.map((h) => ({
    id: h.id, accountId: h.account_id, symbol: h.symbol, externalSecurityId: h.external_security_id ?? undefined,
    name: h.name, assetClass: h.asset_class, quantity: String(h.quantity),
    latestPrice: h.latest_price === null ? null : String(h.latest_price), priceTimestamp: h.price_timestamp,
    suppliedValueCents: n(h.supplied_value_cents), suppliedValueDate: h.supplied_value_date,
    costBasisCents: n(h.cost_basis_cents), sector: h.sector ?? undefined,
    underlyingExposure: h.underlying_exposure ?? undefined, source: h.source,
  }));
  const transactions: Transaction[] = txns.map((t) => ({
    id: t.id, date: t.d, merchant: t.merchant, amount: Number(t.amount_cents), type: t.txn_type,
    category: t.category, categorySource: t.category_source, description: t.description,
    accountId: t.account_id, ...(t.linked_account_id ? { linkedAccountId: t.linked_account_id } : {}),
  })) as Transaction[];
  const recurringOverrides: Record<string, RecurringOverride> = {};
  for (const o of ovr) {
    recurringOverrides[o.series_key] = {
      ...(o.detection ? { detection: o.detection } : {}),
      ...(o.review ? { review: o.review } : {}),
    } as RecurringOverride;
  }
  return {
    version: 1,
    transactions, recurringOverrides, accounts, holdings,
    manual: settings.risk_inputs, savings: settings.savings_settings,
    range: settings.date_range ?? null, transactionSource: settings.transaction_source,
  };
}

/**
 * Saves the owner's full state atomically. Transactions are diffed (delete removed, upsert new/changed)
 * so triggers mark exactly the affected days for analytics refresh and provenance columns survive.
 * All rows are stamped with the verified owner id.
 */
/** Settings are always sent; data sections are omitted by the client when unchanged since the last successful save. */
export type StatePatch = Omit<PersistedState, "transactions" | "recurringOverrides" | "accounts" | "holdings"> &
  Partial<Pick<PersistedState, "transactions" | "recurringOverrides" | "accounts" | "holdings">>;

export async function writeState(tx: Tx, owner: string, s: StatePatch): Promise<{ transactionsChanged: boolean }> {
  await tx`INSERT INTO fin.user_settings (user_id, risk_inputs, savings_settings, date_range, transaction_source, updated_at)
    VALUES (${owner}, ${tx.json(s.manual as never)}, ${tx.json(s.savings as never)}, ${s.range ? tx.json(s.range as never) : null}, ${s.transactionSource}, now())
    ON CONFLICT (user_id) DO UPDATE SET risk_inputs = EXCLUDED.risk_inputs, savings_settings = EXCLUDED.savings_settings,
      date_range = EXCLUDED.date_range, transaction_source = EXCLUDED.transaction_source, updated_at = now()`;

  // --- Accounts + holdings (sent together): remove missing ids, upsert the rest — no wholesale delete/reinsert ---
  if (s.accounts && s.holdings) {
    const acctIds = s.accounts.map((a) => a.id);
    const holdIds = s.holdings.map((h) => h.id);
    await tx`DELETE FROM fin.investment_holdings WHERE user_id = ${owner} AND NOT (id = ANY(${holdIds}::text[]))`;
    await tx`DELETE FROM fin.financial_accounts WHERE user_id = ${owner} AND NOT (id = ANY(${acctIds}::text[]))`;
    if (s.accounts.length) {
      await tx`INSERT INTO fin.financial_accounts ${tx(s.accounts.map((a) => ({
        user_id: owner, id: a.id, name: a.name, account_type: a.type, institution: a.institution ?? null,
        currency: a.currency, cash_cents: a.cashCents, valuation_timestamp: a.valuationTimestamp, source: a.source,
      })))}
        ON CONFLICT (user_id, id) DO UPDATE SET name = EXCLUDED.name, account_type = EXCLUDED.account_type,
          institution = EXCLUDED.institution, currency = EXCLUDED.currency, cash_cents = EXCLUDED.cash_cents,
          valuation_timestamp = EXCLUDED.valuation_timestamp, source = EXCLUDED.source`;
    }
    if (s.holdings.length) {
      await tx`INSERT INTO fin.investment_holdings ${tx(s.holdings.map((h) => ({
        user_id: owner, id: h.id, account_id: h.accountId, symbol: h.symbol, external_security_id: h.externalSecurityId ?? null,
        name: h.name, asset_class: h.assetClass, quantity: h.quantity, latest_price: h.latestPrice, price_timestamp: h.priceTimestamp,
        supplied_value_cents: h.suppliedValueCents ?? null, supplied_value_date: h.suppliedValueDate ?? null,
        cost_basis_cents: h.costBasisCents ?? null, sector: h.sector ?? null, underlying_exposure: h.underlyingExposure ?? null, source: h.source,
      })))}
        ON CONFLICT (user_id, id) DO UPDATE SET account_id = EXCLUDED.account_id, symbol = EXCLUDED.symbol,
          external_security_id = EXCLUDED.external_security_id, name = EXCLUDED.name, asset_class = EXCLUDED.asset_class,
          quantity = EXCLUDED.quantity, latest_price = EXCLUDED.latest_price, price_timestamp = EXCLUDED.price_timestamp,
          supplied_value_cents = EXCLUDED.supplied_value_cents, supplied_value_date = EXCLUDED.supplied_value_date,
          cost_basis_cents = EXCLUDED.cost_basis_cents, sector = EXCLUDED.sector,
          underlying_exposure = EXCLUDED.underlying_exposure, source = EXCLUDED.source`;
    }
  }

  // --- Recurring overrides: remove missing keys, upsert the rest ---
  if (s.recurringOverrides) {
    const ovr = Object.entries(s.recurringOverrides);
    await tx`DELETE FROM fin.recurring_overrides WHERE user_id = ${owner} AND NOT (series_key = ANY(${ovr.map(([k]) => k)}::text[]))`;
    if (ovr.length) {
      await tx`INSERT INTO fin.recurring_overrides ${tx(ovr.map(([k, o]) => ({
        user_id: owner, series_key: k, detection: o.detection ?? null, review: o.review ?? null,
      })))}
        ON CONFLICT (user_id, series_key) DO UPDATE SET detection = EXCLUDED.detection, review = EXCLUDED.review`;
    }
  }

  if (!s.transactions) return { transactionsChanged: false };
  const transactions = s.transactions;

  // --- Transactions: diff against what is stored ---
  const existing = await tx<any[]>`SELECT id, to_char(txn_date,'YYYY-MM-DD') AS d, merchant, amount_cents, txn_type, category,
    category_source, description, account_id, linked_account_id FROM fin.transactions WHERE user_id = ${owner}`;
  const byId = new Map(existing.map((r) => [r.id as string, r]));
  const incomingIds = new Set(transactions.map((t) => t.id));
  const removed = existing.filter((r) => !incomingIds.has(r.id)).map((r) => r.id as string);
  for (let i = 0; i < removed.length; i += 1000) {
    await tx`DELETE FROM fin.transactions WHERE user_id = ${owner} AND id = ANY(${removed.slice(i, i + 1000)}::text[])`;
  }
  const newSource = s.transactionSource;
  const changed = transactions.filter((t) => {
    const r = byId.get(t.id);
    return !r || r.d !== t.date || r.merchant !== t.merchant || Number(r.amount_cents) !== t.amount || r.txn_type !== t.type ||
      r.category !== t.category || r.category_source !== t.categorySource || r.description !== (t.description ?? "") ||
      r.account_id !== t.accountId || (r.linked_account_id ?? null) !== (t.linkedAccountId ?? null);
  });
  for (let i = 0; i < changed.length; i += 500) {
    const chunk = changed.slice(i, i + 500);
    // source/is_sample only apply to new rows; existing rows keep their provenance (ON CONFLICT doesn't touch them).
    await tx`INSERT INTO fin.transactions ${tx(chunk.map((t) => ({
      user_id: owner, id: t.id, txn_date: t.date, merchant: t.merchant, amount_cents: t.amount, txn_type: t.type,
      category: t.category, category_source: t.categorySource, description: t.description ?? "",
      account_id: t.accountId, linked_account_id: t.linkedAccountId ?? null,
      source: newSource, is_sample: newSource === "sample",
    })))}
      ON CONFLICT (user_id, id) DO UPDATE SET txn_date = EXCLUDED.txn_date, merchant = EXCLUDED.merchant,
        amount_cents = EXCLUDED.amount_cents, txn_type = EXCLUDED.txn_type, category = EXCLUDED.category,
        category_source = EXCLUDED.category_source, description = EXCLUDED.description, account_id = EXCLUDED.account_id,
        linked_account_id = EXCLUDED.linked_account_id, updated_at = now()`;
  }
  const transactionsChanged = removed.length > 0 || changed.length > 0;
  if (transactionsChanged) {
    // Category overrides mirror manual categorizations.
    await tx`DELETE FROM fin.transaction_category_overrides WHERE user_id = ${owner}`;
    const manual = transactions.filter((t) => t.categorySource === "manual");
    for (let i = 0; i < manual.length; i += 1000) {
      await tx`INSERT INTO fin.transaction_category_overrides ${tx(manual.slice(i, i + 1000).map((t) => ({ user_id: owner, txn_id: t.id, category: t.category })))}`;
    }
  }
  return { transactionsChanged };
}

/**
 * Privileged maintenance (runs as the connection role, not fin_app): re-materializes the daily
 * continuous aggregate for the days this owner's changes touched. refresh_continuous_aggregate
 * cannot run inside a transaction, so this runs after the write transaction commits.
 * With `full`, the owner's whole date span is refreshed (the "Refresh analysis" button).
 */
export async function refreshOwnerAnalytics(ownerId: string, full = false): Promise<{ start: string; end: string } | null> {
  if (!UUID.test(ownerId)) throw new Error("Unauthorized: invalid owner");
  const url = process.env["TIGER_DATABASE_URL"];
  if (!url) throw new DatabaseNotConfiguredError();
  const sql = postgres(url, { ssl: "require", max: 1, prepare: false, connect_timeout: 10, idle_timeout: 5, onnotice: () => {} });
  try {
    const [w] = full
      ? await sql<any[]>`SELECT to_char(min(x),'YYYY-MM-DD') AS s, to_char(max(x),'YYYY-MM-DD') AS e FROM (
          SELECT txn_date AS x FROM fin.transactions WHERE user_id = ${ownerId}
          UNION ALL SELECT day FROM fin.analytics_dirty_days WHERE user_id = ${ownerId}) u`
      : await sql<any[]>`SELECT to_char(min(day),'YYYY-MM-DD') AS s, to_char(max(day),'YYYY-MM-DD') AS e FROM fin.analytics_dirty_days WHERE user_id = ${ownerId}`;
    if (!w?.s) return null;
    const D = /^\d{4}-\d{2}-\d{2}$/;
    if (!D.test(w.s) || !D.test(w.e)) throw new Error("bad refresh window");
    // Validated literals: CALL arguments are written inline (values come from the DB, not the client).
    await sql.unsafe(`CALL refresh_continuous_aggregate('fin.daily_activity', '${w.s}'::date::timestamp AT TIME ZONE 'UTC', ('${w.e}'::date + 1)::timestamp AT TIME ZONE 'UTC')`);
    await sql`DELETE FROM fin.analytics_dirty_days WHERE user_id = ${ownerId} AND day BETWEEN ${w.s}::date AND ${w.e}::date`;
    return { start: w.s, end: w.e };
  } catch (e) {
    const err = e as { code?: string; message?: string };
    console.error("[tiger] refresh failed", err.code ?? "", String(err.message ?? "").replace(/postgres(ql)?:\/\/\S+/g, "[redacted]"));
    throw new Error("Analytics refresh failed");
  } finally {
    await sql.end({ timeout: 2 });
  }
}
