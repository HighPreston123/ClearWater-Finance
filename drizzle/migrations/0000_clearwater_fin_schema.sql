-- Clearwater financial data (migrated from TigerData schema `fin`). Ownership: user_id = auth.uid() via RLS.

-- ---------- Owner tables ----------
CREATE TABLE public.fin_financial_accounts (
  user_id uuid NOT NULL, id text NOT NULL, name text NOT NULL, account_type text NOT NULL, institution text,
  currency text NOT NULL DEFAULT 'USD', cash_cents bigint NOT NULL DEFAULT 0, valuation_timestamp text NOT NULL, source text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, id));

CREATE TABLE public.fin_transactions (
  user_id uuid NOT NULL, id text NOT NULL, txn_date date NOT NULL, merchant text NOT NULL, amount_cents bigint NOT NULL,
  txn_type text NOT NULL, category text NOT NULL, category_source text NOT NULL, description text NOT NULL DEFAULT '',
  account_id text NOT NULL, linked_account_id text, created_at timestamptz NOT NULL DEFAULT now(),
  currency text NOT NULL DEFAULT 'USD', source text NOT NULL DEFAULT 'manual', external_id text,
  is_sample boolean NOT NULL DEFAULT false, updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, id));
CREATE INDEX fin_transactions_user_date_idx ON public.fin_transactions (user_id, txn_date);
CREATE UNIQUE INDEX fin_transactions_source_external_uq ON public.fin_transactions (user_id, source, external_id) WHERE external_id IS NOT NULL;

CREATE TABLE public.fin_investment_holdings (
  user_id uuid NOT NULL, id text NOT NULL, account_id text NOT NULL, symbol text, external_security_id text, name text NOT NULL,
  asset_class text NOT NULL, quantity numeric NOT NULL, latest_price numeric, price_timestamp text, supplied_value_cents bigint,
  supplied_value_date text, cost_basis_cents bigint, sector text, underlying_exposure text, source text NOT NULL,
  PRIMARY KEY (user_id, id),
  FOREIGN KEY (user_id, account_id) REFERENCES public.fin_financial_accounts (user_id, id) ON DELETE CASCADE);

CREATE TABLE public.fin_recurring_overrides (
  user_id uuid NOT NULL, series_key text NOT NULL, detection text, review text, updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, series_key));

CREATE TABLE public.fin_user_settings (
  user_id uuid PRIMARY KEY, risk_inputs jsonb NOT NULL, savings_settings jsonb NOT NULL, date_range jsonb,
  transaction_source text NOT NULL DEFAULT 'csv', updated_at timestamptz NOT NULL DEFAULT now());

CREATE TABLE public.fin_transaction_category_overrides (
  user_id uuid NOT NULL, txn_id text NOT NULL, category text NOT NULL, updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, txn_id),
  FOREIGN KEY (user_id, txn_id) REFERENCES public.fin_transactions (user_id, id) ON DELETE CASCADE);

CREATE TABLE public.fin_wellness_score_history (
  id bigserial PRIMARY KEY, user_id uuid NOT NULL, score_type text NOT NULL, period_start date NOT NULL, period_end date NOT NULL,
  score integer, status text NOT NULL, factors jsonb NOT NULL DEFAULT '[]', metrics jsonb NOT NULL DEFAULT '{}',
  methodology_version text NOT NULL, input_fingerprint text NOT NULL, reconstructed boolean NOT NULL,
  calculated_at timestamptz NOT NULL DEFAULT now(), last_confirmed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, score_type, period_start, methodology_version, input_fingerprint));
CREATE INDEX fin_wellness_score_history_user_period_idx ON public.fin_wellness_score_history (user_id, score_type, period_start);

CREATE TABLE public.fin_onboarding_quiz (
  user_id uuid PRIMARY KEY, quiz_version text NOT NULL, answers jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress','completed')),
  started_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz, updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((status = 'completed') = (completed_at IS NOT NULL)));

CREATE TABLE public.fin_user_profiles (
  auth_user_id text PRIMARY KEY, email text, display_name text, created_at timestamptz NOT NULL DEFAULT now(), last_login_at timestamptz);

