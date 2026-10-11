import type { DateRange, Transaction } from "@/types/finance";
import type { ServiceResult } from "@/services/types";

export interface TransactionsRequest {
  range?: DateRange;
}
/** Response of future GET /api/transactions */
export interface TransactionsResponse {
  transactions: Transaction[];
  accounts: { id: string; name: string; kind: "checking" | "savings" | "credit" | "investment" | "other" }[];
}
export interface TransactionProvider {
  id: "sample" | "nessie";
  label: string;
  fetchTransactions(req: TransactionsRequest): Promise<ServiceResult<TransactionsResponse>>;
}
