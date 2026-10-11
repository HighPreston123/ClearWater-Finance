import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { PersistedState } from "@/services/storage/storageAdapter";
import type { OnboardingState } from "./onboarding.functions";

/**
 * Server-backed persistence of each signed-in user's financial state in the app database.
 * Queries run with the caller's verified session (RLS: user_id = auth.uid()), never with client-supplied ids.
 * If the user has a verified MFA factor, the session must be at aal2.
 */

const assertMfa = async (context: unknown) => (await import("./mfa.server")).assertMfa(context);

const stateSchema = z.object({
  version: z.literal(1),
  transactions: z.array(z.object({
    id: z.string().max(200), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), merchant: z.string().max(500),
    amount: z.number().int(), type: z.string().max(50), category: z.string().max(100),
    categorySource: z.enum(["rule", "manual"]), description: z.string().max(2000),
    accountId: z.string().max(200), linkedAccountId: z.string().max(200).optional(),
  })).max(50000),
  recurringOverrides: z.record(z.string().max(500), z.object({ detection: z.string().optional(), review: z.string().optional() })),
  accounts: z.array(z.object({
    id: z.string().max(200), name: z.string().max(300), type: z.string().max(50), institution: z.string().max(300).optional(),
    currency: z.literal("USD"), cashCents: z.number().int(), valuationTimestamp: z.string().max(100), source: z.string().max(20),
  })).max(500),
  holdings: z.array(z.object({
    id: z.string().max(200), accountId: z.string().max(200), symbol: z.string().max(50).nullable(),
    externalSecurityId: z.string().max(200).optional(), name: z.string().max(300), assetClass: z.string().max(50),
    quantity: z.string().regex(/^-?\d+(\.\d+)?$/), latestPrice: z.string().regex(/^-?\d+(\.\d+)?$/).nullable(),
    priceTimestamp: z.string().max(100).nullable(), suppliedValueCents: z.number().int().nullable().optional(),
    suppliedValueDate: z.string().max(100).nullable().optional(), costBasisCents: z.number().int().nullable().optional(),
    sector: z.string().max(200).optional(), underlyingExposure: z.string().max(300).optional(), source: z.string().max(20),
  })).max(5000),
  manual: z.record(z.string(), z.unknown()),
  savings: z.object({ subscriptionsPct: z.number(), diningPct: z.number(), shoppingPct: z.number() }),
  range: z.object({ start: z.string(), end: z.string() }).nullable(),
  transactionSource: z.enum(["sample", "nessie", "csv"]),
});

export const loadUserState = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ data: PersistedState } | null> => {
    const { withMfaRead } = await import("./mfa.server");
    const { readOwnerState } = await import("./db.server");
    const data = await withMfaRead(context, () => readOwnerState(context.supabase));
    return data ? { data: JSON.parse(JSON.stringify(data)) } : null;
  });

/** Sign-in bootstrap: saved state + onboarding status from ONE database request (shared by the auth gate and the store). */
export const loadSession = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { withMfaRead } = await import("./mfa.server");
    const { readOwnerSession } = await import("./db.server");
    const { sanitizeAnswers } = await import("./onboarding/quiz");
    const { state, quiz } = await withMfaRead(context, () => readOwnerSession(context.supabase));
    const onboarding: OnboardingState = quiz
      ? { status: quiz.status, answers: sanitizeAnswers(quiz.answers), completedAt: quiz.completed_at ? new Date(quiz.completed_at).toISOString() : null }
      : { status: "not_started", answers: {}, completedAt: null };
    return { data: state ? (JSON.parse(JSON.stringify(state)) as PersistedState) : null, onboarding };
  });

// Data sections are optional: the client omits sections unchanged since its last successful save.
// accounts and holdings must arrive together (holdings reference accounts).
const patchSchema = stateSchema
  .partial({ transactions: true, recurringOverrides: true, accounts: true, holdings: true })
  .refine((s) => (s.accounts === undefined) === (s.holdings === undefined), "accounts and holdings must be sent together");

export const saveUserState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => patchSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertMfa(context);
    const { writeState } = await import("./db.server");
    const { transactionsChanged } = await writeState(context.supabase, data as unknown as import("./db.server").StatePatch);
    // Analytics and scores depend only on transactions — skip the rescore when none changed.
    if (!transactionsChanged) return { ok: true as const, analytics: "skipped" as const };
    // Saved. Now rescore; a failure here never undoes the save.
    try {
      const { afterTransactionsChanged } = await import("./analytics.server");
      await afterTransactionsChanged(context.supabase);
      return { ok: true as const, analytics: "refreshed" as const };
    } catch (e) {
      console.error("[analytics] post-save refresh failed", (e as Error).message);
      return { ok: true as const, analytics: "failed" as const };
    }
  });

/**
 * Records a successful login: upserts the caller's profile from the VERIFIED auth user
 * (id, email, provider name). Takes no client input. Preserves created_at and existing values; bumps last_login_at.
 * Written server-side only (users cannot edit this row directly).
 */
export const recordLogin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertMfa(context);
    const { getRequest } = await import("@tanstack/react-start/server");
    const token = getRequest()?.headers.get("authorization")?.replace("Bearer ", "") ?? "";
    const { data, error } = await context.supabase.auth.getUser(token);
    if (error || !data.user || data.user.id !== context.userId) throw new Error("Unauthorized");
    const u = data.user;
    const email = u.email && u.email_confirmed_at ? u.email : null;
    const meta = (u.user_metadata ?? {}) as Record<string, unknown>;
    const rawName = meta["full_name"] ?? meta["name"];
    const displayName = typeof rawName === "string" && rawName.trim() ? rawName.trim().slice(0, 200) : null;
    const { adminDb, check } = await import("./db.server");
    const admin = await adminDb();
    // Only non-null values are sent, so existing email/name are kept when the provider omits them.
    check(await admin.from("fin_user_profiles").upsert({
      auth_user_id: context.userId, last_login_at: new Date().toISOString(),
      ...(email ? { email } : {}), ...(displayName ? { display_name: displayName } : {}),
    }, { onConflict: "auth_user_id" }), "record_login");
    return { ok: true as const };
  });
