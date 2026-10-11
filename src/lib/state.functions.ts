import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { PersistedState } from "@/services/storage/storageAdapter";

/**
 * Server-backed persistence of each signed-in user's financial state in TigerData.
 * The owner id always comes from the verified session (requireSupabaseAuth), never from input.
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
    await assertMfa(context);
    const { readOwnerState } = await import("./tiger.server");
    const data = await readOwnerState(context.userId);
    return data ? { data: JSON.parse(JSON.stringify(data)) } : null;
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
    const { withOwner, writeState } = await import("./tiger.server");
    const { transactionsChanged } = await withOwner(context.userId, (tx) =>
      writeState(tx, context.userId, data as unknown as import("./tiger.server").StatePatch));
    // Analytics and scores depend only on transactions — skip the refresh when none changed.
    if (!transactionsChanged) return { ok: true as const, analytics: "skipped" as const };
    // Saved. Now refresh the affected TigerData summaries and rescore; a failure here never undoes the save.
    try {
      const { afterTransactionsChanged } = await import("./analytics.server");
      await afterTransactionsChanged(context.userId);
      return { ok: true as const, analytics: "refreshed" as const };
    } catch (e) {
      console.error("[analytics] post-save refresh failed", (e as Error).message);
      return { ok: true as const, analytics: "failed" as const };
    }
  });

/**
 * Records a successful login: upserts the caller's profile from the VERIFIED auth user
 * (id, email, provider name). Takes no client input. Preserves created_at; bumps last_login_at.
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
    const { withOwner } = await import("./tiger.server");
    await withOwner(context.userId, async (tx) => {
      await tx`INSERT INTO fin.user_profiles (auth_user_id, email, display_name, last_login_at)
        VALUES (${context.userId}, ${email}, ${displayName}, now())
        ON CONFLICT (auth_user_id) DO UPDATE SET
          email = COALESCE(EXCLUDED.email, fin.user_profiles.email),
          display_name = COALESCE(EXCLUDED.display_name, fin.user_profiles.display_name),
          last_login_at = now()`;
    });
    return { ok: true as const };
  });
