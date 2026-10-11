import { createFileRoute, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { fetchOnboardingState } from "@/lib/onboarding/stateCache";

/**
 * Integration-managed auth gate. Client-only (the session lives in browser
 * storage, which the server cannot read), redirects signed-out visitors to
 * the sign-in page, and renders the app shell around every protected page.
 * Onboarding routing is database-backed: any account without a completed
 * quiz row in TigerData is sent to /onboarding, regardless of sign-up
 * method (email, Google, etc.). The `onboarding_pending` metadata flag is
 * only a fast path set at email sign-up. If the status check fails (e.g.
 * the database is unreachable), the gate fails open so users are never
 * softlocked out of the app.
 */
export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    if (location.pathname === "/onboarding") return;
    if (data.user.user_metadata?.['onboarding_pending'] === true) {
      throw redirect({ to: "/onboarding" });
    }
    try {
      const state = await fetchOnboardingState();
      if (state.status !== "completed") throw redirect({ to: "/onboarding" });
    } catch (e) {
      // Redirects (thrown above) and router cancellations must propagate.
      if (e instanceof Response || (e instanceof Error && e.name === "AbortError")) throw e;
      // Status check failed (e.g. database unreachable) — fail open.
      console.error("[gate] onboarding status check failed", e);
    }
  },
  component: GateLayout,
});

function GateLayout() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  if (path === "/onboarding") return <Outlet />;
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
