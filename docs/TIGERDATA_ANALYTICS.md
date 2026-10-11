# TigerData analytics: spending trends & wellness-score history

## What exists in TigerData (verified 2026-10-10)

Database `tsdb` on Tiger Cloud, PostgreSQL 18.6, extensions `timescaledb 2.30.2`, `timescaledb_toolkit 1.26.0`.
All app objects live in schema **`fin`**; migration bookkeeping lives in `fin_meta.schema_migrations`.
Nothing was written to the Lovable Cloud database for this feature.

| Object | Kind | Purpose |
|---|---|---|
| `fin.user_profiles` | table (pre-existing, unchanged) | email / display name per auth user |
| `fin.user_settings` | table | goals, risk inputs, savings scenario, date range, transaction source |
| `fin.financial_accounts`, `fin.investment_holdings` | tables | accounts & holdings |
| `fin.transactions` | table — **authoritative** | now also has `currency`, `source`, `external_id`, `is_sample`, `updated_at`; unique `(user_id, source, external_id)` for import de-dup (Nessie-ready) |
| `fin.transaction_category_overrides` | table | manual categorizations (FK → transactions, cascades on delete) |
| `fin.txn_activity` | **hypertable** (`ts`, 30-day chunks) | derived copy of transactions, kept in sync by trigger `transactions_sync_activity` (insert/update/delete) |
| `fin.analytics_dirty_days` | table | old + new dates touched by each change, so exact windows get refreshed |
| `fin.daily_activity` | **continuous aggregate** (1-day `time_bucket`, by user/type/category/currency/is_sample), real-time (`materialized_only = false`) | source of all trend queries |
| `fin.owner_daily_activity(start, end)` | SECURITY DEFINER function | only read path to the aggregate for the app role; filters by the verified owner |
| `fin.wellness_score_history` | table | one row per distinct score revision |
| refresh policy on `fin.daily_activity` | TimescaleDB job | hourly safety-net refresh of the last 3 years |

Why a derived hypertable: `fin.transactions` has primary key `(user_id, id)` without the date, so converting it would change transaction identity and import de-dup. It stays authoritative; the hypertable is a trigger-maintained mirror.

## Migrations
- `tiger/migrations/0001_financial_core.sql`, `0002_user_profiles.sql` (pre-existing)
- `tiger/migrations/0003_analytics.sql` — columns, overrides, hypertable, trigger, continuous aggregate, policy, score history, RLS/grants
- `tiger/migrations/0004_populate_daily_activity.sql` — initial materialization (runs outside a transaction; marked `-- tiger:no-transaction`)

Apply: `node tiger/migrate.mjs` (needs `TIGER_DATABASE_URL`). All four are applied.

## Code locations
- `src/lib/tiger.server.ts` — connections, `writeState` (diffs transactions), `refreshOwnerAnalytics`
- `src/lib/analytics.server.ts` — trend queries, reconciliation, score recalculation, demo load/reset
- `src/lib/analytics.functions.ts` — authenticated endpoints `getAnalytics`, `refreshAnalysis`, `demoAction`
- `src/lib/state.functions.ts` — `saveUserState` now refreshes analytics and rescoring after a successful save
- `src/lib/finance/trends.ts` — pure comparison / "What changed?" wording (zero-baseline rule)
- `src/lib/finance/scoreHistory.ts` — reruns the existing `computeHistoricalScore` per complete month; methodology version; fingerprint inputs
- `src/components/analytics/TigerAnalyticsPanel.tsx` — Overview section (charts, category table, score timeline, details, refresh, demo)
- `scripts/verify-tiger-analytics.ts` — end-to-end verification (`bun scripts/verify-tiger-analytics.ts`)

## Refresh behavior
1. Browser saves → `saveUserState` writes in one transaction; triggers update `txn_activity` and record dirty days (old and new dates for edits).
2. After commit, `refreshOwnerAnalytics` calls `refresh_continuous_aggregate` for the min..max dirty window, then clears those days.
3. `recalculateScores` reruns every complete month (later months depend on earlier ones).
4. The browser invalidates its analytics query and re-fetches. "Refresh analysis" does the same over the user's full date span.
5. Real-time aggregation covers any not-yet-materialized recent data without double counting; the hourly policy is a safety net.
6. Every response reconciles aggregate totals against a direct `fin.transactions` aggregation and shows "Matches source transactions" (or a warning). If the aggregate is unavailable, direct SQL is used and labeled.

