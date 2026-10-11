-- Extended financial assessment survey (one editable row per user).
-- Complements the immutable onboarding quiz: answers here may be updated at any time.
-- answers: {"s01_current_age": "s01_c", ...} using stable question/answer ids (src/lib/risk/survey.ts).
-- target_profile: derived attributes (src/lib/risk/survey.ts deriveTargetProfile), recomputed on each save.
-- NULL target_profile = not enough answers to derive; never treat missing data as zero.
CREATE TABLE fin.risk_survey (
  user_id uuid PRIMARY KEY,
  survey_version text NOT NULL,
  answers jsonb NOT NULL DEFAULT '{}',
  target_profile jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON fin.risk_survey TO fin_app;
ALTER TABLE fin.risk_survey ENABLE ROW LEVEL SECURITY;
CREATE POLICY owner_rw ON fin.risk_survey TO fin_app
  USING (user_id = fin.current_owner())
  WITH CHECK (user_id = fin.current_owner());
