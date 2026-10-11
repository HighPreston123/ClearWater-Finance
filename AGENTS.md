<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules
- Business logic lives in pure modules under src/lib (finance, investments, risk, advisors); UI only renders their results — keeps calculations testable and swappable.
- External services are typed stubs in src/services returning not_configured — the app must run without credentials and never fake success.
- Persisted state goes through StorageAdapter (versioned key) — so browser storage can be replaced by a server later.
- Risk engine and wellness composition return non-numeric "not implemented" results until the team defines the methodology — never invent scores.
- Per-user financial data lives in Lovable Cloud tables `public.fin_*` and is read/written only via server functions using the caller's verified client (RLS user_id = auth.uid()); TigerData (tiger/) is kept only as the rollback source — so ownership holds even if a query forgets a filter and the published Worker never needs a custom-CA TCP connection. localStorage is only the offline cache/first paint.
- Protected data operations require aal2 when the user has a verified MFA factor — so MFA is enforced on the server, not just the UI.
- On a failed cloud load, cloud saves stay paused and a banner shows — so local/sample data never overwrites real saved data.
- All app pages live under `src/routes/_authenticated/` (client-only gate in `_authenticated/route.tsx`); public routes are `/auth` and `/reset-password`. The app shell renders from the gate route, not `__root.tsx`.
- The single `supabase.auth.onAuthStateChange` subscriber lives in FinanceProvider (identity events only); it handles data sync, sign-out cache teardown, and router invalidation. Don't add competing listeners.
- Spending trends are computed live from `fin_transactions` by owner-scoped SQL functions (`fin_owner_daily_activity`, `fin_analytics`) that replace the Timescale continuous aggregate; saves that change transactions rescore (src/lib/analytics.server.ts) — so analytics never ship all transactions to the browser and stay owner-scoped.
- Advisors, the 100 fictional comparison profiles, and the shared category vocabulary live in read-only reference tables (`fin_advisors`, `fin_comparison_profiles`, `fin_financial_categories`); advisor categories are trigger-locked, person categories change only via server-only `fin_set_profile_categories`, and matching only reads shared categories — so matching can never alter scores or categories.
- The one-time onboarding quiz stores stable answer ids in `fin_onboarding_quiz` (one row per user, trigger-locked once completed) via src/lib/onboarding.functions.ts; the auth gate routes any account without a completed quiz row to /onboarding (checked via getOnboardingState, failing open if the check errors; the `onboarding_pending` metadata flag is only a fast path from email sign-up) — so every sign-up method hits the quiz and the quiz never scores answers.
- Account deletion runs only in `deleteMyAccount` (src/lib/account.functions.ts): `fin_delete_my_data` (scoped to auth.uid()) first, then backup/profile, then the login last — so a failure never claims success or orphans data.
- Saves are serialized and coalesced in FinanceProvider; the client omits data sections unchanged (by reference) since the last successful save, and the server rescans analytics/scores only when transaction rows actually changed — so settings edits stay cheap and older requests can't overwrite newer edits.
- The auth gate uses the local session plus a per-user onboarding cache (src/lib/onboarding/stateCache.ts) that reuses a verified "completed" result for the session and is cleared on sign-out/account change — so warm navigation makes no network calls while server functions remain the authority.
- Shared derivations in src/store/useDerived.ts are module-level memoized by input identity, and page data (analytics, market data) uses user-scoped TanStack Query keys — so revisiting pages reuses results instead of recomputing/refetching.
