-- Reference data: advisor directory, fictional comparison population, and the shared
-- category framework. No risk methodology lives here: score/status fields are nullable
-- placeholders written only by the future risk-assessment system.

-- Shared, structured category vocabulary (advisors and people use the same codes).
CREATE TABLE fin.financial_categories (
  code text PRIMARY KEY CHECK (code ~ '^[a-z_]+$'),
  label text NOT NULL UNIQUE,
  description text NOT NULL
);
INSERT INTO fin.financial_categories (code, label, description) VALUES
  ('budgeting', 'Budgeting', 'Planning and tracking spending against income'),
  ('cash_flow', 'Cash flow', 'Timing of income versus bills and spending'),
  ('saving', 'Saving', 'Building regular savings habits'),
  ('emergency_funds', 'Emergency funds', 'Reserves for unexpected expenses'),
  ('debt_management', 'Debt management', 'Organizing and paying down debt'),
  ('investing', 'Investing & portfolios', 'Investment accounts and diversification'),
  ('retirement_planning', 'Retirement planning', 'Retirement accounts and long-horizon saving'),
  ('risk_management', 'Risk management', 'Insurance and protection against financial shocks'),
  ('financial_education', 'Financial education', 'Learning core money concepts'),
  ('wealth_building', 'Wealth building', 'Growing net worth over time'),
  ('long_term_planning', 'Long-term planning', 'Multi-year financial plans'),
  ('goal_setting', 'Goal setting', 'Defining and prioritizing financial goals')
ON CONFLICT (code) DO NOTHING;

-- Advisors (all fictional demo profiles).
CREATE TABLE fin.advisors (
  id text PRIMARY KEY,
  full_name text NOT NULL UNIQUE,
  title text NOT NULL,
  biography text NOT NULL,
  experience text NOT NULL,
  education text,
  certifications text[] NOT NULL DEFAULT '{}',
  strengths text[] NOT NULL DEFAULT '{}',
  advisory_style text NOT NULL,
  best_suited_for text[] NOT NULL DEFAULT '{}',
  meeting_format text CHECK (meeting_format IN ('virtual','in_person','hybrid')),
  nessie_customer_id text UNIQUE,
  is_fictional boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Static advisor categories. Changes require an explicit admin session flag.
CREATE TABLE fin.advisor_categories (
  advisor_id text NOT NULL REFERENCES fin.advisors(id) ON DELETE CASCADE,
  category_code text NOT NULL REFERENCES fin.financial_categories(code),
  role text NOT NULL CHECK (role IN ('primary','secondary')),
  assigned_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (advisor_id, category_code)
);
CREATE UNIQUE INDEX advisor_one_primary ON fin.advisor_categories (advisor_id) WHERE role = 'primary';

CREATE OR REPLACE FUNCTION fin.guard_advisor_categories() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF coalesce(current_setting('app.advisor_admin', true), '') <> 'on' THEN
    RAISE EXCEPTION 'advisor categories are static; set app.advisor_admin=on for an authorized admin edit';
  END IF;
  RETURN coalesce(NEW, OLD);
END $$;
CREATE TRIGGER advisor_categories_static BEFORE INSERT OR UPDATE OR DELETE ON fin.advisor_categories
  FOR EACH ROW EXECUTE FUNCTION fin.guard_advisor_categories();

-- Fictional comparison population — separate from real customers (no user_id).
CREATE TABLE fin.comparison_profiles (
  id text PRIMARY KEY,
  full_name text NOT NULL,
  age_band text,
  household text,
  occupation text,
  financial_background text NOT NULL,
  annual_income_cents bigint,
  income_stability text,
  monthly_spending_cents bigint,
  spending_pattern text,
  savings_cents bigint,
  monthly_savings_cents bigint,
  debt_cents bigint,
  debt_breakdown jsonb NOT NULL DEFAULT '{}',
  investments_cents bigint,
  investment_experience text,
  financial_goals text[] NOT NULL DEFAULT '{}',
  recent_activity jsonb NOT NULL DEFAULT '[]',
  data_source jsonb NOT NULL DEFAULT '{"financials":"synthetic_demo"}',
  nessie_customer_id text UNIQUE,
  comparison_subset text,
  -- Future risk-assessment outputs. NULL = not yet calculated; never treat as 0.
  overview_score numeric,
  risk_assessment_status text NOT NULL DEFAULT 'pending'
    CHECK (risk_assessment_status IN ('pending','assessed','insufficient_data','error')),
  assessment_version text,
  last_assessed_at timestamptz,
  categories_updated_at timestamptz,
  is_fictional boolean NOT NULL DEFAULT true CHECK (is_fictional),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (overview_score IS NULL OR risk_assessment_status = 'assessed')
);
CREATE INDEX comparison_scored ON fin.comparison_profiles (comparison_subset) WHERE overview_score IS NOT NULL;

-- Current (dynamic) person categories, many per person.
CREATE TABLE fin.profile_categories (
  profile_id text NOT NULL REFERENCES fin.comparison_profiles(id) ON DELETE CASCADE,
  category_code text NOT NULL REFERENCES fin.financial_categories(code),
  source text NOT NULL,               -- e.g. 'risk_assessment', 'admin'
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','provisional')),
  assessment_version text,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (profile_id, category_code)
);

-- Append-only assignment history.
CREATE TABLE fin.profile_category_history (
  id bigserial PRIMARY KEY,
  profile_id text NOT NULL REFERENCES fin.comparison_profiles(id) ON DELETE CASCADE,
  previous_categories text[] NOT NULL,
  new_categories text[] NOT NULL,
  source text NOT NULL,
  assessment_version text,
  changed_at timestamptz NOT NULL DEFAULT now()
);

-- Integration point for the future assessment system: atomically replace a person's categories.
CREATE OR REPLACE FUNCTION fin.set_profile_categories(p_profile text, p_codes text[], p_source text, p_version text)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE prev text[];
BEGIN
  SELECT coalesce(array_agg(category_code ORDER BY category_code), '{}') INTO prev
    FROM fin.profile_categories WHERE profile_id = p_profile;
  DELETE FROM fin.profile_categories WHERE profile_id = p_profile;
  INSERT INTO fin.profile_categories (profile_id, category_code, source, assessment_version)
    SELECT p_profile, c, p_source, p_version FROM unnest(coalesce(p_codes, '{}')) AS c;
  INSERT INTO fin.profile_category_history (profile_id, previous_categories, new_categories, source, assessment_version)
    VALUES (p_profile, prev, coalesce(p_codes, '{}'), p_source, p_version);
  UPDATE fin.comparison_profiles SET categories_updated_at = now(), updated_at = now() WHERE id = p_profile;
END $$;

-- Matching reads only: advisors sharing >= 1 category with a person, plus the shared codes.
CREATE OR REPLACE VIEW fin.profile_advisor_matches AS
  SELECT pc.profile_id, ac.advisor_id, array_agg(pc.category_code ORDER BY pc.category_code) AS shared_categories
  FROM fin.profile_categories pc
  JOIN fin.advisor_categories ac ON ac.category_code = pc.category_code
  JOIN fin.advisors a ON a.id = ac.advisor_id AND a.is_active
  GROUP BY pc.profile_id, ac.advisor_id;

-- Reference data is non-owner; the app role may read it but never write it.
GRANT SELECT ON fin.financial_categories, fin.advisors, fin.advisor_categories,
  fin.comparison_profiles, fin.profile_categories, fin.profile_category_history,
  fin.profile_advisor_matches TO fin_app;
