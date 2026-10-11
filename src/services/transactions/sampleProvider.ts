import { SAMPLE_TRANSACTIONS, CHECKING, SAVINGS, ROTH } from "@/data/sampleTransactions";
import type { TransactionProvider } from "./types";

export const sampleTransactionProvider: TransactionProvider = {
  id: "sample",
  label: "Sample transactions",
  async fetchTransactions() {
    return {
      status: "ok",
      source: "sample",
      fetchedAt: new Date().toISOString(),
      data: {
        transactions: SAMPLE_TRANSACTIONS,
        accounts: [
          { id: CHECKING, name: "Everyday Checking", kind: "checking" },
          { id: SAVINGS, name: "High-Yield Savings", kind: "savings" },
          { id: ROTH, name: "Roth IRA", kind: "investment" },
        ],
      },
    };
  },
};
