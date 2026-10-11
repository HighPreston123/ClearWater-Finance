CREATE TABLE public.fin_user_need_categories (
  user_id uuid NOT NULL,
  category_code text NOT NULL REFERENCES public.fin_financial_categories(code),
  kind text NOT NULL DEFAULT 'need' CHECK (kind IN ('need','strength')),
  source text NOT NULL,
  assessment_version text,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, category_code, kind)
);
GRANT SELECT ON public.fin_user_need_categories TO authenticated;
GRANT ALL ON public.fin_user_need_categories TO service_role;
ALTER TABLE public.fin_user_need_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners read their current needs" ON public.fin_user_need_categories
  FOR SELECT TO authenticated USING (user_id = auth.uid() AND public.fin_mfa_ok());