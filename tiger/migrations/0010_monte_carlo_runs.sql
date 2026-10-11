-- Monte Carlo simulation runs (one row per run, owner-scoped).
-- config: validated MonteCarloInputs; results: MonteCarloResult. Both are model
-- estimates with disclosed assumptions — never guarantees of future wealth.
CREATE TABLE fin.monte_carlo_runs (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL,
  config jsonb NOT NULL,
  results jsonb NOT NULL,
  ran_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX monte_carlo_runs_user ON fin.monte_carlo_runs (user_id, ran_at DESC);

GRANT SELECT, INSERT ON fin.monte_carlo_runs TO fin_app;
GRANT USAGE ON SEQUENCE fin.monte_carlo_runs_id_seq TO fin_app;
ALTER TABLE fin.monte_carlo_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY owner_rw ON fin.monte_carlo_runs TO fin_app
  USING (user_id = fin.current_owner())
  WITH CHECK (user_id = fin.current_owner());