## Rules
- Income = `income`, spending = `expense`; `transfer` is excluded from both and reported separately.
- Only USD is aggregated; other currencies are listed as excluded (no conversion method defined).
- Complete calendar months / Monday weeks within the dataset's first..last date; partial periods are labeled.
- Previous = $0 → dollar change only, no percentage.
- Score: existing formula only, `methodology_version = historical-cash-flow-v1`. Fingerprint = SHA-256 of the month's and up to two prior complete months' income/spending/net. Same inputs → same row (`last_confirmed_at` bumped); changed inputs → new revision. Current = most recently confirmed revision per period. `score` NULL + `insufficient_data` when no income. Rows first calculated after the end of the following month are labeled "Reconstructed from historical transactions." Future risk is excluded.

## Access control
Credentials are server-only. Every endpoint verifies the session (and aal2 when MFA is enrolled); owner id comes from the session. Queries run as `fin_app` with `app.user_id` set, so RLS covers transactions, overrides, score history and profiles. `fin_app` has no grant on `fin.daily_activity` or `fin.txn_activity` (verified: permission denied); aggregate reads go through `fin.owner_daily_activity`. Only aggregate refresh runs as the connection's admin role.

## SQL to inspect in Tiger Cloud
```sql
SELECT hypertable_name, num_chunks FROM timescaledb_information.hypertables WHERE hypertable_schema = 'fin';
SELECT view_name, materialized_only FROM timescaledb_information.continuous_aggregates WHERE view_schema = 'fin';
SELECT job_id, schedule_interval, config FROM timescaledb_information.jobs WHERE hypertable_name = 'daily_activity';

-- Monthly trend for one user (replace the uuid)
SELECT time_bucket('1 month', day) AS month,
       sum(amount_cents) FILTER (WHERE txn_type='income')  / 100.0 AS income,
       sum(amount_cents) FILTER (WHERE txn_type='expense') / 100.0 AS spending
FROM fin.daily_activity WHERE user_id = '00000000-0000-0000-0000-000000000000' AND currency='USD'
GROUP BY 1 ORDER BY 1;

-- Reconcile aggregate vs source
SELECT a.m, a.s AS aggregate, b.s AS source FROM
 (SELECT time_bucket('1 month', day)::date m, sum(amount_cents) s FROM fin.daily_activity WHERE txn_type='expense' GROUP BY 1) a
 FULL JOIN (SELECT time_bucket('1 month', txn_date) m, sum(amount_cents) s FROM fin.transactions WHERE txn_type='expense' GROUP BY 1) b USING (m)
ORDER BY 1;

-- Score history with revisions
SELECT user_id, period_start, score, status, reconstructed, methodology_version, left(input_fingerprint,8), calculated_at, last_confirmed_at
FROM fin.wellness_score_history ORDER BY user_id, period_start, last_confirmed_at;
```

## Demo
On Overview → "Demonstration": **Add demo month** inserts 18 labeled rows for June 2026 (`source='demo'`, `is_sample=true`, ids `demo-2026-06-NN`, includes one savings transfer). It saves to TigerData, refreshes June's aggregate, rescores (July's prior-month factor becomes available → new July revision) and updates charts. Running it again inserts 0 rows. **Reset demo data** deletes only `source='demo'` rows. Best shown on an account with the built-in sample data (Jul–Oct 2026).

## Verified (scripts/verify-tiger-analytics.ts, all passing)
Aggregate = app formula and source; transfers excluded; partial month flagged; category edit, date move into an older month, and deletion all reconcile; zero-baseline wording; rescoring creates no duplicates; one current assessment per period; reconstructed labeling; demo idempotent and reset-safe; later-month revision after a historical import; cross-user isolation (RLS + aggregate grants).

## Future extensions (not implemented)
- **Stock-price history**: new hypertable `fin.security_prices(symbol, ts, price)` fed from `src/services/investments/marketDataProvider.ts`.
- **Dated portfolio valuations**: hypertable `fin.portfolio_valuations(user_id, ts, account_id, value_cents)` + daily aggregate; add RLS like `wellness_score_history`.
- **Income/spending variability**: add `stddev` queries over `fin.owner_daily_activity` monthly buckets in `analytics.server.ts`.
- **Future-risk inputs**: feed the above into `src/lib/risk/riskEngine.ts` once the methodology exists (`docs/RISK_METHODOLOGY_TODO.md`); store as a new `score_type` with its own methodology version.
- **AI explanations**: pass `AnalyticsResult.comparison` (already factual) to `src/services/ai/insightsClient.ts`.
- **Nessie imports**: insert with `source='nessie'`, `external_id=<Nessie id>`, `ON CONFLICT (user_id, source, external_id) WHERE external_id IS NOT NULL DO NOTHING`, then call `afterTransactionsChanged`.

## Limitations
- The browser still syncs the full transaction list on save (the server diffs it); analytics themselves are computed in the database.
- Refresh is per save (debounced); the aggregate window is the min..max of changed dates, so a pair of far-apart edits refreshes everything between them.
- Only USD is analyzed.
