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
    const { withOwner } = await import("@/lib/tiger.server");
    return withOwner(context.userId, async (tx) => {
      const [r] = await tx<any[]>`SELECT answers, target_profile, updated_at FROM fin.risk_survey WHERE user_id = ${context.userId}`;
      if (!r) return { answers: {}, targetProfile: null, updatedAt: null };
      return {
        answers: sanitizeSurveyAnswers(r.answers),
        targetProfile: (r.target_profile as TargetProfile | null) ?? null,
        updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : null,
      };
    });
  });

/** Saves the extended survey (editable at any time) and stores the derived target profile. */
export const saveRiskSurvey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(answersInput)
  .handler(async ({ data, context }): Promise<{ ok: true; missing: number[]; targetProfile: TargetProfile }> => {
    const targetProfile = deriveTargetProfile(data.answers);
    const { withOwner } = await import("@/lib/tiger.server");
    await withOwner(context.userId, async (tx) => {
      await tx`INSERT INTO fin.risk_survey (user_id, survey_version, answers, target_profile)
        VALUES (${context.userId}, ${SURVEY_VERSION}, ${tx.json(data.answers)}, ${tx.json(targetProfile as any)})
        ON CONFLICT (user_id) DO UPDATE SET answers = EXCLUDED.answers, target_profile = EXCLUDED.target_profile, updated_at = now()`;
    });
    return { ok: true, missing: missingSurveyQuestions(data.answers), targetProfile };
  });
