/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { QUIZ_VERSION, missingQuestions, sanitizeAnswers, type QuizAnswers } from "@/lib/onboarding/quiz";

export interface OnboardingState { status: "not_started" | "in_progress" | "completed"; answers: QuizAnswers; completedAt: string | null }

const answersInput = (input: { answers: unknown }) => ({ answers: sanitizeAnswers(input?.answers) });

export const getOnboardingState = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<OnboardingState> => {
    const { withOwner } = await import("@/lib/tiger.server");
    return withOwner(context.userId, async (tx) => {
      const [r] = await tx<any[]>`SELECT status, answers, completed_at FROM fin.onboarding_quiz WHERE user_id = ${context.userId}`;
      if (!r) return { status: "not_started", answers: {}, completedAt: null };
      return { status: r.status, answers: sanitizeAnswers(r.answers), completedAt: r.completed_at ? new Date(r.completed_at).toISOString() : null };
    });
  });

/** Saves partial progress (one row per user; upsert never duplicates). No-op once completed. */
export const saveOnboardingProgress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(answersInput)
  .handler(async ({ data, context }) => {
    const { withOwner } = await import("@/lib/tiger.server");
    await withOwner(context.userId, async (tx) => {
      await tx`INSERT INTO fin.onboarding_quiz (user_id, quiz_version, answers)
        VALUES (${context.userId}, ${QUIZ_VERSION}, ${tx.json(data.answers)})
        ON CONFLICT (user_id) DO UPDATE SET answers = EXCLUDED.answers, updated_at = now()
        WHERE fin.onboarding_quiz.status = 'in_progress'`;
    });
    return { ok: true };
  });

/** Final submission: all 20 answers required; marks completed exactly once. */
export const completeOnboarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(answersInput)
  .handler(async ({ data, context }): Promise<{ status: "completed" } | { status: "missing"; missing: number[] }> => {
    const missing = missingQuestions(data.answers);
    if (missing.length) return { status: "missing", missing };
    const { withOwner } = await import("@/lib/tiger.server");
    await withOwner(context.userId, async (tx) => {
      await tx`INSERT INTO fin.onboarding_quiz (user_id, quiz_version, answers, status, completed_at)
        VALUES (${context.userId}, ${QUIZ_VERSION}, ${tx.json(data.answers)}, 'completed', now())
        ON CONFLICT (user_id) DO UPDATE SET answers = EXCLUDED.answers, status = 'completed', completed_at = now(), updated_at = now()
        WHERE fin.onboarding_quiz.status = 'in_progress'`;
    });
    return { status: "completed" };
  });
