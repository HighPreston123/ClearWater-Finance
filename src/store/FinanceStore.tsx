import type React from "react";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { cloudStorageAdapter } from "@/services/storage/cloudStorageAdapter";
import { recordLogin } from "@/lib/state.functions";
import type { Category, DateRange, RecurringOverride, SavingsScenarioSettings, Transaction } from "@/types/finance";
import type { Holding, InvestmentAccount } from "@/types/investments";
import type { ManualFinancialInputs } from "@/types/risk";
import { localStorageAdapter, STORAGE_VERSION, type PersistedState } from "@/services/storage/storageAdapter";
import { EMPTY_MANUAL_INPUTS } from "@/lib/risk/buildFinancialSnapshot";
import { setCategory as applyCategory } from "@/lib/finance/categorization";
import { datasetBounds, datasetCompleteMonths, monthRange } from "@/lib/finance/dates";

const DEFAULT_SAVINGS: SavingsScenarioSettings = { subscriptionsPct: 25, diningPct: 20, shoppingPct: 15 };

export function defaultRange(txns: Transaction[]): DateRange {
  const months = datasetCompleteMonths(txns);
  if (months.length) return monthRange(months[months.length - 1]!);
  // Partial datasets (e.g. a month imported mid-way) still deserve their own bounds.
  return datasetBounds(txns) ?? { start: "2000-01-01", end: "2100-12-31" };
}

function initialState(): PersistedState {
  return emptyState();
}

/**
 * The built-in demo dataset was removed. Saved states still on the "sample" source
 * never imported anything, so they become a blank slate; demo holdings/accounts are
 * dropped everywhere. Imported (csv/nessie) data is kept as-is.
 */
function stripDemo(s: PersistedState): PersistedState {
  const accounts = s.accounts.filter((a) => a.source !== "sample");
  const holdings = s.holdings.filter((h) => h.source !== "sample" && accounts.some((a) => a.id === h.accountId));
  if (s.transactionSource === "sample") {
    return { ...s, transactions: [], recurringOverrides: {}, accounts, holdings, range: null, transactionSource: "csv" };
  }
  return { ...s, accounts, holdings };
}

/** Blank slate for brand-new accounts: no demo transactions or portfolio. */
function emptyState(): PersistedState {
  return {
    version: STORAGE_VERSION,
    transactions: [],
    recurringOverrides: {},
    accounts: [],
    holdings: [],
    manual: EMPTY_MANUAL_INPUTS,
    savings: DEFAULT_SAVINGS,
    range: null,
    transactionSource: "csv",
  };
}

interface UndoEntry {
  label: string;
  transactions: Transaction[];
}

export type SyncStatus = "idle" | "loading" | "synced" | "saving" | "load_error" | "save_error";

interface Store extends PersistedState {
  range: DateRange;
  hydrated: boolean;
  /** Cloud (TigerData) sync state. On load_error, saving is paused so stale/sample data never overwrites saved data. */
  syncStatus: SyncStatus;
  syncError: string | null;
  retrySync(): void;
  setRange(r: DateRange): void;
  recategorize(ids: string[], category: Category, label?: string): void;
  undo(): void;
  undoLabel: string | null;
  setRecurringOverride(key: string, o: RecurringOverride): void;
  updateAccount(id: string, patch: Partial<InvestmentAccount>): void;
  updateHolding(id: string, patch: Partial<Holding>): void;
  /** Applies market prices to owned holdings by symbol; never adds holdings or sets zero prices. */
  updateHoldingPrices(prices: Record<string, { price: string; ts: string }>): void;
  updateManual(patch: Partial<ManualFinancialInputs>): void;
  setSavings(s: SavingsScenarioSettings): void;
  setTransactionSource(s: "sample" | "nessie" | "csv"): void;
  /** Replaces the whole transaction set (undoable) and marks CSV as the active source. */
  importTransactions(txns: Transaction[]): void;
  /** Adds one manually entered transaction (undoable). */
  addTransaction(txn: Transaction): void;
  /** Replaces the whole investment account/holding set (separate from bank transactions). */
  importHoldings(accounts: InvestmentAccount[], holdings: Holding[]): void;
  resetDemo(): void;
}

// Keep one context identity across hot reloads; otherwise a re-evaluated module creates a new
// context that the already-mounted provider doesn't supply, and consumers throw.
const g = globalThis as unknown as { __financeCtx?: React.Context<Store | null> };
const Ctx = (g.__financeCtx ??= createContext<Store | null>(null));

function isPersisted(v: unknown): v is PersistedState {
  return Boolean(v) && typeof v === "object" && (v as PersistedState).version === STORAGE_VERSION;
}