CREATE TABLE public.fin_risk_survey (
  user_id uuid PRIMARY KEY, survey_version text NOT NULL, answers jsonb NOT NULL DEFAULT '{}', target_profile jsonb,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());

CREATE TABLE public.fin_monte_carlo_runs (
  id bigserial PRIMARY KEY, user_id uuid NOT NULL, config jsonb NOT NULL, results jsonb NOT NULL, ran_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX fin_monte_carlo_runs_user ON public.fin_monte_carlo_runs (user_id, ran_at DESC);

CREATE TABLE public.fin_watchlist (
  user_id uuid NOT NULL, symbol text NOT NULL, added_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (user_id, symbol));

-- ---------- Reference tables (read-only to signed-in users) ----------
CREATE TABLE public.fin_financial_categories (
  code text PRIMARY KEY CHECK (code ~ '^[a-z_]+$'), label text NOT NULL UNIQUE, description text NOT NULL);

CREATE TABLE public.fin_advisors (
  id text PRIMARY KEY, full_name text NOT NULL UNIQUE, title text NOT NULL, biography text NOT NULL, experience text NOT NULL,
  education text, certifications text[] NOT NULL DEFAULT '{}', strengths text[] NOT NULL DEFAULT '{}', advisory_style text NOT NULL,
  best_suited_for text[] NOT NULL DEFAULT '{}', meeting_format text CHECK (meeting_format IN ('virtual','in_person','hybrid')),
  nessie_customer_id text UNIQUE, is_fictional boolean NOT NULL DEFAULT true, is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());

CREATE TABLE public.fin_advisor_categories (
  advisor_id text NOT NULL REFERENCES public.fin_advisors(id) ON DELETE CASCADE,
  category_code text NOT NULL REFERENCES public.fin_financial_categories(code),
  role text NOT NULL CHECK (role IN ('primary','secondary')), assigned_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (advisor_id, category_code));
CREATE UNIQUE INDEX fin_advisor_one_primary ON public.fin_advisor_categories (advisor_id) WHERE role = 'primary';

CREATE TABLE public.fin_comparison_profiles (
  id text PRIMARY KEY, full_name text NOT NULL, age_band text, household text, occupation text, financial_background text NOT NULL,
  annual_income_cents bigint, income_stability text, monthly_spending_cents bigint, spending_pattern text, savings_cents bigint,
  monthly_savings_cents bigint, debt_cents bigint, debt_breakdown jsonb NOT NULL DEFAULT '{}', investments_cents bigint,
  investment_experience text, financial_goals text[] NOT NULL DEFAULT '{}', recent_activity jsonb NOT NULL DEFAULT '[]',
  data_source jsonb NOT NULL DEFAULT '{"financials": "synthetic_demo"}', nessie_customer_id text UNIQUE, comparison_subset text,
  overview_score numeric,
  risk_assessment_status text NOT NULL DEFAULT 'pending' CHECK (risk_assessment_status IN ('pending','assessed','insufficient_data','error')),
  assessment_version text, last_assessed_at timestamptz, categories_updated_at timestamptz,
  is_fictional boolean NOT NULL DEFAULT true CHECK (is_fictional),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (overview_score IS NULL OR risk_assessment_status = 'assessed'));
CREATE INDEX fin_comparison_scored ON public.fin_comparison_profiles (comparison_subset) WHERE overview_score IS NOT NULL;

CREATE TABLE public.fin_profile_categories (
  profile_id text NOT NULL REFERENCES public.fin_comparison_profiles(id) ON DELETE CASCADE,
  category_code text NOT NULL REFERENCES public.fin_financial_categories(code), source text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','provisional')), assessment_version text,
  assigned_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (profile_id, category_code));

CREATE TABLE public.fin_profile_category_history (
  id bigserial PRIMARY KEY, profile_id text NOT NULL REFERENCES public.fin_comparison_profiles(id) ON DELETE CASCADE,
  previous_categories text[] NOT NULL, new_categories text[] NOT NULL, source text NOT NULL, assessment_version text,
  changed_at timestamptz NOT NULL DEFAULT now());

-- ---------- Shared caches (read by signed-in users; written only by the server) ----------
CREATE TABLE public.fin_market_bars (
  symbol text NOT NULL, ts timestamptz NOT NULL, timeframe text NOT NULL, feed text NOT NULL, source text NOT NULL DEFAULT 'alpaca',
  open numeric NOT NULL, high numeric NOT NULL, low numeric NOT NULL, close numeric NOT NULL, volume bigint NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (symbol, timeframe, feed, ts));
CREATE INDEX fin_market_bars_ts_idx ON public.fin_market_bars (ts DESC);

CREATE TABLE public.fin_market_latest (
  symbol text NOT NULL, feed text NOT NULL, source text NOT NULL DEFAULT 'alpaca', price numeric, trade_ts timestamptz,
  status text NOT NULL, fetched_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (symbol, feed));

CREATE TABLE public.fin_company_fundamentals (
  symbol text PRIMARY KEY, cik text, company_name text, metrics jsonb,
  status text NOT NULL DEFAULT 'ok' CHECK (status IN ('ok','no_filings','unavailable')),
  source text NOT NULL DEFAULT 'sec_edgar', fetched_at timestamptz NOT NULL DEFAULT now());

-- ---------- Grants ----------
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fin_financial_accounts, public.fin_transactions, public.fin_investment_holdings,
  public.fin_recurring_overrides, public.fin_user_settings, public.fin_transaction_category_overrides,
  public.fin_wellness_score_history, public.fin_risk_survey, public.fin_monte_carlo_runs, public.fin_watchlist TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.fin_onboarding_quiz TO authenticated;
GRANT SELECT ON public.fin_user_profiles, public.fin_financial_categories, public.fin_advisors, public.fin_advisor_categories,
  public.fin_comparison_profiles, public.fin_profile_categories, public.fin_profile_category_history,
  public.fin_market_bars, public.fin_market_latest, public.fin_company_fundamentals TO authenticated;
GRANT ALL ON public.fin_financial_accounts, public.fin_transactions, public.fin_investment_holdings, public.fin_recurring_overrides,
  public.fin_user_settings, public.fin_transaction_category_overrides, public.fin_wellness_score_history, public.fin_onboarding_quiz,
  public.fin_user_profiles, public.fin_risk_survey, public.fin_monte_carlo_runs, public.fin_watchlist, public.fin_financial_categories,
  public.fin_advisors, public.fin_advisor_categories, public.fin_comparison_profiles, public.fin_profile_categories,
  public.fin_profile_category_history, public.fin_market_bars, public.fin_market_latest, public.fin_company_fundamentals TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.fin_wellness_score_history_id_seq, public.fin_monte_carlo_runs_id_seq TO authenticated;

-- ---------- RLS ----------
ALTER TABLE public.fin_financial_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fin_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fin_investment_holdings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fin_recurring_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fin_user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fin_transaction_category_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fin_wellness_score_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fin_onboarding_quiz ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fin_user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fin_risk_survey ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fin_monte_carlo_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fin_watchlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fin_financial_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fin_advisors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fin_advisor_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fin_comparison_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fin_profile_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fin_profile_category_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fin_market_bars ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fin_market_latest ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fin_company_fundamentals ENABLE ROW LEVEL SECURITY;

CREATE POLICY owner_all ON public.fin_financial_accounts TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY owner_all ON public.fin_transactions TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY owner_all ON public.fin_investment_holdings TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY owner_all ON public.fin_recurring_overrides TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY owner_all ON public.fin_user_settings TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY owner_all ON public.fin_transaction_category_overrides TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY owner_all ON public.fin_wellness_score_history TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY owner_all ON public.fin_risk_survey TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY owner_all ON public.fin_monte_carlo_runs TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY owner_all ON public.fin_watchlist TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY owner_select ON public.fin_onboarding_quiz FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY owner_insert ON public.fin_onboarding_quiz FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY owner_update ON public.fin_onboarding_quiz FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY owner_select ON public.fin_user_profiles FOR SELECT TO authenticated USING (auth_user_id = auth.uid()::text);
CREATE POLICY read_all ON public.fin_financial_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY read_all ON public.fin_advisors FOR SELECT TO authenticated USING (true);
CREATE POLICY read_all ON public.fin_advisor_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY read_all ON public.fin_comparison_profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY read_all ON public.fin_profile_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY read_all ON public.fin_profile_category_history FOR SELECT TO authenticated USING (true);
CREATE POLICY read_all ON public.fin_market_bars FOR SELECT TO authenticated USING (true);
CREATE POLICY read_all ON public.fin_market_latest FOR SELECT TO authenticated USING (true);
CREATE POLICY read_all ON public.fin_company_fundamentals FOR SELECT TO authenticated USING (true);

-- ---------- Guards (same rules as Tiger) ----------
CREATE OR REPLACE FUNCTION public.fin_guard_onboarding_quiz() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF OLD.status = 'completed' THEN RAISE EXCEPTION 'onboarding quiz already completed'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER fin_onboarding_quiz_once BEFORE UPDATE ON public.fin_onboarding_quiz FOR EACH ROW EXECUTE FUNCTION public.fin_guard_onboarding_quiz();

CREATE OR REPLACE FUNCTION public.fin_guard_advisor_categories() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF coalesce(current_setting('app.advisor_admin', true), '') <> 'on' THEN
    RAISE EXCEPTION 'advisor categories are static; set app.advisor_admin=on for an authorized admin edit';
  END IF;
  RETURN coalesce(NEW, OLD);
END $$;
CREATE TRIGGER fin_advisor_categories_static BEFORE INSERT OR DELETE OR UPDATE ON public.fin_advisor_categories
  FOR EACH ROW EXECUTE FUNCTION public.fin_guard_advisor_categories();

-- Person categories change only through this function (future risk assessment); server-only.
CREATE OR REPLACE FUNCTION public.fin_set_profile_categories(p_profile text, p_codes text[], p_source text, p_version text) RETURNS void
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE prev text[];
BEGIN
  SELECT coalesce(array_agg(category_code ORDER BY category_code), '{}') INTO prev FROM public.fin_profile_categories WHERE profile_id = p_profile;
  DELETE FROM public.fin_profile_categories WHERE profile_id = p_profile;
  INSERT INTO public.fin_profile_categories (profile_id, category_code, source, assessment_version)
    SELECT p_profile, c, p_source, p_version FROM unnest(coalesce(p_codes, '{}')) AS c;
  INSERT INTO public.fin_profile_category_history (profile_id, previous_categories, new_categories, source, assessment_version)
    VALUES (p_profile, prev, coalesce(p_codes, '{}'), p_source, p_version);
  UPDATE public.fin_comparison_profiles SET categories_updated_at = now(), updated_at = now() WHERE id = p_profile;
END $$;
REVOKE ALL ON FUNCTION public.fin_set_profile_categories(text, text[], text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fin_set_profile_categories(text, text[], text, text) TO service_role;

CREATE VIEW public.fin_profile_advisor_matches WITH (security_invoker = true) AS
  SELECT pc.profile_id, ac.advisor_id, array_agg(pc.category_code ORDER BY pc.category_code) AS shared_categories
    FROM public.fin_profile_categories pc
    JOIN public.fin_advisor_categories ac ON ac.category_code = pc.category_code
    JOIN public.fin_advisors a ON a.id = ac.advisor_id AND a.is_active
   GROUP BY pc.profile_id, ac.advisor_id;
GRANT SELECT ON public.fin_profile_advisor_matches TO authenticated, service_role;

-- ---------- Owner-scoped reads/writes (SECURITY INVOKER: RLS applies; owner = auth.uid()) ----------

-- Daily activity replaces the Timescale continuous aggregate: computed live from the authoritative table.
CREATE OR REPLACE FUNCTION public.fin_owner_daily_activity(p_start date, p_end date)
RETURNS TABLE (day date, txn_type text, category text, currency text, is_sample boolean, amount_cents bigint, txn_count int)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT t.txn_date, t.txn_type, t.category, t.currency, t.is_sample, sum(t.amount_cents)::bigint, count(*)::int
    FROM public.fin_transactions t
   WHERE auth.uid() IS NOT NULL AND t.user_id = auth.uid() AND t.txn_date >= p_start AND t.txn_date <= p_end
   GROUP BY 1, 2, 3, 4, 5
$$;

-- Sign-in bootstrap: settings + accounts + holdings + transactions + overrides + quiz, one consistent snapshot.
CREATE OR REPLACE FUNCTION public.fin_read_session() RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'settings', (SELECT to_jsonb(s) FROM (SELECT risk_inputs, savings_settings, date_range, transaction_source FROM public.fin_user_settings WHERE user_id = auth.uid()) s),
    'accts', COALESCE((SELECT jsonb_agg(to_jsonb(a) ORDER BY a.created_at, a.id) FROM public.fin_financial_accounts a WHERE a.user_id = auth.uid()), '[]'),
    'holds', COALESCE((SELECT jsonb_agg(to_jsonb(h) || jsonb_build_object('quantity', h.quantity::text, 'latest_price', h.latest_price::text) ORDER BY h.id)
      FROM public.fin_investment_holdings h WHERE h.user_id = auth.uid()), '[]'),
    'txns', COALESCE((SELECT jsonb_agg(to_jsonb(t) || jsonb_build_object('d', to_char(t.txn_date, 'YYYY-MM-DD')) ORDER BY t.txn_date, t.id)
      FROM public.fin_transactions t WHERE t.user_id = auth.uid()), '[]'),
    'ovr', COALESCE((SELECT jsonb_agg(jsonb_build_object('series_key', r.series_key, 'detection', r.detection, 'review', r.review))
      FROM public.fin_recurring_overrides r WHERE r.user_id = auth.uid()), '[]'),
    'quiz', (SELECT to_jsonb(q) FROM (SELECT status, answers, completed_at FROM public.fin_onboarding_quiz WHERE user_id = auth.uid()) q))
  WHERE auth.uid() IS NOT NULL
$$;

-- Atomic save of the owner's state; data sections are optional (omitted when unchanged). Returns whether transactions changed.
CREATE OR REPLACE FUNCTION public.fin_save_state(p jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); n_removed int := 0; n_changed int := 0; src text := p->>'transactionSource';
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  INSERT INTO public.fin_user_settings (user_id, risk_inputs, savings_settings, date_range, transaction_source, updated_at)
  VALUES (uid, p->'manual', p->'savings', CASE WHEN jsonb_typeof(p->'range') = 'object' THEN p->'range' END, src, now())
  ON CONFLICT (user_id) DO UPDATE SET risk_inputs = EXCLUDED.risk_inputs, savings_settings = EXCLUDED.savings_settings,
    date_range = EXCLUDED.date_range, transaction_source = EXCLUDED.transaction_source, updated_at = now();

  IF p ? 'accounts' AND p ? 'holdings' THEN
    DELETE FROM public.fin_investment_holdings WHERE user_id = uid
      AND NOT (id = ANY (ARRAY(SELECT e->>'id' FROM jsonb_array_elements(p->'holdings') e)));
    DELETE FROM public.fin_financial_accounts WHERE user_id = uid
      AND NOT (id = ANY (ARRAY(SELECT e->>'id' FROM jsonb_array_elements(p->'accounts') e)));
    INSERT INTO public.fin_financial_accounts (user_id, id, name, account_type, institution, currency, cash_cents, valuation_timestamp, source)
    SELECT uid, x.id, x.name, x.type, x.institution, x.currency, x."cashCents", x."valuationTimestamp", x.source
      FROM jsonb_to_recordset(p->'accounts') AS x(id text, name text, type text, institution text, currency text, "cashCents" bigint, "valuationTimestamp" text, source text)
    ON CONFLICT (user_id, id) DO UPDATE SET name = EXCLUDED.name, account_type = EXCLUDED.account_type, institution = EXCLUDED.institution,
      currency = EXCLUDED.currency, cash_cents = EXCLUDED.cash_cents, valuation_timestamp = EXCLUDED.valuation_timestamp, source = EXCLUDED.source;
    INSERT INTO public.fin_investment_holdings (user_id, id, account_id, symbol, external_security_id, name, asset_class, quantity, latest_price,
      price_timestamp, supplied_value_cents, supplied_value_date, cost_basis_cents, sector, underlying_exposure, source)
    SELECT uid, x.id, x."accountId", x.symbol, x."externalSecurityId", x.name, x."assetClass", x.quantity, x."latestPrice", x."priceTimestamp",
      x."suppliedValueCents", x."suppliedValueDate", x."costBasisCents", x.sector, x."underlyingExposure", x.source
      FROM jsonb_to_recordset(p->'holdings') AS x(id text, "accountId" text, symbol text, "externalSecurityId" text, name text, "assetClass" text,
        quantity numeric, "latestPrice" numeric, "priceTimestamp" text, "suppliedValueCents" bigint, "suppliedValueDate" text,
        "costBasisCents" bigint, sector text, "underlyingExposure" text, source text)
    ON CONFLICT (user_id, id) DO UPDATE SET account_id = EXCLUDED.account_id, symbol = EXCLUDED.symbol,
      external_security_id = EXCLUDED.external_security_id, name = EXCLUDED.name, asset_class = EXCLUDED.asset_class,
      quantity = EXCLUDED.quantity, latest_price = EXCLUDED.latest_price, price_timestamp = EXCLUDED.price_timestamp,
      supplied_value_cents = EXCLUDED.supplied_value_cents, supplied_value_date = EXCLUDED.supplied_value_date,
      cost_basis_cents = EXCLUDED.cost_basis_cents, sector = EXCLUDED.sector, underlying_exposure = EXCLUDED.underlying_exposure, source = EXCLUDED.source;
  END IF;

  IF p ? 'recurringOverrides' THEN
    DELETE FROM public.fin_recurring_overrides WHERE user_id = uid
      AND NOT (series_key = ANY (ARRAY(SELECT k FROM jsonb_object_keys(p->'recurringOverrides') k)));
    INSERT INTO public.fin_recurring_overrides (user_id, series_key, detection, review)
    SELECT uid, e.key, e.value->>'detection', e.value->>'review' FROM jsonb_each(p->'recurringOverrides') e
    ON CONFLICT (user_id, series_key) DO UPDATE SET detection = EXCLUDED.detection, review = EXCLUDED.review;
  END IF;

  IF NOT (p ? 'transactions') THEN RETURN jsonb_build_object('transactionsChanged', false); END IF;

  WITH inc AS (SELECT x.id FROM jsonb_to_recordset(p->'transactions') AS x(id text)),
       del AS (DELETE FROM public.fin_transactions t WHERE t.user_id = uid AND NOT EXISTS (SELECT 1 FROM inc WHERE inc.id = t.id) RETURNING 1)
  SELECT count(*) INTO n_removed FROM del;

  WITH inc AS (
    SELECT * FROM jsonb_to_recordset(p->'transactions') AS x(id text, date date, merchant text, amount bigint, type text, category text,
      "categorySource" text, description text, "accountId" text, "linkedAccountId" text)),
  up AS (
    INSERT INTO public.fin_transactions (user_id, id, txn_date, merchant, amount_cents, txn_type, category, category_source, description,
      account_id, linked_account_id, source, is_sample)
    SELECT uid, i.id, i.date, i.merchant, i.amount, i.type, i.category, i."categorySource", coalesce(i.description, ''), i."accountId",
      i."linkedAccountId", src, src = 'sample'
      FROM inc i LEFT JOIN public.fin_transactions t ON t.user_id = uid AND t.id = i.id
     WHERE t.id IS NULL OR t.txn_date IS DISTINCT FROM i.date OR t.merchant IS DISTINCT FROM i.merchant
        OR t.amount_cents IS DISTINCT FROM i.amount OR t.txn_type IS DISTINCT FROM i.type OR t.category IS DISTINCT FROM i.category
        OR t.category_source IS DISTINCT FROM i."categorySource" OR t.description IS DISTINCT FROM coalesce(i.description, '')
        OR t.account_id IS DISTINCT FROM i."accountId" OR t.linked_account_id IS DISTINCT FROM i."linkedAccountId"
    ON CONFLICT (user_id, id) DO UPDATE SET txn_date = EXCLUDED.txn_date, merchant = EXCLUDED.merchant, amount_cents = EXCLUDED.amount_cents,
      txn_type = EXCLUDED.txn_type, category = EXCLUDED.category, category_source = EXCLUDED.category_source,
      description = EXCLUDED.description, account_id = EXCLUDED.account_id, linked_account_id = EXCLUDED.linked_account_id, updated_at = now()
    RETURNING 1)
  SELECT count(*) INTO n_changed FROM up;

  IF n_removed + n_changed > 0 THEN
    DELETE FROM public.fin_transaction_category_overrides WHERE user_id = uid;
    INSERT INTO public.fin_transaction_category_overrides (user_id, txn_id, category)
    SELECT uid, x.id, x.category FROM jsonb_to_recordset(p->'transactions') AS x(id text, category text, "categorySource" text)
     WHERE x."categorySource" = 'manual';
  END IF;
  RETURN jsonb_build_object('transactionsChanged', n_removed + n_changed > 0);
END $$;

-- Analytics inputs in one call: bounds, score history, direct monthly buckets, and daily-summary buckets (monthly/weekly/categories).
-- Weeks start Monday (same as Timescale time_bucket('1 week')); months are calendar months; dates are calendar dates (no time-zone shift).
CREATE OR REPLACE FUNCTION public.fin_analytics(p_score_type text) RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  WITH own AS (SELECT * FROM public.fin_transactions WHERE auth.uid() IS NOT NULL AND user_id = auth.uid()),
  bnd AS (SELECT min(txn_date) AS s, max(txn_date) AS e FROM own),
  d AS (SELECT * FROM public.fin_owner_daily_activity((SELECT s FROM bnd), (SELECT e FROM bnd)) WHERE currency = 'USD')
  SELECT jsonb_build_object(
    'b', (SELECT to_jsonb(x) FROM (SELECT to_char(min(txn_date),'YYYY-MM-DD') AS s, to_char(max(txn_date),'YYYY-MM-DD') AS e,
          bool_or(is_sample) AS sample, array_remove(array_agg(DISTINCT CASE WHEN currency <> 'USD' THEN currency END), NULL) AS other,
          max(updated_at) AS upd FROM own) x),
    'history', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', id::text, 'ps', to_char(period_start,'YYYY-MM-DD'), 'pe', to_char(period_end,'YYYY-MM-DD'),
          'score', score, 'status', status, 'factors', factors, 'metrics', metrics, 'methodology_version', methodology_version,
          'input_fingerprint', input_fingerprint, 'reconstructed', reconstructed, 'calculated_at', calculated_at, 'last_confirmed_at', last_confirmed_at)
          ORDER BY period_start, last_confirmed_at)
        FROM public.fin_wellness_score_history WHERE user_id = auth.uid() AND score_type = p_score_type), '[]'),
    'direct', COALESCE((SELECT jsonb_agg(to_jsonb(q) ORDER BY q.b) FROM (
        SELECT to_char(date_trunc('month', txn_date),'YYYY-MM-DD') AS b,
          sum(amount_cents) FILTER (WHERE txn_type = 'income') AS income, sum(amount_cents) FILTER (WHERE txn_type = 'expense') AS spending,
          sum(amount_cents) FILTER (WHERE txn_type = 'transfer') AS transfers, count(*) AS n
        FROM own WHERE currency = 'USD' GROUP BY 1) q), '[]'),
    'monthly', COALESCE((SELECT jsonb_agg(to_jsonb(q) ORDER BY q.b) FROM (
        SELECT to_char(date_trunc('month', day),'YYYY-MM-DD') AS b,
          sum(amount_cents) FILTER (WHERE txn_type = 'income') AS income, sum(amount_cents) FILTER (WHERE txn_type = 'expense') AS spending,
          sum(amount_cents) FILTER (WHERE txn_type = 'transfer') AS transfers, sum(txn_count) AS n
        FROM d GROUP BY 1) q), '[]'),
    'weekly', COALESCE((SELECT jsonb_agg(to_jsonb(q) ORDER BY q.b) FROM (
        SELECT to_char(date_trunc('week', day),'YYYY-MM-DD') AS b,
          sum(amount_cents) FILTER (WHERE txn_type = 'income') AS income, sum(amount_cents) FILTER (WHERE txn_type = 'expense') AS spending,
          sum(amount_cents) FILTER (WHERE txn_type = 'transfer') AS transfers, sum(txn_count) AS n
        FROM d GROUP BY 1) q), '[]'),
    'cats', COALESCE((SELECT jsonb_agg(to_jsonb(q)) FROM (
        SELECT to_char(date_trunc('month', day),'YYYY-MM-DD') AS b, category, sum(amount_cents) AS cents
        FROM d WHERE txn_type = 'expense' GROUP BY 1, 2) q), '[]'))
