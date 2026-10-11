-- Advance id sequences past the imported Tiger ids so new rows never collide.
SELECT setval('public.fin_wellness_score_history_id_seq', GREATEST((SELECT coalesce(max(id), 0) FROM public.fin_wellness_score_history), 1000));
SELECT setval('public.fin_monte_carlo_runs_id_seq', GREATEST((SELECT coalesce(max(id), 0) FROM public.fin_monte_carlo_runs), 1000));
SELECT setval('public.fin_profile_category_history_id_seq', GREATEST((SELECT coalesce(max(id), 0) FROM public.fin_profile_category_history), 1000));