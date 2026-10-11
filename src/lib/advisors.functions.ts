/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { sanitizeSurveyAnswers } from "@/lib/risk/survey";
import { deriveUserCategories, rankAdvisors, type AdvisorMatch } from "@/lib/risk/advisorMatch";

export interface AdvisorMatchResponse {
  status: "ok" | "no_survey" | "no_matches";
  userCategories: string[];
  categoryLabels: Record<string, string>;
  matches: AdvisorMatch[];
}

/**
 * Matches the signed-in user against the advisor directory using the shared
 * category vocabulary. Read-only: matching never writes categories or scores.
 */
export const getAdvisorMatches = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdvisorMatchResponse> => {
    const { assertMfa } = await import("./mfa.server");
    await assertMfa(context);
    const { check } = await import("./db.server");
    const db = context.supabase;
    {
      const survey = check(await db.from("fin_risk_survey").select("answers").eq("user_id", context.userId).maybeSingle(), "survey_read") as any;
      if (!survey) return { status: "no_survey", userCategories: [], categoryLabels: {}, matches: [] };
      const userCategories = deriveUserCategories(sanitizeSurveyAnswers(survey.answers));

      const labels = (check(await db.from("fin_financial_categories").select("code, label"), "categories_read") ?? []) as any[];
      const categoryLabels = Object.fromEntries(labels.map((r) => [r.code, r.label]));

      const rows = (check(await db.from("fin_advisors").select("id, full_name, title, biography, experience, education, certifications, strengths, advisory_style, best_suited_for, meeting_format, fin_advisor_categories(category_code, role)").eq("is_active", true), "advisors_read") ?? []) as any[];
      const advisors = rows.map((r) => ({ ...r, categories: (r.fin_advisor_categories ?? []).map((c: any) => ({ code: c.category_code, role: c.role })) }));
      const records = advisors.map((r) => ({
        id: r.id,
        fullName: r.full_name,
        title: r.title,
        biography: r.biography,
        experience: r.experience,
        education: r.education ?? null,
        certifications: r.certifications ?? [],
        strengths: r.strengths ?? [],
        advisoryStyle: r.advisory_style,
        bestSuitedFor: r.best_suited_for ?? [],
        meetingFormat: r.meeting_format ?? null,
        categories: (r.categories as { code: string; role: "primary" | "secondary" }[]) ?? [],
      }));

      const matches = rankAdvisors(records, userCategories, 5);
      return {
        status: matches.length ? "ok" : "no_matches",
        userCategories,
        categoryLabels,
        matches,
      };
    }
  });
