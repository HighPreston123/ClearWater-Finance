/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServerFn } from "@tanstack/react-start";
import { requireAuthWithMfa } from "@/lib/mfa-middleware";
import type { UserAssessmentOutputs } from "@/lib/advisors/personalMatch";

/**
 * Reads the user's CURRENT assessment outputs (quiz status + needs/strengths) for advisor
 * recommendations. Read-only: needs are written only by the assessment system (server-side).
 */
export const getMyAssessmentOutputs = createServerFn({ method: "GET" })
  .middleware([requireAuthWithMfa])
  .handler(async ({ context }): Promise<{ outputs: UserAssessmentOutputs; labels: Record<string, string> }> => {
    const { check } = await import("@/lib/db.server");
    const db = context.supabase;
    const [quiz, needs, cats] = await Promise.all([
      db.from("fin_onboarding_quiz").select("status").eq("user_id", context.userId).maybeSingle(),
      db.from("fin_user_need_categories").select("category_code, kind, assessment_version, assigned_at").eq("user_id", context.userId),
      db.from("fin_financial_categories").select("code, label"),
    ]);
    const q = check(quiz, "quiz_status") as any;
    const rows = (check(needs, "needs_read") ?? []) as any[];
    const labels = Object.fromEntries(((check(cats, "categories_read") ?? []) as any[]).map((r) => [r.code, r.label]));
    return {
      labels,
      outputs: {
        quizStatus: q?.status ?? "not_started",
        needs: rows.filter((r) => r.kind === "need").map((r) => r.category_code).sort(),
        strengths: rows.filter((r) => r.kind === "strength").map((r) => r.category_code).sort(),
        assessmentVersion: rows[0]?.assessment_version ?? null,
        updatedAt: rows.map((r) => r.assigned_at).sort().pop() ?? null,
      },
    };
  });
