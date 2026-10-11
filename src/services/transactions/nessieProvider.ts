import type { ServiceResult } from "@/services/types";
import type { Transaction } from "@/types/finance";
import { getNessieOverview } from "@/lib/nessie.functions";
import type { TransactionProvider, TransactionsResponse } from "./types";

/**
 * Nessie provider: fetches the background banking layer through an
 * authenticated server function (the API key stays server-side). Nessie data
 * is reference banking data associated with the app's existing customers —
 * it never creates or manages customers. A failure returns an error result
 * and must NOT silently fall back to sample data.
 */
export const nessieTransactionProvider: TransactionProvider = {
  id: "nessie",
  label: "Nessie",
  async fetchTransactions(): Promise<ServiceResult<TransactionsResponse>> {
    const res = await getNessieOverview();
    if (res.status !== "ok") return res;
    // categorySource "rule": categories come from Nessie's mapping rules, not manual edits.
    const transactions: Transaction[] = res.data.transactions.map((t) => ({
      id: t.id,
      date: t.date,
      merchant: t.merchant,
      amount: t.amountCents,
      type: t.type,
      category: t.category,
      categorySource: "rule",
      description: t.description,
      accountId: t.accountId,
    }));
    return {
      status: "ok",
      source: res.source,
      fetchedAt: res.fetchedAt,
      data: {
        transactions,
        accounts: res.data.accounts.map((a) => ({ id: a.id, name: a.name, kind: a.kind })),
      },
    };
  },
};
