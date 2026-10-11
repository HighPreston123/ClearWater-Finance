/* eslint-disable @typescript-eslint/no-explicit-any */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { PersistedState } from "@/services/storage/storageAdapter";
import type { RecurringOverride, Transaction } from "@/types/finance";
import type { Holding, InvestmentAccount } from "@/types/investments";

/**
 * Server-only access to Clearwater's financial data in the app database (public.fin_* tables).
 * Owner-scoped work always uses the CALLER's client (context.supabase from requireSupabaseAuth),
 * so Row Level Security (user_id = auth.uid()) enforces ownership on every query.
 * The service-role client (adminDb) is used only for shared caches and server-recorded fields,
 * after the caller has been verified. It never reaches the browser.
 */
export type Db = SupabaseClient<Database>;

/** Unwraps a Supabase result; logs the code (never row data) and throws a generic error. */
export function check<T>(r: { data: T; error: { code?: string; message?: string } | null }, what: string): T {
  if (r.error) {
    console.error("[db]", what, r.error.code ?? "", r.error.message ?? "");
    throw new Error("Database request failed");
  }
  return r.data;
}

export async function adminDb(): Promise<Db> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as Db;
}

/** Reads every row of a query, 1000 at a time (the API caps each response). */
export async function selectAll<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: any }>, what: string): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const rows = check(await page(from, from + 999), what) ?? [];
    out.push(...rows);
    if (rows.length < 1000) return out;
  }
}

const n = (v: unknown) => (v === null || v === undefined ? null : Number(v));

/** Sign-in bootstrap: saved state AND onboarding quiz status in one request (one consistent snapshot). */
export async function readOwnerSession(db: Db): Promise<{ state: PersistedState | null; quiz: any | null }> {
  const row = check(await db.rpc("fin_read_session"), "read_session") as any;
  return { state: mapState(row), quiz: row?.quiz ?? null };
}

export async function readOwnerState(db: Db): Promise<PersistedState | null> {
  return (await readOwnerSession(db)).state;
}

function mapState(row: any): PersistedState | null {
  const settings = row?.settings;
  if (!settings) return null;
  const accts: any[] = row.accts ?? [];
  const holds: any[] = row.holds ?? [];
  const txns: any[] = row.txns ?? [];
  const ovr: any[] = row.ovr ?? [];

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

/** Settings are always sent; data sections are omitted by the client when unchanged since the last successful save. */
export type StatePatch = Omit<PersistedState, "transactions" | "recurringOverrides" | "accounts" | "holdings"> &
  Partial<Pick<PersistedState, "transactions" | "recurringOverrides" | "accounts" | "holdings">>;

/**
 * Saves the owner's state atomically in one database transaction (fin_save_state): settings upserted,
 * accounts/holdings/overrides diffed, transactions diffed (removed rows deleted, only new/changed rows written).
 */
export async function writeState(db: Db, s: StatePatch): Promise<{ transactionsChanged: boolean }> {
  const r = check(await db.rpc("fin_save_state", { p: s as any }), "save_state") as any;
  return { transactionsChanged: Boolean(r?.transactionsChanged) };
}
