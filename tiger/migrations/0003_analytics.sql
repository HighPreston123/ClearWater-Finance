-- Analytics layer for spending trends and wellness-score history (TimescaleDB).
-- Additive only: existing tables and rows are preserved.
--
-- fin.transactions stays the authoritative store. Its primary key (user_id, id) does not include the
-- date, so it cannot become a hypertable without changing its identity. Instead, triggers mirror it
-- into the derived hypertable fin.txn_activity, which feeds the continuous aggregate fin.daily_activity.

-- 1. Transaction provenance, currency and import de-duplication -------------------------------
ALTER TABLE fin.transactions
  ADD COLUMN IF NOT EXISTS currency    text        NOT NULL DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS source      text        NOT NULL DEFAULT 'manual', -- sample | demo | csv | nessie | manual
  ADD COLUMN IF NOT EXISTS external_id text,                                  -- id from the upstream provider (e.g. Nessie)
  ADD COLUMN IF NOT EXISTS is_sample   boolean     NOT NULL DEFAULT false,    -- sample/demo rows are never personal data
  ADD COLUMN IF NOT EXISTS updated_at  timestamptz NOT NULL DEFAULT now();

-- Backfill provenance from each user's recorded transaction source.
UPDATE fin.transactions t
   SET source = s.transaction_source, is_sample = (s.transaction_source = 'sample')
  FROM fin.user_settings s
 WHERE s.user_id = t.user_id;

-- Repeated imports from the same provider cannot create duplicates.
CREATE UNIQUE INDEX IF NOT EXISTS transactions_source_external_uq
  ON fin.transactions (user_id, source, external_id) WHERE external_id IS NOT NULL;

-- 2. Category overrides ---------------------------------------------------------------------------
CREATE TABLE fin.transaction_category_overrides (
  user_id    uuid NOT NULL,
  txn_id     text NOT NULL,
  category   text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, txn_id),
  FOREIGN KEY (user_id, txn_id) REFERENCES fin.transactions (user_id, id) ON DELETE CASCADE
);
INSERT INTO fin.transaction_category_overrides (user_id, txn_id, category)
SELECT user_id, id, category FROM fin.transactions WHERE category_source = 'manual';

-- 3. Derived activity hypertable ---------------------------------------------------------------
CREATE TABLE fin.txn_activity (
  user_id      uuid        NOT NULL,
  txn_id       text        NOT NULL,
  ts           timestamptz NOT NULL,   -- txn_date at 00:00 UTC (calendar dates are never shifted by local time)
  txn_type     text        NOT NULL,
  category     text        NOT NULL,
  currency     text        NOT NULL,
  amount_cents bigint      NOT NULL,   -- positive cents; txn_type gives the meaning
  is_sample    boolean     NOT NULL,
  PRIMARY KEY (user_id, txn_id, ts)
);
SELECT create_hypertable('fin.txn_activity', by_range('ts', INTERVAL '30 days'));

INSERT INTO fin.txn_activity
SELECT user_id, id, (txn_date::timestamp AT TIME ZONE 'UTC'), txn_type, category, currency, amount_cents, is_sample
  FROM fin.transactions;

-- Days whose aggregates must be re-materialized (old AND new dates of every change).
CREATE TABLE fin.analytics_dirty_days (
  user_id uuid NOT NULL,
  day     date NOT NULL,
  PRIMARY KEY (user_id, day)
);

CREATE OR REPLACE FUNCTION fin.sync_txn_activity() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = fin, pg_catalog AS $$
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    DELETE FROM fin.txn_activity
     WHERE user_id = OLD.user_id AND txn_id = OLD.id AND ts = (OLD.txn_date::timestamp AT TIME ZONE 'UTC');
    INSERT INTO fin.analytics_dirty_days VALUES (OLD.user_id, OLD.txn_date) ON CONFLICT DO NOTHING;
  END IF;
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    INSERT INTO fin.txn_activity
    VALUES (NEW.user_id, NEW.id, (NEW.txn_date::timestamp AT TIME ZONE 'UTC'), NEW.txn_type, NEW.category, NEW.currency, NEW.amount_cents, NEW.is_sample);
    INSERT INTO fin.analytics_dirty_days VALUES (NEW.user_id, NEW.txn_date) ON CONFLICT DO NOTHING;
  END IF;
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION fin.sync_txn_activity() FROM PUBLIC;

