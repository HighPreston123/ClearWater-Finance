# TigerData connection

## Implementation paths
- `src/lib/tiger.server.ts` — server-only driver (`postgres` / postgres.js; uses its Workers build on publish). TLS required (`ssl: "require"`), one connection per request (`max: 1`, `prepare: false`), closed after each request. Every query runs in a transaction with `SET LOCAL ROLE fin_app` and `app.user_id` = verified owner.
- `src/lib/state.functions.ts` — `loadUserState` / `saveUserState` server functions. `requireSupabaseAuth` verifies the session; owner id = `context.userId` (never client input); input validated with zod; MFA (aal2) required when the user has a verified factor.
- `src/services/storage/cloudStorageAdapter.ts` — remote StorageAdapter used by `src/store/FinanceStore.tsx`. localStorage remains a cache.
- `src/components/layout/SyncBanner.tsx` — loading / error states with Retry.

## Schema (`tiger/migrations/0001_financial_core.sql`)
`fin.financial_accounts`, `fin.transactions`, `fin.investment_holdings` (composite FK to the same owner's account), `fin.recurring_overrides`, `fin.user_settings` (goals + risk inputs, savings settings, range, data source). RLS on all tables for role `fin_app` (SELECT/INSERT/UPDATE/DELETE only; no DDL).
Note: `transactions.account_id` refers to bank accounts that are not tracked as rows, so it is owner-scoped but has no FK.

## Secrets
- `TIGER_DATABASE_URL` (server-only) — Tiger Cloud connection string. Prefer the **connection pooler** URL from the Tiger console. Must include `sslmode=require` or rely on the driver's `ssl: "require"`.

## Migrations
```
TIGER_DATABASE_URL=... node tiger/migrate.mjs
```
Applied files are tracked in `fin_meta.schema_migrations`. Add new numbered `.sql` files; never edit applied ones.

## Optional hardening
The app already switches to `fin_app` per transaction. To also avoid using the admin login at all, in Tiger run
`ALTER ROLE fin_app LOGIN PASSWORD '<strong password>'; GRANT USAGE ON SCHEMA fin TO fin_app;`
and set `TIGER_DATABASE_URL` to a URL with user `fin_app` (also remove the `SET LOCAL ROLE` need — it is harmless if left).

## User profiles (`0002_user_profiles.sql`)
`fin.user_profiles` (auth_user_id PK, email, display_name, created_at, last_login_at). Written only by the
`recordLogin` server function (src/lib/state.functions.ts) on a real `SIGNED_IN` event: it verifies the session,
reads id / confirmed email / provider name from the auth server (no client input), and upserts —
created_at is preserved, last_login_at is bumped. fin_app has SELECT/INSERT/UPDATE only (no DELETE); RLS limits
every user to their own row.
