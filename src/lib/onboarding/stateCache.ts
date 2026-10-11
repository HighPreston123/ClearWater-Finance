import { getOnboardingState, type OnboardingState } from "@/lib/onboarding.functions";

/**
 * Shares one in-flight/recent onboarding status check between the auth gate and the
 * onboarding screen, so sign-in doesn't wait on the same database round-trip twice.
 * Times out so a slow database never leaves the user on a frozen screen.
 */
let cached: { at: number; p: Promise<OnboardingState> } | null = null;
const TTL_MS = 15_000;
const TIMEOUT_MS = 12_000;

export function fetchOnboardingState(fresh = false): Promise<OnboardingState> {
  if (!fresh && cached && Date.now() - cached.at < TTL_MS) return cached.p;
  const p = Promise.race([
    getOnboardingState(),
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Onboarding check timed out")), TIMEOUT_MS)),
  ]);
  cached = { at: Date.now(), p };
  p.catch(() => { if (cached?.p === p) cached = null; });
  return p;
}

export function clearOnboardingStateCache() {
  cached = null;
}
