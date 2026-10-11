import type { Transaction } from "@/types/finance";

/**
 * Server-only Nessie (Capital One hackathon API) client.
 * The NESSI API key is read from process.env inside each function — never at
 * module scope and never exposed to the browser. Nessie is a background
 * banking-data layer only: it does NOT create or manage the app's customers.
 * All failures return a typed error result; callers must never fabricate data.
 */

const BASE = "https://api.nessieisreal.com";

export class NessieNotConfiguredError extends Error {
  constructor() {
    super("not_configured: NESSI API key is not set");
  }
}

function key(): string {
  const k = process.env["NESSI"];
  if (!k) throw new NessieNotConfiguredError();
  return k;
}

async function nessieGet<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}${path.includes("?") ? "&" : "?"}key=${encodeURIComponent(key())}`);
  if (!res.ok) throw new Error(`Nessie request failed (${res.status})`);
  return (await res.json()) as T;
}

// --- Nessie API shapes (subset) ---
interface NessieCustomer {
  _id: string;
  first_name: string;
  last_name: string;
}
interface NessieAccount {
  _id: string;
  type: string; // "Checking" | "Savings" | "Credit Card"
  nickname: string;
  balance: number; // dollars
  customer_id: string;
}
interface NessiePurchase {
  _id: string;
  purchase_date?: string;
  description?: string;
  amount: number;
  payee_id?: string;
}
interface NessieDeposit {
  _id: string;
  transaction_date?: string;
  description?: string;
  amount: number;
}
interface NessieWithdrawal {
  _id: string;
  transaction_date?: string;
  description?: string;
  amount: number;
}
interface NessieTransfer {
  _id: string;
  transaction_date?: string;
  description?: string;
  amount: number;
}
interface NessieBill {
  _id: string;
  payment_date?: string;
  payee?: string;
  payment_amount?: number;
  status?: string;
}
interface NessieLoan {
  _id: string;
  type?: string;
  amount?: number;
  monthly_payment?: number;
  status?: string;
  description?: string;
}

export interface NessieBankAccount {
  id: string;
  name: string;
  kind: "checking" | "savings" | "credit" | "investment" | "other";
  balanceCents: number;
}

export interface NessieBankTransaction {
  id: string;
  date: string; // YYYY-MM-DD
  merchant: string;
  amountCents: number; // signed: spending negative, income positive
  type: "income" | "expense";
  category: Transaction["category"];
  description: string;
  accountId: string;
  kind: "purchase" | "deposit" | "withdrawal" | "transfer" | "bill" | "loan";
}

export interface NessieOverview {
  customerRef: { id: string; name: string }; // background reference only, not an app customer
  accounts: NessieBankAccount[];
  transactions: NessieBankTransaction[];
  loans: { id: string; type: string; amountCents: number; monthlyPaymentCents: number; status: string }[];
}

const toCents = (dollars: number) => Math.round(dollars * 100);
const dateOr = (d: string | undefined, fallback: string) => (d && /^\d{4}-\d{2}-\d{2}/.test(d) ? d.slice(0, 10) : fallback);

function mapKind(t: string): NessieBankAccount["kind"] {
  const s = t.toLowerCase();
  if (s.includes("checking")) return "checking";
  if (s.includes("saving")) return "savings";
  if (s.includes("credit")) return "credit";
  return "other";
}

/**
 * Fetches the full banking picture available under the configured Nessie key:
 * the first Nessie customer (background reference), their accounts, and all
 * purchases/deposits/withdrawals/transfers/bills/loans per account.
 */
export async function fetchNessieOverview(): Promise<NessieOverview> {
  const customers = await nessieGet<NessieCustomer[]>("/customers");
  const customer = customers[0];
  if (!customer) throw new Error("Nessie returned no customers for this key");

  const accounts = await nessieGet<NessieAccount[]>(`/customers/${customer._id}/accounts`);
  const today = new Date().toISOString().slice(0, 10);

  const transactions: NessieBankTransaction[] = [];
  const loans: NessieOverview["loans"] = [];

  for (const a of accounts) {
    const [purchases, deposits, withdrawals, transfers, bills, accountLoans] = await Promise.all([
      nessieGet<NessiePurchase[]>(`/accounts/${a._id}/purchases`).catch(() => [] as NessiePurchase[]),
      nessieGet<NessieDeposit[]>(`/accounts/${a._id}/deposits`).catch(() => [] as NessieDeposit[]),
      nessieGet<NessieWithdrawal[]>(`/accounts/${a._id}/withdrawals`).catch(() => [] as NessieWithdrawal[]),
      nessieGet<NessieTransfer[]>(`/accounts/${a._id}/transfers`).catch(() => [] as NessieTransfer[]),
      nessieGet<NessieBill[]>(`/accounts/${a._id}/bills`).catch(() => [] as NessieBill[]),
      nessieGet<NessieLoan[]>(`/accounts/${a._id}/loans`).catch(() => [] as NessieLoan[]),
    ]);

    for (const p of purchases) {
      transactions.push({
        id: `nessie-p-${p._id}`, date: dateOr(p.purchase_date, today),
        merchant: p.description || "Purchase", amountCents: -toCents(p.amount),
        type: "expense", category: "Other", description: p.description ?? "", accountId: a._id, kind: "purchase",
      });
    }
    for (const d of deposits) {
      transactions.push({
        id: `nessie-d-${d._id}`, date: dateOr(d.transaction_date, today),
        merchant: d.description || "Deposit", amountCents: toCents(d.amount),
        type: "income", category: "Income", description: d.description ?? "", accountId: a._id, kind: "deposit",
      });
    }
    for (const w of withdrawals) {
      transactions.push({
        id: `nessie-w-${w._id}`, date: dateOr(w.transaction_date, today),
        merchant: w.description || "Withdrawal", amountCents: -toCents(w.amount),
        type: "expense", category: "Other", description: w.description ?? "", accountId: a._id, kind: "withdrawal",
      });
    }
    for (const t of transfers) {
      transactions.push({
        id: `nessie-t-${t._id}`, date: dateOr(t.transaction_date, today),
        merchant: t.description || "Transfer", amountCents: -toCents(t.amount),
        type: "expense", category: "Other", description: t.description ?? "", accountId: a._id, kind: "transfer",
      });
    }
    for (const b of bills) {
      transactions.push({
        id: `nessie-b-${b._id}`, date: dateOr(b.payment_date, today),
        merchant: b.payee || "Bill", amountCents: -toCents(b.payment_amount ?? 0),
        type: "expense", category: "Utilities", description: b.status ?? "", accountId: a._id, kind: "bill",
      });
    }
    for (const l of accountLoans) {
      loans.push({
        id: l._id, type: l.type ?? "loan",
        amountCents: toCents(l.amount ?? 0), monthlyPaymentCents: toCents(l.monthly_payment ?? 0),
        status: l.status ?? "unknown",
      });
    }
  }

  return {
    customerRef: { id: customer._id, name: `${customer.first_name} ${customer.last_name}`.trim() },
    accounts: accounts.map((a) => ({
      id: a._id, name: a.nickname || a.type, kind: mapKind(a.type), balanceCents: toCents(a.balance),
    })),
    transactions: transactions.sort((x, y) => x.date.localeCompare(y.date)),
    loans,
  };
}

/**
 * Advisor-style profiles derived from Nessie customers beyond the primary one.
 * Nessie has no advisor concept; these are real records under the user's key,
 * mapped to AdvisorProfile with source "nessie". Not verified professionals.
 */
export interface NessieAdvisorRecord {
  id: string;
  name: string;
}

export async function fetchNessieAdvisorRecords(): Promise<NessieAdvisorRecord[]> {
  const customers = await nessieGet<NessieCustomer[]>("/customers");
  // Skip the first customer — that's the primary banking customer.
  return customers.slice(1).map((c) => ({
    id: c._id,
    name: `${c.first_name} ${c.last_name}`.trim(),
  }));
}

/** Lightweight probe: is the key set and does the API answer? */
export async function probeNessie(): Promise<{ configured: boolean; reachable: boolean }> {
  try {
    key();
  } catch {
    return { configured: false, reachable: false };
  }
  try {
    await nessieGet<NessieCustomer[]>("/customers");
    return { configured: true, reachable: true };
  } catch {
    return { configured: true, reachable: false };
  }
}
