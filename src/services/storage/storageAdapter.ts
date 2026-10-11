import type { RecurringOverride, SavingsScenarioSettings, Transaction, DateRange } from "@/types/finance";
import type { Holding, InvestmentAccount } from "@/types/investments";
import type { ManualFinancialInputs } from "@/types/risk";

export const STORAGE_VERSION = 1;
export const STORAGE_KEY = `financial-wellness:state:v${STORAGE_VERSION}`;

export interface PersistedState {
  version: typeof STORAGE_VERSION;
  transactions: Transaction[];
  recurringOverrides: Record<string, RecurringOverride>;
  accounts: InvestmentAccount[];
  holdings: Holding[];
  manual: ManualFinancialInputs;
  savings: SavingsScenarioSettings;
  range: DateRange | null;
  transactionSource: "sample" | "nessie" | "csv";
}

/** Replace this with a server-backed adapter later; the store only depends on this interface. */
export interface StorageAdapter {
  load(): PersistedState | null;
  save(state: PersistedState): void;
  clear(): void;
}

export const localStorageAdapter: StorageAdapter = {
  load() {
    if (typeof window === "undefined") return null;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed?.version === STORAGE_VERSION ? (parsed as PersistedState) : null;
    } catch {
      return null;
    }
  },
  save(state) {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* quota or privacy mode — ignore */
    }
  },
  clear() {
    if (typeof window !== "undefined") window.localStorage.removeItem(STORAGE_KEY);
  },
};

/** Server-backed (TigerData) adapter. Async; the owner is derived from the verified session on the server. */
export interface RemoteStorageAdapter {
  load(): Promise<PersistedState | null>;
  save(state: PersistedState): Promise<void>;
}
