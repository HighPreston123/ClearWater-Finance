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
- Per-user financial data lives in TigerData (schema `fin`, migrations in tiger/migrations, applied by tiger/migrate.mjs) and is read/written only via `loadUserState`/`saveUserState` (src/lib/state.functions.ts → src/lib/tiger.server.ts); owner id comes from the verified session, queries run as role fin_app with RLS on app.user_id — so ownership holds even if a query forgets a filter. localStorage is only the offline cache/first paint.
- Protected TigerData operations require aal2 when the user has a verified MFA factor — so MFA is enforced on the server, not just the UI.
- On a failed cloud load, cloud saves stay paused and a banner shows — so local/sample data never overwrites real saved data.
- All app pages live under `src/routes/_authenticated/` (client-only gate in `_authenticated/route.tsx`); public routes are `/auth` and `/reset-password`. The app shell renders from the gate route, not `__root.tsx`.
- The single `supabase.auth.onAuthStateChange` subscriber lives in FinanceProvider (identity events only); it handles data sync, sign-out cache teardown, and router invalidation. Don't add competing listeners.
- Spending trends come from TigerData: `fin.transactions` stays authoritative; a trigger mirrors it into hypertable `fin.txn_activity` feeding continuous aggregate `fin.daily_activity`, read by the app role only via `fin.owner_daily_activity()` (caggs have no RLS). Saves refresh dirty days then rescore (src/lib/analytics.server.ts) — so analytics never ship all transactions to the browser and stay owner-scoped.
- Score history reruns the existing `computeHistoricalScore` per complete month; rows are keyed by methodology version + input fingerprint — so recalculation never duplicates and changed data yields a revision.
- Advisors, the 100 fictional comparison profiles, and the shared category vocabulary live in TigerData reference tables (tiger/migrations/0005, seeded idempotently by tiger/seed_reference.mjs); advisor categories are trigger-locked, person categories change only via `fin.set_profile_categories` (future risk assessment), and matching only reads shared categories — so matching can never alter scores or categories.
- The Overview audio summary speaks a script built only from already-computed Overview figures (src/lib/finance/audioSummaryText.ts); `generateAudioSummary` (src/lib/audio.functions.ts) calls ElevenLabs server-side with ELEVENLABS_API_KEY and clips are cached per script — so the key never reaches the browser and unchanged data never re-bills.
- The one-time onboarding quiz stores stable answer ids in TigerData `fin.onboarding_quiz` (one row per user, trigger-locked once completed) via src/lib/onboarding.functions.ts; the auth gate routes any account without a completed quiz row to /onboarding (checked via getOnboardingState, failing open if the check errors; the `onboarding_pending` metadata flag is only a fast path from email sign-up) — so every sign-up method hits the quiz and the quiz never scores answers.
- Account deletion runs only in `deleteMyAccount` (src/lib/account.functions.ts): owner id from the verified session, deletes TigerData rows, then backup/profile, then the login last — so a failure never claims success or orphans data.
- Market data comes only from Alpaca (feed=iex) via src/lib/marketdata.functions.ts → marketdata.server.ts; bars live in hypertable `fin.market_bars` (key symbol+timeframe+feed+ts), latest trades in `fin.market_latest` (also the ~60s cache), watchlists in owner-RLS `fin.watchlist` — so tracked symbols never become holdings and keys stay server-side.
