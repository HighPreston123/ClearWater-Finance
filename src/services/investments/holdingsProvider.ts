import type { Holding, InvestmentAccount } from "@/types/investments";
import { notConfigured, type ServiceResult } from "@/services/types";

/** Body of future POST /api/holdings/import — supports multiple accounts + holdings. */
export interface HoldingsImportRequest {
  accounts: Omit<InvestmentAccount, "source">[];
  holdings: Omit<Holding, "source">[];
}
export interface HoldingsImportResponse {
  accounts: InvestmentAccount[];
  holdings: Holding[];
  rejected: { index: number; reason: string }[];
}
export interface HoldingsProvider {
  importHoldings(req: HoldingsImportRequest): Promise<ServiceResult<HoldingsImportResponse>>;
}

export const holdingsProvider: HoldingsProvider = {
  async importHoldings() {
    return notConfigured("Holdings import");
  },
};