CREATE TRIGGER transactions_sync_activity
AFTER INSERT OR UPDATE OR DELETE ON fin.transactions
FOR EACH ROW EXECUTE FUNCTION fin.sync_txn_activity();

-- 4. Daily continuous aggregate (populated by 0004, refreshed by the app after changes) ---------
CREATE MATERIALIZED VIEW fin.daily_activity
WITH (timescaledb.continuous, timescaledb.materialized_only = false) AS
SELECT user_id,
       time_bucket(INTERVAL '1 day', ts) AS day,
       txn_type, category, currency, is_sample,
       sum(amount_cents)::bigint AS amount_cents,
       count(*)::int            AS txn_count
  FROM fin.txn_activity
 GROUP BY user_id, day, txn_type, category, currency, is_sample
WITH NO DATA;

-- Safety-net background refresh; the app also refreshes exact dirty windows after each save.
SELECT add_continuous_aggregate_policy('fin.daily_activity',
  start_offset => INTERVAL '3 years', end_offset => NULL, schedule_interval => INTERVAL '1 hour');

-- Continuous aggregates do not support RLS, so fin_app gets NO direct access.
-- This owner-scoped function is the only read path; it filters by the verified owner set per transaction.
CREATE OR REPLACE FUNCTION fin.owner_daily_activity(p_start date, p_end date)
RETURNS TABLE (day date, txn_type text, category text, currency text, is_sample boolean, amount_cents bigint, txn_count int)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = fin, public, pg_catalog AS $$
  SELECT d.day::date, d.txn_type, d.category, d.currency, d.is_sample, d.amount_cents, d.txn_count
    FROM fin.daily_activity d
   WHERE fin.current_owner() IS NOT NULL
     AND d.user_id = fin.current_owner()
     AND d.day >= (p_start::timestamp AT TIME ZONE 'UTC')
     AND d.day <  ((p_end + 1)::timestamp AT TIME ZONE 'UTC')
$$;
REVOKE ALL ON FUNCTION fin.owner_daily_activity(date, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION fin.owner_daily_activity(date, date) TO fin_app;

-- 5. Wellness-score history --------------------------------------------------------------------
CREATE TABLE fin.wellness_score_history (
  id                  bigserial PRIMARY KEY,
  user_id             uuid        NOT NULL,
  score_type          text        NOT NULL,           -- 'historical_cash_flow' (future risk is excluded)
  period_start        date        NOT NULL,
  period_end          date        NOT NULL,
  score               integer,                         -- NULL when status is insufficient_data
  status              text        NOT NULL,            -- ok | insufficient_data
  factors             jsonb       NOT NULL DEFAULT '[]'::jsonb,
  metrics             jsonb       NOT NULL DEFAULT '{}'::jsonb,
  methodology_version text        NOT NULL,
  input_fingerprint   text        NOT NULL,
  reconstructed       boolean     NOT NULL,            -- calculated after the fact from historical transactions
  calculated_at       timestamptz NOT NULL DEFAULT now(),
  last_confirmed_at   timestamptz NOT NULL DEFAULT now(), -- latest recalculation that produced this exact revision
  UNIQUE (user_id, score_type, period_start, methodology_version, input_fingerprint)
);
CREATE INDEX wellness_score_history_user_period_idx ON fin.wellness_score_history (user_id, score_type, period_start);

GRANT SELECT, INSERT, UPDATE ON fin.wellness_score_history TO fin_app;
GRANT USAGE ON SEQUENCE fin.wellness_score_history_id_seq TO fin_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON fin.transaction_category_overrides TO fin_app;

ALTER TABLE fin.wellness_score_history          ENABLE ROW LEVEL SECURITY;
ALTER TABLE fin.transaction_category_overrides  ENABLE ROW LEVEL SECURITY;
CREATE POLICY owner_all ON fin.wellness_score_history         TO fin_app USING (user_id = fin.current_owner()) WITH CHECK (user_id = fin.current_owner());
CREATE POLICY owner_all ON fin.transaction_category_overrides TO fin_app USING (user_id = fin.current_owner()) WITH CHECK (user_id = fin.current_owner());
-- fin.txn_activity and fin.analytics_dirty_days: no fin_app grants (written only by the trigger / server maintenance).
