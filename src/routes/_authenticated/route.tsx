import { createFileRoute, isRedirect, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { fetchOnboardingState } from "@/lib/onboarding/stateCache";

/**
 * Integration-managed auth gate. Client-only (the session lives in browser
 * storage, which the server cannot read), redirects signed-out visitors to
 * the sign-in page, and renders the app shell around every protected page.
 *
 * Navigation uses the locally initialized session (no network on warm
 * navigation); every protected server function still verifies the token
 * itself, so this gate only decides what UI to show.
 *
 * Onboarding routing is database-backed: any account without a completed
 * quiz row in TigerData is sent to /onboarding. The result is cached per
 * user (see stateCache) so it's checked once per session, not per click.
 * The `onboarding_pending` metadata flag is only a fast path set at email
 * sign-up. If the status check fails, the gate fails open.
 */
export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data } = await supabase.auth.getSession();
    const user = data.session?.user;
    if (!user) throw redirect({ to: "/auth" });
    if (location.pathname === "/onboarding") return;
    if (user.user_metadata?.["onboarding_pending"] === true) {
      throw redirect({ to: "/onboarding" });
    }
    try {
      const state = await fetchOnboardingState(user.id);
      if (state.status !== "completed") throw redirect({ to: "/onboarding" });
    } catch (e) {
      // Redirects and router cancellations must propagate.
      if (isRedirect(e) || (e instanceof Error && e.name === "AbortError")) throw e;
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
