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
    const { withOwner } = await import("./tiger.server");
    return withOwner(context.userId, async (tx) => {
      const [survey] = await tx<any[]>`SELECT answers FROM fin.risk_survey WHERE user_id = ${context.userId}`;
      if (!survey) return { status: "no_survey", userCategories: [], categoryLabels: {}, matches: [] };
      const userCategories = deriveUserCategories(sanitizeSurveyAnswers(survey.answers));

      const labels = await tx<any[]>`SELECT code, label FROM fin.financial_categories`;
      const categoryLabels = Object.fromEntries(labels.map((r) => [r.code, r.label]));

      const advisors = await tx<any[]>`
        SELECT a.id, a.full_name, a.title, a.biography, a.experience, a.education,
               a.certifications, a.strengths, a.advisory_style, a.best_suited_for, a.meeting_format,
               coalesce(json_agg(json_build_object('code', c.category_code, 'role', c.role))
                        FILTER (WHERE c.category_code IS NOT NULL), '[]') AS categories
        FROM fin.advisors a
        LEFT JOIN fin.advisor_categories c ON c.advisor_id = a.id
        WHERE a.is_active
        GROUP BY a.id`;
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
    });
  });
