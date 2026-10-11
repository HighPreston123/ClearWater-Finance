import { loadUserState, saveUserState } from "@/lib/state.functions";
import type { PersistedState, RemoteStorageAdapter } from "./storageAdapter";

export const cloudStorageAdapter: RemoteStorageAdapter = {
  async load() {
    const remote = await loadUserState();
    return remote ? (remote.data as PersistedState) : null;
  },
  async save(state) {
    await saveUserState({ data: state });
  },
};