$$;

-- Score revisions: identical inputs never create a new row (only last_confirmed_at moves).
CREATE OR REPLACE FUNCTION public.fin_record_scores(p jsonb) RETURNS int
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); n int;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  INSERT INTO public.fin_wellness_score_history (user_id, score_type, period_start, period_end, score, status, factors, metrics,
    methodology_version, input_fingerprint, reconstructed)
  SELECT uid, x.score_type, x.period_start, x.period_end, x.score, x.status, x.factors, x.metrics, x.methodology_version, x.input_fingerprint, x.reconstructed
    FROM jsonb_to_recordset(p) AS x(score_type text, period_start date, period_end date, score int, status text, factors jsonb, metrics jsonb,
      methodology_version text, input_fingerprint text, reconstructed boolean)
  ON CONFLICT (user_id, score_type, period_start, methodology_version, input_fingerprint) DO UPDATE SET last_confirmed_at = now();
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;

-- Transactions used for scoring (USD only), returned as one JSON value (not subject to row limits).
CREATE OR REPLACE FUNCTION public.fin_score_inputs() RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object('id', id, 'd', to_char(txn_date,'YYYY-MM-DD'), 'merchant', merchant, 'amount_cents', amount_cents,
    'txn_type', txn_type, 'category', category, 'category_source', category_source, 'description', description, 'account_id', account_id)), '[]')
  FROM public.fin_transactions WHERE auth.uid() IS NOT NULL AND user_id = auth.uid() AND currency = 'USD'
