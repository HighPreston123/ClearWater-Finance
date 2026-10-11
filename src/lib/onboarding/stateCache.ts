import type { OnboardingState } from "@/lib/onboarding.functions";
import { loadSession } from "@/lib/state.functions";
import type { PersistedState } from "@/services/storage/storageAdapter";

/**
 * Per-user onboarding status cache shared by the auth gate and the onboarding screen.
 * - Status comes from the sign-in bootstrap (loadSession), which also returns the saved state in the
 *   same database request; the store consumes that state via takeSessionState, so a cold sign-in
 *   costs one request instead of separate onboarding + state requests.
 * - A verified "completed" result is reused for the rest of the session (trigger-locked once completed).
 * - Non-completed results are kept only briefly so a fresh sign-up isn't stuck on stale state.
 * - Concurrent callers share one in-flight request. Cleared on sign-out / user change.
 * The server stays authoritative: protected operations verify the session themselves.
 */
type Session = { data: PersistedState | null; onboarding: OnboardingState };
type Entry = { userId: string; at: number; p: Promise<OnboardingState>; completed: boolean };
let cached: Entry | null = null;
let pendingState: { userId: string; p: Promise<Session> } | null = null;
const PENDING_TTL_MS = 15_000;
const TIMEOUT_MS = 20_000;

function withTimeout<T>(p: Promise<T>, msg: string): Promise<T> {
  return Promise.race([p, new Promise<never>((_, reject) => setTimeout(() => reject(new Error(msg)), TIMEOUT_MS))]);
}

/** Starts one bootstrap request; seeds the onboarding cache and leaves the state for the store to take. */
function startSession(userId: string): Promise<Session> {
  const p = withTimeout(loadSession() as Promise<Session>, "Loading your saved data timed out. Please retry.");
  pendingState = { userId, p };
  const entry: Entry = { userId, at: Date.now(), p: p.then((s) => s.onboarding), completed: false };
  cached = entry;
  entry.p.then(
    (s) => { if (cached === entry && s.status === "completed") entry.completed = true; },
    () => { if (cached === entry) cached = null; },
  );
  p.catch(() => { if (pendingState?.p === p) pendingState = null; });
  return p;
}

export function fetchOnboardingState(userId: string, fresh = false): Promise<OnboardingState> {
  if (cached && cached.userId !== userId) cached = null;
  if (!fresh && cached && (cached.completed || Date.now() - cached.at < PENDING_TTL_MS)) return cached.p;
  return startSession(userId).then((s) => s.onboarding);
}

/** The store's state load: reuses the gate's in-flight/just-finished bootstrap, else starts one. */
export function takeSessionState(userId: string): Promise<PersistedState | null> {
  const shared = pendingState?.userId === userId ? pendingState.p : null;
  pendingState = null;
  return (shared ?? startSession(userId).finally(() => { pendingState = null; })).then((s) => s.data);
}

/** Call right after the server confirmed quiz completion. */
export function markOnboardingCompleted(userId: string) {
  const state: OnboardingState = { status: "completed", answers: {}, completedAt: new Date().toISOString() };
  cached = { userId, at: Date.now(), p: Promise.resolve(state), completed: true };
}

export function clearOnboardingStateCache() {
  cached = null;
  pendingState = null;
}
