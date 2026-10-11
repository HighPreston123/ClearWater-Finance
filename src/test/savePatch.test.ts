import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/state.functions", () => ({ loadUserState: vi.fn(), saveUserState: vi.fn() }));
import { buildSavePatch } from "@/services/storage/cloudStorageAdapter";
import type { PersistedState } from "@/services/storage/storageAdapter";

const base: PersistedState = {
  version: 1, transactions: [], recurringOverrides: {}, accounts: [], holdings: [],
  manual: {} as PersistedState["manual"], savings: { subscriptionsPct: 1, diningPct: 2, shoppingPct: 3 },
  range: null, transactionSource: "csv",
};

describe("buildSavePatch", () => {
  it("sends everything on first save", () => {
    expect(buildSavePatch(base, null)).toBe(base);
  });
  it("omits unchanged data sections for settings-only edits", () => {
    const next = { ...base, savings: { ...base.savings, diningPct: 9 } };
    const p = buildSavePatch(next, base) as Record<string, unknown>;
    expect(p["savings"]).toEqual(next.savings);
    expect("transactions" in p || "accounts" in p || "holdings" in p || "recurringOverrides" in p).toBe(false);
  });
  it("sends accounts and holdings together when either changes", () => {
    const next = { ...base, holdings: [] as PersistedState["holdings"] };
    const p = buildSavePatch(next, base) as Record<string, unknown>;
    expect("accounts" in p && "holdings" in p).toBe(true);
    expect("transactions" in p).toBe(false);
  });
});
