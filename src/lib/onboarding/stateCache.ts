import { getOnboardingState, type OnboardingState } from "@/lib/onboarding.functions";

/**
 * Per-user onboarding status cache shared by the auth gate and the onboarding screen.
 * - A verified "completed" result is reused for the rest of the session (the quiz row is
 *   trigger-locked once completed, so it cannot revert). This removes the database round-trip
 *   from warm navigation.
 * - Non-completed results are kept only briefly so a fresh sign-up isn't stuck on stale state.
 * - Concurrent callers share one in-flight request.
 * - Cleared on sign-out and whenever the signed-in user changes.
 * The server stays authoritative: protected operations verify the session themselves.
 */
type Entry = { userId: string; at: number; p: Promise<OnboardingState>; completed: boolean };
let cached: Entry | null = null;
const PENDING_TTL_MS = 15_000;
const TIMEOUT_MS = 12_000;

export function fetchOnboardingState(userId: string, fresh = false): Promise<OnboardingState> {
  if (cached && cached.userId !== userId) cached = null;
  if (!fresh && cached && (cached.completed || Date.now() - cached.at < PENDING_TTL_MS)) return cached.p;
  const p = Promise.race([
    getOnboardingState(),
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Onboarding check timed out")), TIMEOUT_MS)),
  ]);
  const entry: Entry = { userId, at: Date.now(), p, completed: false };
  cached = entry;
  p.then(
    (s) => { if (cached === entry && s.status === "completed") entry.completed = true; },
    () => { if (cached === entry) cached = null; },
  );
  return p;
}

/** Call right after the server confirmed quiz completion. */
export function markOnboardingCompleted(userId: string) {
  const state: OnboardingState = { status: "completed", answers: {}, completedAt: new Date().toISOString() };
  cached = { userId, at: Date.now(), p: Promise.resolve(state), completed: true };
}

export function clearOnboardingStateCache() {
  cached = null;
}