$$;

-- Account deletion: removes every row owned by the caller (the quiz is not deletable by users directly).
CREATE OR REPLACE FUNCTION public.fin_delete_my_data() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  DELETE FROM public.fin_transaction_category_overrides WHERE user_id = uid;
  DELETE FROM public.fin_transactions WHERE user_id = uid;
  DELETE FROM public.fin_wellness_score_history WHERE user_id = uid;
  DELETE FROM public.fin_investment_holdings WHERE user_id = uid;
  DELETE FROM public.fin_financial_accounts WHERE user_id = uid;
  DELETE FROM public.fin_recurring_overrides WHERE user_id = uid;
  DELETE FROM public.fin_user_settings WHERE user_id = uid;
  DELETE FROM public.fin_onboarding_quiz WHERE user_id = uid;
  DELETE FROM public.fin_risk_survey WHERE user_id = uid;
  DELETE FROM public.fin_monte_carlo_runs WHERE user_id = uid;
  DELETE FROM public.fin_watchlist WHERE user_id = uid;
  DELETE FROM public.fin_user_profiles WHERE auth_user_id = uid::text;
END $$;

REVOKE ALL ON FUNCTION public.fin_owner_daily_activity(date, date), public.fin_read_session(), public.fin_save_state(jsonb),
  public.fin_analytics(text), public.fin_record_scores(jsonb), public.fin_score_inputs(), public.fin_delete_my_data() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fin_owner_daily_activity(date, date), public.fin_read_session(), public.fin_save_state(jsonb),
  public.fin_analytics(text), public.fin_record_scores(jsonb), public.fin_score_inputs(), public.fin_delete_my_data() TO authenticated, service_role;