export function FinanceProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PersistedState>(initialState);
  const [hydrated, setHydrated] = useState(false);
  const [undoStack, setUndoStack] = useState<UndoEntry[]>([]);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
  const [syncError, setSyncError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const skipSave = useRef(true);
  const authedRef = useRef(false);
  const stateRef = useRef(state);
  stateRef.current = state;
  const undoRef = useRef(undoStack);
  undoRef.current = undoStack;
  /** Last state confirmed saved in the cloud — unchanged sections (by reference) are omitted from saves. */
  const lastSavedRef = useRef<PersistedState | null>(null);
  /** Bumped on sign-out / account change so late save responses from a previous session are ignored. */
  const sessionGenRef = useRef(0);
  const userIdRef = useRef<string | null>(null);
  const savingRef = useRef(false);
  const router = useRouter();
  const queryClient = useQueryClient();

  useEffect(() => {
    const saved = localStorageAdapter.load();
    if (saved) setState(stripDemo(saved));
    setHydrated(true);
  }, []);

  /** Pull the account's saved state, or push this browser's data on first sign-in. */
  const syncFromCloud = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) return;
    const uid = data.session.user.id;
    if (userIdRef.current !== uid) {
      // Different account in this tab: drop anything cached for the previous one.
      if (userIdRef.current) {
        sessionGenRef.current++;
        clearOnboardingStateCache();
        queryClient.clear();
      }
      userIdRef.current = uid;
      setUserId(uid);
    }
    authedRef.current = false; // no cloud saves until the saved state has loaded
    lastSavedRef.current = null;
    setSyncStatus("loading");
    setSyncError(null);
    try {
      const remote = await Promise.race([
        cloudStorageAdapter.load(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Loading your saved data timed out. Please retry.")), 20000),
        ),
      ]);
      if (remote && isPersisted(remote)) {
        const clean = stripDemo(remote);
        const changed = clean !== remote && JSON.stringify(clean) !== JSON.stringify(remote);
        skipSave.current = !changed; // persist the cleanup so demo data doesn't come back
        // When cleanup changed data, compare against the stored version so the cleaned sections are sent.
        lastSavedRef.current = changed ? remote : clean;
        setState(clean);
        localStorageAdapter.save(clean);
      } else if (!remote) {
        // Brand-new account: start from a blank slate, not this browser's demo data.
        const blank = emptyState();
        skipSave.current = true;
        setState(blank);
        await cloudStorageAdapter.save(blank, null);
        lastSavedRef.current = blank;
      }
      authedRef.current = true;
      setSyncStatus("synced");
    } catch (err) {
      console.error("Cloud sync failed", err);
      setSyncStatus("load_error");
      setSyncError(err instanceof Error ? err.message : "Could not load your saved data");
    }
  }, [queryClient]);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "INITIAL_SESSION") return;
      if (event === "SIGNED_OUT") {
        authedRef.current = false;
        sessionGenRef.current++;
        lastSavedRef.current = null;
        userIdRef.current = null;
        setUserId(null);
        clearOnboardingStateCache();
        setSyncStatus("idle");
        localStorageAdapter.clear();
        void queryClient.cancelQueries();
        queryClient.clear();
        skipSave.current = true;
        setState(initialState());
        router.invalidate(); // the auth gate redirects to /auth
      } else {
        // Defer: calling auth/server functions inside this callback deadlocks the auth lock.
        setTimeout(() => {
          // Only an actual sign-in counts as a login (not page reloads / session restore).
          if (event === "SIGNED_IN") recordLogin().catch((err) => console.error("Login record failed", err));
          void syncFromCloud();
        }, 0);
      }
    });
    return () => data.subscription.unsubscribe();
  }, [syncFromCloud, queryClient, router]);

  /**
   * Serialized cloud save: one request at a time; edits made while a save is in flight are
   * coalesced into one follow-up save of the newest state, so an older request can never
   * overwrite newer changes.
   */
  const flushCloud = useCallback(async () => {
    if (savingRef.current || !authedRef.current) return;
    savingRef.current = true;
    const gen = sessionGenRef.current;
    try {
      while (authedRef.current && gen === sessionGenRef.current && stateRef.current !== lastSavedRef.current) {
        const target = stateRef.current;
        setSyncStatus("saving");
        try {
          const r = await cloudStorageAdapter.save(target, lastSavedRef.current);
          if (gen !== sessionGenRef.current) return;
          lastSavedRef.current = target;
          setSyncError(null);
          // Summaries were refreshed server-side only when transactions changed.
          if (r.analytics !== "skipped") void queryClient.invalidateQueries({ queryKey: ["tiger-analytics"] });
        } catch (err) {
          if (gen !== sessionGenRef.current) return;
          console.error("Cloud save failed", err);
          setSyncStatus("save_error");
          setSyncError(err instanceof Error ? err.message : "Could not save");
          return; // the next edit retries (unchanged sections are still diffed against the last good save)
        }
      }
      if (gen === sessionGenRef.current && authedRef.current) setSyncStatus("synced");
    } finally {
      savingRef.current = false;
    }
  }, [queryClient]);

  useEffect(() => {
    if (!hydrated) return;
    if (skipSave.current) {
      skipSave.current = false;
      return;
    }
    // Debounce both the local cache write and the cloud save so slider drags don't
    // re-serialize the whole dataset on every tick.
    const local = setTimeout(() => localStorageAdapter.save(stateRef.current), 400);
    const cloud = authedRef.current ? setTimeout(() => void flushCloud(), 800) : null;
    return () => {
      clearTimeout(local);
      if (cloud) clearTimeout(cloud);
    };
  }, [state, hydrated, flushCloud]);

  // Don't lose the last debounced local write when the tab closes.
  useEffect(() => {
    const onHide = () => { if (authedRef.current || stateRef.current.transactions.length) localStorageAdapter.save(stateRef.current); };
    window.addEventListener("pagehide", onHide);
    return () => window.removeEventListener("pagehide", onHide);
  }, []);

  const range = useMemo(() => state.range ?? defaultRange(state.transactions), [state.range, state.transactions]);

  const recategorize = useCallback((ids: string[], category: Category, label?: string) => {
    const prev = stateRef.current.transactions;
    setUndoStack((u) => [...u.slice(-19), { label: label ?? `Recategorize ${ids.length} transaction(s)`, transactions: prev }]);
    setState((s) => ({ ...s, transactions: applyCategory(s.transactions, new Set(ids), category) }));
  }, []);

  const undo = useCallback(() => {
    const last = undoRef.current[undoRef.current.length - 1];
    if (!last) return;
    setState((s) => ({ ...s, transactions: last.transactions }));
    setUndoStack((u) => u.slice(0, -1));
  }, []);

  const value = useMemo<Store>(
    () => ({
      ...state,
      range,
      hydrated,
      syncStatus,
      syncError,
      retrySync: () => void syncFromCloud(),
      undoLabel: undoStack.length ? undoStack[undoStack.length - 1]!.label : null,
      setRange: (r) => setState((s) => ({ ...s, range: r })),
      recategorize,
      undo,
      setRecurringOverride: (key, o) =>
        setState((s) => ({ ...s, recurringOverrides: { ...s.recurringOverrides, [key]: { ...s.recurringOverrides[key], ...o } } })),
      updateAccount: (id, patch) =>
        setState((s) => ({ ...s, accounts: s.accounts.map((a) => (a.id === id ? { ...a, ...patch, source: "manual" } : a)) })),
      updateHolding: (id, patch) =>
        setState((s) => ({ ...s, holdings: s.holdings.map((h) => (h.id === id ? { ...h, ...patch, source: "manual" } : h)) })),
      updateHoldingPrices: (prices) =>
        setState((s) => {
          if (!Object.keys(prices).length) return s;
          return { ...s, holdings: s.holdings.map((h) => {
            const p = h.symbol ? prices[h.symbol.toUpperCase()] : undefined;
            return p && Number(p.price) > 0 ? { ...h, latestPrice: p.price, priceTimestamp: p.ts } : h;
          }) };
        }),
      updateManual: (patch) => setState((s) => ({ ...s, manual: { ...s.manual, ...patch, updatedAt: new Date().toISOString() } })),
      setSavings: (sv) => setState((s) => ({ ...s, savings: sv })),
      setTransactionSource: (src) => {
        setState((s) => ({ ...s, transactionSource: src }));
        if (src !== "nessie") return;
        void import("@/services/transactions/nessieProvider").then(async ({ nessieTransactionProvider }) => {
          const res = await nessieTransactionProvider.fetchTransactions({});
          if (res.status !== "ok") {
            console.warn("Nessie transactions unavailable:", res);
            return;
          }
          const txns = res.data.transactions;
          if (!txns.length) {
            console.warn("Nessie returned no transactions for this key.");
            return;
          }
          const prev = stateRef.current.transactions;
          setUndoStack((u) => [...u.slice(-19), { label: `Load ${txns.length} from Nessie`, transactions: prev }]);
          setState((s) => ({ ...s, transactions: txns, transactionSource: "nessie", range: null }));
        });
      },
      addTransaction: (txn) => {
        const prev = stateRef.current.transactions;
        setUndoStack((u) => [...u.slice(-19), { label: `Add ${txn.merchant}`, transactions: prev }]);
        setState((s) => ({ ...s, transactions: [txn, ...s.transactions] }));
      },
      importTransactions: (txns) => {
        const prev = stateRef.current.transactions;
        setUndoStack((u) => [...u.slice(-19), { label: `Import ${txns.length} from CSV`, transactions: prev }]);
        setState((s) => ({ ...s, transactions: txns, transactionSource: "csv", range: null }));
      },
      importHoldings: (accounts, holdings) => {
        setState((s) => ({ ...s, accounts, holdings }));
      },
      resetDemo: () => {
        localStorageAdapter.clear();
        setUndoStack([]);
        setState(initialState());
      },
    }),
    [state, range, hydrated, undoStack, recategorize, undo, syncStatus, syncError, syncFromCloud],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useFinanceStore() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useFinanceStore must be used inside FinanceProvider");
  return v;
}
