/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  SURVEY_VERSION,
  missingSurveyQuestions,
  sanitizeSurveyAnswers,
  deriveTargetProfile,
  type SurveyAnswers,
  type TargetProfile,
} from "@/lib/risk/survey";

export interface RiskSurveyState {
  answers: SurveyAnswers;
  targetProfile: TargetProfile | null;
  updatedAt: string | null;
}

const answersInput = (input: { answers: unknown }) => ({ answers: sanitizeSurveyAnswers(input?.answers) });

export const getRiskSurvey = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<RiskSurveyState> => {
    const { check } = await import("@/lib/db.server");
    const r = check(await context.supabase.from("fin_risk_survey").select("answers, target_profile, updated_at")
      .eq("user_id", context.userId).maybeSingle(), "survey_read") as any;
    if (!r) return { answers: {}, targetProfile: null, updatedAt: null };
    return {
      answers: sanitizeSurveyAnswers(r.answers),
      targetProfile: (r.target_profile as TargetProfile | null) ?? null,
      updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : null,
    };
  });

/** Saves the extended survey (editable at any time) and stores the derived target profile. */
export const saveRiskSurvey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(answersInput)
  .handler(async ({ data, context }): Promise<{ ok: true; missing: number[]; targetProfile: TargetProfile }> => {
    const targetProfile = deriveTargetProfile(data.answers);
    const { check } = await import("@/lib/db.server");
    check(await context.supabase.from("fin_risk_survey").upsert({
      user_id: context.userId, survey_version: SURVEY_VERSION, answers: data.answers as any, target_profile: targetProfile as any,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" }), "survey_save");
    return { ok: true, missing: missingSurveyQuestions(data.answers), targetProfile };
  });
