CREATE OR REPLACE FUNCTION public.fin_mfa_ok()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT coalesce(auth.jwt()->>'aal', '') = 'aal2'
    OR NOT EXISTS (
      SELECT 1 FROM auth.mfa_factors f
      WHERE f.user_id = auth.uid() AND f.status = 'verified'
    )
$$;
REVOKE ALL ON FUNCTION public.fin_mfa_ok() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fin_mfa_ok() TO authenticated, service_role;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'fin_financial_accounts','fin_investment_holdings','fin_monte_carlo_runs','fin_onboarding_quiz',
    'fin_recurring_overrides','fin_risk_survey','fin_transaction_category_overrides','fin_transactions',
    'fin_user_profiles','fin_user_settings','fin_watchlist','fin_wellness_score_history','profiles','user_state'
  ] LOOP
    EXECUTE format('CREATE POLICY mfa_required ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (public.fin_mfa_ok()) WITH CHECK (public.fin_mfa_ok())', t);
  END LOOP;
END $$;