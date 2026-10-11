-- One onboarding quiz record per user. Stores answers only — no scoring of any kind.
-- answers: {"q01_primary_goal": "q01_c", ...} using stable question/answer ids (src/lib/onboarding/quiz.ts).
CREATE TABLE fin.onboarding_quiz (
  user_id uuid PRIMARY KEY,
  quiz_version text NOT NULL,
  answers jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress','completed')),
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((status = 'completed') = (completed_at IS NOT NULL))
);

-- Completed quizzes are immutable: one-time completion is enforced by the database.
CREATE OR REPLACE FUNCTION fin.guard_onboarding_quiz() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status = 'completed' THEN
    RAISE EXCEPTION 'onboarding quiz already completed';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER onboarding_quiz_once BEFORE UPDATE ON fin.onboarding_quiz
  FOR EACH ROW EXECUTE FUNCTION fin.guard_onboarding_quiz();

GRANT SELECT, INSERT, UPDATE ON fin.onboarding_quiz TO fin_app;
ALTER TABLE fin.onboarding_quiz ENABLE ROW LEVEL SECURITY;
CREATE POLICY owner_rw ON fin.onboarding_quiz TO fin_app
  USING (user_id = fin.current_owner())
  WITH CHECK (user_id = fin.current_owner());
