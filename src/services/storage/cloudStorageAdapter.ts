import { loadUserState, saveUserState } from "@/lib/state.functions";
import type { PersistedState, RemoteStorageAdapter } from "./storageAdapter";

/** Builds the save payload: settings always, data sections only when changed since `previous`. */
export function buildSavePatch(state: PersistedState, previous?: PersistedState | null) {
  const { transactions, recurringOverrides, accounts, holdings, ...settings } = state;
  if (!previous) return state;
  return {
    ...settings,
    ...(transactions !== previous.transactions ? { transactions } : {}),
    ...(recurringOverrides !== previous.recurringOverrides ? { recurringOverrides } : {}),
    ...(accounts !== previous.accounts || holdings !== previous.holdings ? { accounts, holdings } : {}),
  };
}

export const cloudStorageAdapter: RemoteStorageAdapter = {
  async load() {
    const remote = await loadUserState();
    return remote ? (remote.data as PersistedState) : null;
  },
  async save(state, previous) {
    const r = await saveUserState({ data: buildSavePatch(state, previous) as PersistedState });
    return { analytics: r.analytics };
  },
};
