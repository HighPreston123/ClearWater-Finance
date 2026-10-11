/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { QUIZ_VERSION, missingQuestions, sanitizeAnswers, type QuizAnswers } from "@/lib/onboarding/quiz";

export interface OnboardingState { status: "not_started" | "in_progress" | "completed"; answers: QuizAnswers; completedAt: string | null }

const answersInput = (input: { answers: unknown }) => ({ answers: sanitizeAnswers(input?.answers) });

/** Rows are owner-scoped by RLS (user_id = auth.uid()); a completed quiz is locked by a database trigger. */
async function readQuiz(db: any, userId: string) {
  const { check } = await import("@/lib/db.server");
  return check(await db.from("fin_onboarding_quiz").select("status, answers, completed_at").eq("user_id", userId).maybeSingle(), "quiz_read") as any;
}

export const getOnboardingState = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<OnboardingState> => {
    const r = await readQuiz(context.supabase, context.userId);
    if (!r) return { status: "not_started", answers: {}, completedAt: null };
    return { status: r.status, answers: sanitizeAnswers(r.answers), completedAt: r.completed_at ? new Date(r.completed_at).toISOString() : null };
  });

/** Saves partial progress (one row per user; upsert never duplicates). No-op once completed. */
export const saveOnboardingProgress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(answersInput)
  .handler(async ({ data, context }) => {
    const existing = await readQuiz(context.supabase, context.userId);
    if (existing?.status === "completed") return { ok: true };
    const { check } = await import("@/lib/db.server");
    check(await context.supabase.from("fin_onboarding_quiz").upsert(
      { user_id: context.userId, quiz_version: QUIZ_VERSION, answers: data.answers as any, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }), "quiz_progress");
    return { ok: true };
  });

/** Final submission: all 20 answers required; marks completed exactly once. */
export const completeOnboarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(answersInput)
  .handler(async ({ data, context }): Promise<{ status: "completed" } | { status: "missing"; missing: number[] }> => {
    const missing = missingQuestions(data.answers);
    if (missing.length) return { status: "missing", missing };
    const existing = await readQuiz(context.supabase, context.userId);
    if (existing?.status === "completed") return { status: "completed" };
    const { check } = await import("@/lib/db.server");
    const now = new Date().toISOString();
    check(await context.supabase.from("fin_onboarding_quiz").upsert(
      { user_id: context.userId, quiz_version: QUIZ_VERSION, answers: data.answers as any, status: "completed", completed_at: now, updated_at: now },
      { onConflict: "user_id" }), "quiz_complete");
    return { status: "completed" };
  });
